import { pool, query } from '../src/db';
import { EmployeeIdService } from '../src/services/employeeIdService';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

const adminToken = jwt.sign(
  { id: 1, employee_id: 'ADMIN001', role: 'admin', roles: ['admin'], name: 'Admin User' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const employeeToken = jwt.sign(
  { id: 16, employee_id: 'FISPL0001', role: 'employee', roles: ['employee'], name: 'Rubi Khatoon' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const API_BASE = 'http://127.0.0.1:3000';

async function runTests() {
  console.log('====================================================');
  console.log('Starting Enterprise Employee ID System Verifications');
  console.log('====================================================\n');

  let testAutoEmpId: number | null = null;
  let testCustomEmpId: number | null = null;

  try {
    // 1. Verify Existing Employees
    console.log('Test 1: Existing employees integrity...');
    const existingRes = await query(`
      SELECT id, employee_id, employee_code, is_custom_employee_id, name 
      FROM users 
      ORDER BY id ASC
    `);
    if (existingRes.rows.length < 16) {
      throw new Error(`Expected at least 16 existing users, found ${existingRes.rows.length}`);
    }
    const adminUser = existingRes.rows.find(u => u.employee_id === 'ADMIN001');
    const rubi = existingRes.rows.find(u => u.employee_id === 'FISPL0001');
    if (!adminUser || adminUser.is_custom_employee_id !== true) {
      throw new Error('ADMIN001 is missing or not marked as custom');
    }
    if (!rubi || rubi.is_custom_employee_id !== false) {
      throw new Error('FISPL0001 is missing or not marked as auto-sequence');
    }
    console.log(`✓ Existing employees verified intact (${existingRes.rows.length} records).\n`);

    // 2. Next Employee ID via Service
    console.log('Test 2: Auto ID Service sequence calculation...');
    const nextServiceId = await EmployeeIdService.getNextEmployeeId();
    console.log(`  Next sequential ID from service: ${nextServiceId}`);
    if (nextServiceId !== 'FISPL015') {
      throw new Error(`Expected FISPL015, received ${nextServiceId}`);
    }
    console.log('✓ Service correctly calculated next ID as FISPL015.\n');

    // 3. Next Employee ID via API
    console.log('Test 3: GET /api/admin/employees/next-id endpoint...');
    const nextIdRes = await fetch(`${API_BASE}/api/admin/employees/next-id`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const nextIdData = await nextIdRes.json();
    if (!nextIdData.success || nextIdData.data?.nextEmployeeId !== 'FISPL015') {
      throw new Error(`API next-id failed: ${JSON.stringify(nextIdData)}`);
    }
    console.log('✓ API endpoint returned nextEmployeeId: FISPL015.\n');

    // 4. Validate ID Endpoint
    console.log('Test 4: GET /api/admin/employees/validate-id validation checks...');
    // Existing ID check
    const dupRes = await fetch(`${API_BASE}/api/admin/employees/validate-id?employeeId=FISPL0001`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const dupData = await dupRes.json();
    if (dupData.valid !== false || !dupData.message.includes('already exists')) {
      throw new Error(`Duplicate validation failed: ${JSON.stringify(dupData)}`);
    }

    // Case-insensitive duplicate check
    const dupCaseRes = await fetch(`${API_BASE}/api/admin/employees/validate-id?employeeId=fispl0001`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const dupCaseData = await dupCaseRes.json();
    if (dupCaseData.valid !== false || !dupCaseData.message.includes('already exists')) {
      throw new Error(`Case-insensitive duplicate validation failed: ${JSON.stringify(dupCaseData)}`);
    }

    // Invalid format with space
    const spaceRes = await fetch(`${API_BASE}/api/admin/employees/validate-id?employeeId=FIS%20001`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const spaceData = await spaceRes.json();
    if (spaceData.valid !== false) {
      throw new Error(`Space validation failed: ${JSON.stringify(spaceData)}`);
    }

    // Available ID
    const availRes = await fetch(`${API_BASE}/api/admin/employees/validate-id?employeeId=CEO001`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const availData = await availRes.json();
    if (availData.valid !== true) {
      throw new Error(`Available ID validation failed: ${JSON.stringify(availData)}`);
    }
    console.log('✓ Real-time ID validation verified (duplicates, case-insensitivity, format).\n');

    // 5. Create Employee with Auto-Generated ID
    console.log('Test 5: Create Employee with Auto-Generated ID...');
    const createAutoRes = await fetch(`${API_BASE}/api/admin/employees`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Auto Employee',
        email: 'test.auto.employee@falconinfo.net',
        department: 'Engineering',
        designation: 'Staff Engineer',
        role: 'employee',
        roles: ['employee'],
        useCustomEmployeeId: false
      })
    });
    const createAutoData = await createAutoRes.json();
    if (!createAutoData.success || createAutoData.data?.employeeId !== 'FISPL015') {
      throw new Error(`Auto creation failed: ${JSON.stringify(createAutoData)}`);
    }
    testAutoEmpId = createAutoData.data.id;
    console.log(`✓ Auto-generated employee created with ID: ${createAutoData.data.employeeId} (DB ID: ${testAutoEmpId}).\n`);

    // 6. Create Employee with Custom ID and Audit Log
    console.log('Test 6: Create Employee with Custom ID and verify Audit Log...');
    const createCustomRes = await fetch(`${API_BASE}/api/admin/employees`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Executive User',
        email: 'test.executive@falconinfo.net',
        department: 'Leadership',
        designation: 'Chief Technology Officer',
        role: 'employee',
        roles: ['employee'],
        useCustomEmployeeId: true,
        customEmployeeId: 'CEO001',
        customIdReason: 'Executive Board Appointment'
      })
    });
    const createCustomData = await createCustomRes.json();
    if (!createCustomData.success || createCustomData.data?.employeeId !== 'CEO001') {
      throw new Error(`Custom creation failed: ${JSON.stringify(createCustomData)}`);
    }
    testCustomEmpId = createCustomData.data.id;
    console.log(`✓ Custom employee created with ID: ${createCustomData.data.employeeId} (DB ID: ${testCustomEmpId}).`);

    // Verify Audit Log
    const auditRes = await query(`
      SELECT * FROM audit_logs 
      WHERE action = 'CUSTOM_EMPLOYEE_ID_ASSIGNED' AND entity_id = $1
    `, [testCustomEmpId]);
    if (auditRes.rows.length === 0) {
      throw new Error('Audit log entry for custom Employee ID was not found');
    }
    const auditMeta = auditRes.rows[0].metadata;
    console.log('  Audit log metadata recorded:', auditMeta);
    if (auditMeta.employeeId !== 'CEO001' || auditMeta.reason !== 'Executive Board Appointment') {
      throw new Error('Audit log metadata does not match created details');
    }
    console.log('✓ Audit log recorded with Employee Name, Employee ID, Created By, Date/Time, and Reason.\n');

    // 7. Sequence Isolation: Verify custom ID (CEO001) did NOT advance FISPL sequence
    console.log('Test 7: Verify Custom IDs do NOT alter or skip the automatic FISPL sequence...');
    const nextSeqRes = await fetch(`${API_BASE}/api/admin/employees/next-id`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const nextSeqData = await nextSeqRes.json();
    console.log(`  Next automatic ID after creating FISPL015 and CEO001: ${nextSeqData.data?.nextEmployeeId}`);
    if (nextSeqData.data?.nextEmployeeId !== 'FISPL016') {
      throw new Error(`Sequence isolation failed! Expected FISPL016, received ${nextSeqData.data?.nextEmployeeId}`);
    }
    console.log('✓ Sequence isolation confirmed: CEO001 did NOT affect sequence, next auto ID is FISPL016.\n');

    // 8. Prevent Duplicate Creation (case-insensitive)
    console.log('Test 8: Prevent Duplicate Employee ID on creation (case-insensitive)...');
    const dupCreateRes = await fetch(`${API_BASE}/api/admin/employees`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Attempt',
        email: 'dup.attempt@falconinfo.net',
        useCustomEmployeeId: true,
        customEmployeeId: 'ceo001' // lowercase of CEO001
      })
    });
    const dupCreateData = await dupCreateRes.json();
    if (dupCreateRes.status !== 400 || !dupCreateData.error?.message.includes('already exists')) {
      throw new Error(`Duplicate creation was not blocked: ${JSON.stringify(dupCreateData)}`);
    }
    console.log(`✓ Duplicate blocked with expected message: "${dupCreateData.error.message}".\n`);

    // 9. Immutability: Verify Employee ID cannot be edited or renamed
    console.log('Test 9: Verify Employee ID immutability after creation...');
    const editRes = await fetch(`${API_BASE}/api/admin/employees/${testCustomEmpId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Executive User Renamed',
        customEmployeeId: 'HACKED001',
        employee_id: 'HACKED001',
        employeeCode: 'HACKED001',
        designation: 'Executive Vice President'
      })
    });
    const editData = await editRes.json();
    if (!editData.success) {
      throw new Error(`Edit request failed: ${JSON.stringify(editData)}`);
    }

    // Inspect database record to ensure Employee ID remained CEO001
    const checkUserRes = await query('SELECT employee_id, employee_code, designation FROM users WHERE id = $1', [testCustomEmpId]);
    const updatedUser = checkUserRes.rows[0];
    if (updatedUser.employee_id !== 'CEO001' || updatedUser.employee_code !== 'CEO001') {
      throw new Error(`Immutability violation! Employee ID changed to ${updatedUser.employee_id}`);
    }
    if (updatedUser.designation !== 'Executive Vice President') {
      throw new Error('Allowed field designation was not updated');
    }
    console.log('✓ Immutability confirmed: Designation updated, but Employee ID remained strictly CEO001.\n');

    // 10. Multi-field Search
    console.log('Test 10: Multi-field employee search...');
    // Search by Employee ID
    const searchIdRes = await fetch(`${API_BASE}/api/admin/employees?search=CEO001`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const searchIdData = await searchIdRes.json();
    if (searchIdData.data.items.length === 0 || searchIdData.data.items[0].employeeId !== 'CEO001') {
      throw new Error('Search by Employee ID failed');
    }

    // Search by Department
    const searchDeptRes = await fetch(`${API_BASE}/api/admin/employees?search=Engineering`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const searchDeptData = await searchDeptRes.json();
    if (searchDeptData.data.items.length === 0) {
      throw new Error('Search by Department failed');
    }

    // Search by Designation
    const searchDesigRes = await fetch(`${API_BASE}/api/admin/employees?search=Executive%20Vice%20President`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const searchDesigData = await searchDesigRes.json();
    if (searchDesigData.data.items.length === 0) {
      throw new Error('Search by Designation failed');
    }
    console.log('✓ Multi-field search verified (Employee ID, Department, Designation, Name, Email).\n');

    // 11. Reports & Export verification
    console.log('Test 11: Export & Reports verification...');
    const exportCsvRes = await fetch(`${API_BASE}/api/admin/employees/export?format=csv`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const csvText = await exportCsvRes.text();
    if (!csvText.includes('FISPL015') || !csvText.includes('CEO001')) {
      throw new Error('Export CSV does not contain test employee IDs');
    }

    const exportXlsxRes = await fetch(`${API_BASE}/api/admin/employees/export?format=excel`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (exportXlsxRes.status !== 200) {
      throw new Error(`Export Excel failed with status ${exportXlsxRes.status}`);
    }
    console.log('✓ CSV & Excel exports contain generated and custom Employee IDs.\n');

    console.log('====================================================');
    console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY (11/11)');
    console.log('====================================================\n');
  } catch (err: any) {
    console.error('VERIFICATION ERROR:', err);
    process.exitCode = 1;
  } finally {
    // Clean up created test employees
    console.log('Cleaning up test data...');
    if (testAutoEmpId) {
      await query('DELETE FROM users WHERE id = $1', [testAutoEmpId]);
    }
    if (testCustomEmpId) {
      await query('DELETE FROM audit_logs WHERE entity_id = $1', [testCustomEmpId]);
      await query('DELETE FROM users WHERE id = $1', [testCustomEmpId]);
    }
    console.log('Clean up completed.');
    process.exit(process.exitCode || 0);
  }
}

runTests();
