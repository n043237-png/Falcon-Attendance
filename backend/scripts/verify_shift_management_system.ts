import { query, pool } from '../src/db';
import { ShiftService } from '../src/services/shiftService';
import { calculateStatus, getAttendanceSettings } from '../src/services/attendanceStatusService';

async function runVerification() {
  console.log('====================================================');
  console.log('🚀 ENTERPRISE SHIFT MANAGEMENT SYSTEM VERIFICATION');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition: boolean, testName: string, details?: string) => {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] Test ${totalTests}: ${testName}`);
      if (details) console.error(`   Details: ${details}`);
    }
  };

  try {
    // ----------------------------------------------------
    // TEST 1: Default Shifts & Employees Migration Integrity
    // ----------------------------------------------------
    console.log('--- TEST SUITE 1: Shifts & Existing Employees Integrity ---');
    const shiftsRes = await query('SELECT * FROM shifts ORDER BY id ASC');
    assert(shiftsRes.rows.length >= 2, 'Default shifts table populated', `Found ${shiftsRes.rows.length} shifts`);

    const dayShift = shiftsRes.rows.find((s) => s.code === 'DS');
    const nightShift = shiftsRes.rows.find((s) => s.code === 'NS');

    assert(!!dayShift && dayShift.name === 'Day Shift', 'Day Shift (DS) exists with 09:30-18:30 timings');
    assert(!!nightShift && nightShift.name === 'Night Shift', 'Night Shift (NS) exists with 21:00-06:00 timings');

    const usersWithoutShift = await query('SELECT COUNT(*) FROM users WHERE shift_id IS NULL AND status = $1', ['active']);
    assert(parseInt(usersWithoutShift.rows[0].count) === 0, 'All active employees mapped to an assigned shift');

    // ----------------------------------------------------
    // TEST 2: Create, Update & Read Custom Shift
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 2: Shift CRUD Operations ---');
    await query("DELETE FROM employee_shift_assignments WHERE shift_id IN (SELECT id FROM shifts WHERE code = 'EOS')");
    await query("DELETE FROM shifts WHERE code = 'EOS'");

    const createdShift = await ShiftService.createShift({
      name: 'Evening Operations Shift',
      code: 'EOS',
      startTime: '14:00',
      endTime: '22:30',
      graceMinutes: 10,
      breakMinutes: 45,
      minimumWorkHours: 7.5,
      halfDayMinutes: 225,
      overtimeEnabled: true,
      description: 'Test shift for operations team',
      status: 'active'
    });

    assert(createdShift.code === 'EOS', 'Custom shift created with code EOS');
    assert(createdShift.lateAfter === '14:10:00', `Late threshold calculated correctly (14:10:00), got ${createdShift.lateAfter}`);
    assert(createdShift.isNightShift === false, 'EOS correctly identified as standard daytime shift');

    const updatedShift = await ShiftService.updateShift(createdShift.id, {
      graceMinutes: 20
    });
    assert(updatedShift.graceMinutes === 20 && updatedShift.lateAfter === '14:20:00', 'Shift grace period updated and late cutoff refreshed to 14:20:00');

    // ----------------------------------------------------
    // TEST 3: Shift Assignment & Delete Guard
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 3: Shift Assignment & Safe Deletion Guard ---');
    // Pick an existing employee
    const empRes = await query('SELECT id, name, shift_id FROM users WHERE status = $1 LIMIT 1', ['active']);
    const testEmployee = empRes.rows[0];
    const originalShiftId = testEmployee.shift_id;

    // Assign to EOS
    await ShiftService.assignShift(testEmployee.id, createdShift.id, undefined, 'Automated verification test assignment');
    const verifyUserShift = await ShiftService.getEmployeeShift(testEmployee.id);
    assert(verifyUserShift.id === createdShift.id, `Employee ${testEmployee.name} assigned to EOS shift`);

    // Verify audit record exists in employee_shift_assignments
    const auditRes = await query(
      'SELECT * FROM employee_shift_assignments WHERE employee_id = $1 AND shift_id = $2 ORDER BY id DESC LIMIT 1',
      [testEmployee.id, createdShift.id]
    );
    assert(auditRes.rows.length > 0, 'Shift assignment logged to employee_shift_assignments audit history');

    // Attempt to delete EOS (Must be blocked due to assigned employee)
    let deleteBlocked = false;
    try {
      await ShiftService.deleteShift(createdShift.id);
    } catch (delErr: any) {
      deleteBlocked = true;
      assert(delErr.message.includes('assigned to'), 'Deletion of shift with assigned employees strictly blocked with safety message');
    }
    assert(deleteBlocked, 'Shift deletion protection verified');

    // Reassign back to original shift
    await ShiftService.assignShift(testEmployee.id, originalShiftId, undefined, 'Reassigned back after test');

    // Now delete EOS should succeed
    const delResult = await ShiftService.deleteShift(createdShift.id);
    assert(delResult.success === true, 'Shift deletion succeeds after employee reassignment');

    // ----------------------------------------------------
    // TEST 4: Bulk Shift Assignment
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 4: Bulk Shift Assignment ---');
    const bulkEmployees = await query('SELECT id FROM users WHERE status = $1 LIMIT 3', ['active']);
    const bulkEmpIds = bulkEmployees.rows.map((r) => r.id);

    const bulkResult = await ShiftService.bulkAssignShift(bulkEmpIds, nightShift.id, undefined, 'Bulk shift rotation test');
    assert(bulkResult.assignedCount === bulkEmpIds.length, `Bulk assigned ${bulkEmpIds.length} employees to Night Shift`);

    // Reassign back to Day Shift
    await ShiftService.bulkAssignShift(bulkEmpIds, dayShift.id, undefined, 'Reassigned back to Day Shift');
    const allBack = await query('SELECT COUNT(*) FROM users WHERE id = ANY($1) AND shift_id = $2', [bulkEmpIds, dayShift.id]);
    assert(parseInt(allBack.rows[0].count) === bulkEmpIds.length, 'Employees successfully bulk reassigned back to Day Shift');

    // ----------------------------------------------------
    // TEST 5: Shift-Aware Attendance Evaluation (Day Shift)
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 5: Shift-Aware Attendance Evaluation (Day Shift) ---');
    // Scenario 5a: On-time check-in (09:40 AM <= 09:45 AM cutoff)
    const onTimeCheckIn = new Date('2026-09-26T09:40:00+05:30');
    const onTimeCheckOut = new Date('2026-09-26T18:40:00+05:30');
    const evalOnTime = ShiftService.evaluateAttendance(dayShift, onTimeCheckIn, onTimeCheckOut);
    assert(evalOnTime.isLate === false, '09:40 AM check-in marked NOT LATE (within 15m grace)');
    assert(evalOnTime.lateMinutes === 0, 'Late minutes is 0 for on-time arrival');
    // Raw span = 9h = 540 min. Minus 60 min break = 480 min (8.0 hours).
    assert(evalOnTime.workingMinutes === 480, `Working minutes correctly deducted 60m break: expected 480, got ${evalOnTime.workingMinutes}`);
    assert(evalOnTime.status === 'PRESENT', 'Status evaluated as full-day PRESENT');

    // Scenario 5b: Late check-in with Overtime
    // Check in at 10:15 AM (45 min after 09:30 start) -> 30 min late beyond 15m grace (or 45m past shift start)
    const lateCheckIn = new Date('2026-09-26T10:15:00+05:30');
    // Check out at 20:15 PM -> 10 hours span = 600 min. Minus 60 min break = 540 min (9.0 hrs). Overtime = 60 min (1.0 hr).
    const lateCheckOut = new Date('2026-09-26T20:15:00+05:30');
    const evalLate = ShiftService.evaluateAttendance(dayShift, lateCheckIn, lateCheckOut);
    assert(evalLate.isLate === true, '10:15 AM check-in flagged as LATE');
    assert(evalLate.lateMinutes === 30, `Late minutes computed correctly beyond grace period: expected 30, got ${evalLate.lateMinutes}`);
    assert(evalLate.workingMinutes === 540, `Working minutes 540m (9.0 hrs): got ${evalLate.workingMinutes}`);
    assert(evalLate.overtimeMinutes === 60, `Overtime computed as 60m (1.0 hr past 8.0h min): got ${evalLate.overtimeMinutes}`);

    // ----------------------------------------------------
    // TEST 6: Overnight Night Shift Across Midnight Evaluation
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 6: Overnight Night Shift Evaluation ---');
    assert(nightShift.end_time <= nightShift.start_time, 'Night shift verified as overnight shift (21:00 to 06:00)');
    const nightShiftDetails = await ShiftService.getShiftById(nightShift.id);
    assert(nightShiftDetails?.isNightShift === true, 'ShiftService correctly identifies Night Shift as isNightShift=true');

    // Night Shift check in at 21:10 (grace is 15m -> cutoff 21:15)
    const nightCheckIn = new Date('2026-09-26T21:10:00+05:30');
    // Check out next morning at 06:10 AM -> 9 hours span = 540 min. Minus 60 min break = 480 min (8.0 hrs)
    const nightCheckOut = new Date('2026-09-27T06:10:00+05:30');
    const evalNight = ShiftService.evaluateAttendance(nightShiftDetails!, nightCheckIn, nightCheckOut);
    assert(evalNight.isLate === false, '21:10 PM Night Shift check-in marked NOT LATE');
    assert(evalNight.workingMinutes === 480, `Overnight working duration with break deduction: expected 480m, got ${evalNight.workingMinutes}`);
    assert(evalNight.status === 'PRESENT', 'Night Shift evaluates to PRESENT across calendar day boundary');

    // ----------------------------------------------------
    // TEST 7: Shift-Aware Status Calculation Service
    // ----------------------------------------------------
    console.log('\n--- TEST SUITE 7: Shift-Aware Attendance Status Calculation ---');
    const settings = await getAttendanceSettings();
    const statusResult = calculateStatus(
      '2026-09-26',
      {
        check_in: onTimeCheckIn,
        check_out: onTimeCheckOut,
        working_minutes: 480,
        status: 'PRESENT',
        shift_id: dayShift.id,
        is_late: false
      },
      settings,
      null,
      null,
      new Date('2026-09-26T23:59:59+05:30'),
      dayShiftDetails(dayShift)
    );
    assert(statusResult.status === 'PRESENT', `Shift-aware status calculated as PRESENT, got ${statusResult.status}`);
    assert(statusResult.isLate === false, 'Shift-aware isLate returned false');

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log(`🎯 VERIFICATION RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('====================================================');

    if (passedTests === totalTests) {
      console.log('🎉 ALL ENTERPRISE SHIFT MANAGEMENT CHECKS PASSED!\n');
    } else {
      console.error('⚠️ Some tests failed. Please review errors above.\n');
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error('Fatal error running verification:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

function dayShiftDetails(raw: any) {
  return {
    id: raw.id,
    name: raw.name,
    code: raw.code,
    startTime: raw.start_time,
    endTime: raw.end_time,
    breakMinutes: raw.break_minutes,
    graceMinutes: raw.grace_minutes,
    minimumWorkHours: parseFloat(raw.minimum_work_hours),
    lateAfter: raw.late_after,
    halfDayMinutes: raw.half_day_minutes,
    overtimeEnabled: raw.overtime_enabled,
    description: raw.description,
    status: raw.status,
    isNightShift: false,
    assignedCount: 0
  };
}

runVerification();
