import { pool, query } from '../src/db';
import { LeaveValidationService } from '../src/services/leaveValidationService';

async function runTests() {
  console.log('==================================================');
  console.log('SMART LEAVE VALIDATION ENGINE VERIFICATION SUITE');
  console.log('==================================================\n');

  // 1. Get an existing test employee
  const userRes = await query(`
    SELECT id, employee_id, name, email 
    FROM users 
    WHERE role = 'employee' 
    LIMIT 1
  `);

  if (userRes.rows.length === 0) {
    throw new Error('No employee found in database for testing!');
  }

  const testEmp = userRes.rows[0];
  console.log(`[SETUP] Using test employee: ${testEmp.name} (DB ID: ${testEmp.id}, Code: ${testEmp.employee_id})`);

  // Ensure test employee has a leave balance record
  const balRes = await query('SELECT * FROM leave_balances WHERE employee_id = $1', [testEmp.id]);
  if (balRes.rows.length === 0) {
    await query(`
      INSERT INTO leave_balances (employee_id, year, accrued_leave, used_paid_leave, leave_without_pay, current_balance)
      VALUES ($1, 2026, 15, 0, 0, 15)
    `, [testEmp.id]);
  } else {
    // Reset to 10 for deterministic testing
    await query(`
      UPDATE leave_balances 
      SET accrued_leave = 15, used_paid_leave = 5, current_balance = 10, leave_without_pay = 0 
      WHERE employee_id = $1
    `, [testEmp.id]);
  }

  // Ensure default leave settings
  await query(`
    INSERT INTO leave_settings (id, enable_holiday_validation, enable_sunday_validation, enable_weekly_off_validation, show_leave_impact_summary, weekly_off_days)
    VALUES (1, true, true, true, true, '[0]')
    ON CONFLICT (id) DO UPDATE 
    SET enable_holiday_validation = true, enable_sunday_validation = true, enable_weekly_off_validation = true, show_leave_impact_summary = true, weekly_off_days = '[0]'
  `);

  // Setup a test holiday: 2026-10-02 (Gandhi Jayanti)
  await query(`DELETE FROM holidays WHERE holiday_date = '2026-10-02'`);
  await query(`INSERT INTO holidays (holiday_date, name) VALUES ('2026-10-02', 'Gandhi Jayanti')`);

  try {
    // ----------------------------------------------------
    // TEST 1: Working Days Only (Mon-Wed: 2026-10-05 to 2026-10-07)
    // ----------------------------------------------------
    console.log('\n--- TEST 1: Working Days Only Validation ---');
    const res1 = await LeaveValidationService.validateLeaveRequest(testEmp.id, '2026-10-05', '2026-10-07');
    console.log(`Dates: 2026-10-05 to 2026-10-07 (Mon to Wed)`);
    console.log(`Total Days: ${res1.totalDays}, Working: ${res1.workingDays}, Weekly Offs: ${res1.weeklyOffDays}, Holidays: ${res1.companyHolidays}`);
    console.log(`Paid Leave Required: ${res1.paidLeaveRequired}, Balance After: ${res1.balanceAfter}`);

    if (res1.totalDays !== 3 || res1.workingDays !== 3 || res1.weeklyOffDays !== 0 || res1.companyHolidays !== 0) {
      throw new Error(`TEST 1 Failed: Expected 3 total/working days, got total=${res1.totalDays}, working=${res1.workingDays}`);
    }
    if (res1.paidLeaveRequired !== 3) {
      throw new Error(`TEST 1 Failed: Expected 3 paid leave required, got ${res1.paidLeaveRequired}`);
    }
    if (res1.daysBreakdown.every(d => d.category === 'WORKING_DAY' && d.badgeColor === 'blue') === false) {
      throw new Error('TEST 1 Failed: All days should be blue WORKING_DAY');
    }
    console.log('✓ TEST 1 PASSED: Pure working days validated correctly (3 days deducted).');

    // ----------------------------------------------------
    // TEST 2: Sunday / Weekly Off Only (2026-10-04)
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Sunday / Weekly Off Only Validation ---');
    const res2 = await LeaveValidationService.validateLeaveRequest(testEmp.id, '2026-10-04', '2026-10-04');
    console.log(`Date: 2026-10-04 (Sunday)`);
    console.log(`Total Days: ${res2.totalDays}, Weekly Offs: ${res2.weeklyOffDays}, Paid Leave Required: ${res2.paidLeaveRequired}`);
    console.log(`All Weekly Offs: ${res2.allWeeklyOffs}, Notice: ${res2.specialNotice?.title}`);

    if (res2.totalDays !== 1 || res2.weeklyOffDays !== 1 || res2.paidLeaveRequired !== 0) {
      throw new Error(`TEST 2 Failed: Sunday must require 0 paid leave, got ${res2.paidLeaveRequired}`);
    }
    if (!res2.allWeeklyOffs || !res2.specialNotice) {
      throw new Error('TEST 2 Failed: allWeeklyOffs flag and special notice must be set');
    }
    if (res2.daysBreakdown[0].badgeColor !== 'green' || res2.daysBreakdown[0].consumesPaidLeave !== false) {
      throw new Error('TEST 2 Failed: Sunday badge must be green with no deduction');
    }
    console.log('✓ TEST 2 PASSED: Sunday categorized as green Weekly Off with 0 paid leave deduction.');

    // ----------------------------------------------------
    // TEST 3: Company Holiday Only (2026-10-02)
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Company Holiday Only Validation ---');
    const res3 = await LeaveValidationService.validateLeaveRequest(testEmp.id, '2026-10-02', '2026-10-02');
    console.log(`Date: 2026-10-02 (Gandhi Jayanti)`);
    console.log(`Total Days: ${res3.totalDays}, Holidays: ${res3.companyHolidays}, Paid Leave Required: ${res3.paidLeaveRequired}`);
    console.log(`All Company Holidays: ${res3.allCompanyHolidays}, Notice: ${res3.specialNotice?.title}`);

    if (res3.totalDays !== 1 || res3.companyHolidays !== 1 || res3.paidLeaveRequired !== 0) {
      throw new Error(`TEST 3 Failed: Holiday must require 0 paid leave, got ${res3.paidLeaveRequired}`);
    }
    if (!res3.allCompanyHolidays || !res3.specialNotice) {
      throw new Error('TEST 3 Failed: allCompanyHolidays flag and special notice must be set');
    }
    if (res3.daysBreakdown[0].badgeColor !== 'orange' || res3.daysBreakdown[0].holidayName !== 'Gandhi Jayanti') {
      throw new Error('TEST 3 Failed: Holiday badge must be orange with holiday name');
    }
    console.log('✓ TEST 3 PASSED: Holiday categorized as orange Company Holiday with 0 paid leave deduction.');

    // ----------------------------------------------------
    // TEST 4: Mixed Period (2026-10-02 to 2026-10-05)
    // Fri (Holiday) + Sat (Working) + Sun (Weekly Off) + Mon (Working) = 4 days
    // Working = 2, Holiday = 1, Weekly Off = 1 => Paid Required = 2
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Mixed Date Range Validation ---');
    const res4 = await LeaveValidationService.validateLeaveRequest(testEmp.id, '2026-10-02', '2026-10-05');
    console.log(`Dates: 2026-10-02 to 2026-10-05 (Fri to Mon - 4 calendar days)`);
    console.log(`Summary: Total=${res4.totalDays}, Working=${res4.workingDays}, Weekly Offs=${res4.weeklyOffDays}, Holidays=${res4.companyHolidays}, Paid Required=${res4.paidLeaveRequired}`);
    
    if (res4.totalDays !== 4) throw new Error(`TEST 4 Failed: Expected 4 total days, got ${res4.totalDays}`);
    if (res4.workingDays !== 2) throw new Error(`TEST 4 Failed: Expected 2 working days, got ${res4.workingDays}`);
    if (res4.weeklyOffDays !== 1) throw new Error(`TEST 4 Failed: Expected 1 weekly off, got ${res4.weeklyOffDays}`);
    if (res4.companyHolidays !== 1) throw new Error(`TEST 4 Failed: Expected 1 company holiday, got ${res4.companyHolidays}`);
    if (res4.paidLeaveRequired !== 2) throw new Error(`TEST 4 Failed: Expected 2 paid leave required, got ${res4.paidLeaveRequired}`);

    console.log('✓ TEST 4 PASSED: Mixed range accurately exempted holiday and Sunday, deducting only 2 working days.');

    // ----------------------------------------------------
    // TEST 5: Insufficient Balance / LWP Split
    // Set employee balance to 1 day, request 3 working days (2026-10-05 to 2026-10-07)
    // Expect: Paid Leave Required = 3, Balance = 1 -> LWP = 2 days, Balance After = 0
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Insufficient Balance / LWP Calculation ---');
    await query(`UPDATE leave_balances SET current_balance = 1 WHERE employee_id = $1`, [testEmp.id]);
    const res5 = await LeaveValidationService.validateLeaveRequest(testEmp.id, '2026-10-05', '2026-10-07');
    console.log(`Available Balance: 1, Paid Required: ${res5.paidLeaveRequired}`);
    console.log(`isLwpRequired: ${res5.isLwpRequired}, lwpDays: ${res5.lwpDays}, balanceAfter: ${res5.balanceAfter}`);
    console.log(`LWP Warning in confirmation dialog: "${res5.confirmationDialog.lwpWarningText}"`);

    if (!res5.isLwpRequired || res5.lwpDays !== 2 || res5.balanceAfter !== 0) {
      throw new Error(`TEST 5 Failed: Expected isLwpRequired=true, lwpDays=2, balanceAfter=0. Got lwpDays=${res5.lwpDays}, balanceAfter=${res5.balanceAfter}`);
    }
    if (!res5.confirmationDialog.lwpWarningText?.includes('Leave Without Pay')) {
      throw new Error('TEST 5 Failed: LWP warning message missing from confirmation dialog');
    }
    console.log('✓ TEST 5 PASSED: Correctly split into 1 paid day and 2 LWP days with alert.');

    // Reset balance back to 10
    await query(`UPDATE leave_balances SET current_balance = 10 WHERE employee_id = $1`, [testEmp.id]);

    // ----------------------------------------------------
    // TEST 6: Approved Leave Overlap Blocking
    // Insert an approved leave for 2026-10-20 to 2026-10-22
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Approved Overlap Blocking ---');
    await query(`DELETE FROM leave_requests WHERE employee_id = $1 AND from_date = '2026-10-20'`, [testEmp.id]);
    await query(`
      INSERT INTO leave_requests (employee_id, leave_type, from_date, to_date, days, reason, status)
      VALUES ($1, 'Paid Leave', '2026-10-20', '2026-10-22', 3, 'Approved test leave', 'APPROVED')
    `, [testEmp.id]);

    const res6 = await LeaveValidationService.validateLeaveRequest(testEmp.id, '2026-10-21', '2026-10-25');
    console.log(`Validation result for overlapping request: isValid=${res6.isValid}, canSubmit=${res6.canSubmit}`);
    console.log(`hasApprovedOverlap: ${res6.hasApprovedOverlap}, blockReason: "${res6.blockReason}"`);

    if (res6.canSubmit !== false || !res6.hasApprovedOverlap) {
      throw new Error('TEST 6 Failed: Submission should be blocked due to approved overlap');
    }
    if (!res6.blockReason?.includes('already have approved leave')) {
      throw new Error(`TEST 6 Failed: Expected block reason message, got ${res6.blockReason}`);
    }
    console.log('✓ TEST 6 PASSED: Overlapping approved leave strictly blocked from submission.');

    // ----------------------------------------------------
    // TEST 7: Admin Settings Toggle - Disable Sunday Exemption
    // When Sunday validation is disabled, Sunday should count as a working day (1 day deduction)
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Admin Settings Toggle (Disable Sunday Exemption) ---');
    await LeaveValidationService.updateLeaveSettings({ enableSundayValidation: false });

    const res7 = await LeaveValidationService.validateLeaveRequest(testEmp.id, '2026-10-04', '2026-10-04');
    console.log(`With enableSundayValidation=false, Sunday 2026-10-04 category: ${res7.daysBreakdown[0].category}, Paid Required: ${res7.paidLeaveRequired}`);

    if (res7.paidLeaveRequired !== 1 || res7.daysBreakdown[0].category !== 'WORKING_DAY') {
      throw new Error(`TEST 7 Failed: With Sunday validation disabled, Sunday must count as working day. Got paid=${res7.paidLeaveRequired}`);
    }
    console.log('✓ TEST 7 PASSED: Admin toggle dynamically alters validation behavior.');

    // Restore Sunday validation
    await LeaveValidationService.updateLeaveSettings({ enableSundayValidation: true });

    // ----------------------------------------------------
    // TEST 8: Admin Settings - Custom Weekly Offs (e.g. Saturday & Sunday: [0, 6])
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Admin Settings - Saturday & Sunday Weekly Offs ---');
    await LeaveValidationService.updateLeaveSettings({ weeklyOffDays: [0, 6] });

    // 2026-10-03 is Saturday
    const res8 = await LeaveValidationService.validateLeaveRequest(testEmp.id, '2026-10-03', '2026-10-03');
    console.log(`With weeklyOffDays=[0, 6], Saturday 2026-10-03 category: ${res8.daysBreakdown[0].category}, Paid Required: ${res8.paidLeaveRequired}`);

    if (res8.paidLeaveRequired !== 0 || res8.daysBreakdown[0].category !== 'WEEKLY_OFF') {
      throw new Error(`TEST 8 Failed: Saturday must be recognized as weekly off. Got paid=${res8.paidLeaveRequired}`);
    }
    console.log('✓ TEST 8 PASSED: Custom multi-day weekly offs ([0, 6]) properly honored.');

    // Restore weekly off days to [0]
    await LeaveValidationService.updateLeaveSettings({ weeklyOffDays: [0] });

    // ----------------------------------------------------
    // TEST 9: Confirmation Dialog Structure Verification
    // ----------------------------------------------------
    console.log('\n--- TEST 9: Confirmation Dialog Content Verification ---');
    const res9 = await LeaveValidationService.validateLeaveRequest(testEmp.id, '2026-10-02', '2026-10-05');
    const dialog = res9.confirmationDialog;

    console.log(`Dialog Title: "${dialog.title}"`);
    console.log(`Summary: "${dialog.summaryMessage}"`);
    console.log(`Breakdown Bullets:`, dialog.breakdownBulletPoints);
    console.log(`Paid Required Text: "${dialog.paidLeaveRequiredText}"`);
    console.log(`Balance After Text: "${dialog.balanceAfterText}"`);
    console.log(`Policy Note: "${dialog.policyNote}"`);

    if (dialog.title !== 'Leave Impact Analysis') {
      throw new Error(`TEST 9 Failed: Expected dialog title "Leave Impact Analysis", got "${dialog.title}"`);
    }
    if (dialog.breakdownBulletPoints.length !== 3) {
      throw new Error(`TEST 9 Failed: Expected 3 breakdown bullet points, got ${dialog.breakdownBulletPoints.length}`);
    }
    if (!dialog.paidLeaveRequiredText.includes('2 Days')) {
      throw new Error(`TEST 9 Failed: Expected paid leave required text to mention 2 Days, got "${dialog.paidLeaveRequiredText}"`);
    }
    console.log('✓ TEST 9 PASSED: Confirmation Dialog structured exactly according to specification.');

    // ----------------------------------------------------
    // TEST 10: Clean Up Test Artifacts
    // ----------------------------------------------------
    console.log('\n--- CLEANUP ---');
    await query(`DELETE FROM leave_requests WHERE employee_id = $1 AND from_date = '2026-10-20'`, [testEmp.id]);
    await query(`DELETE FROM holidays WHERE holiday_date = '2026-10-02'`);
    console.log('✓ Test records cleaned up successfully.');

    console.log('\n==================================================');
    console.log('ALL 10 SMART LEAVE VALIDATION TESTS PASSED! 🎉');
    console.log('==================================================\n');
  } catch (error) {
    console.error('\n❌ VERIFICATION TEST FAILED:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
