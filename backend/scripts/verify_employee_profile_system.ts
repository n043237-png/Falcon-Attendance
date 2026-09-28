import { pool, query } from '../src/db';
import { EmployeeProfileService, MaskHelper, calculateProfileCompleteness } from '../src/services/employeeProfileService';
import { DocumentService } from '../src/services/documentService';
import path from 'path';
import fs from 'fs';

async function verify() {
  console.log('--- STARTING HRMS EMPLOYEE PROFILE VERIFICATION ---');

  // 1. Get an existing employee from users
  const userRes = await query(`
    SELECT id, employee_id, name, email, phone, role 
    FROM users 
    WHERE role = 'employee' 
    LIMIT 1
  `);

  if (userRes.rows.length === 0) {
    console.error('No employee found to test with!');
    process.exit(1);
  }

  const testEmp = userRes.rows[0];
  console.log(`Testing with Employee ID: ${testEmp.employee_id} (DB ID: ${testEmp.id}, Name: ${testEmp.name})`);

  // Get admin user for auditing
  const adminRes = await query(`SELECT id, name FROM users WHERE role = 'admin' LIMIT 1`);
  const adminUser = adminRes.rows[0];
  console.log(`Admin User: ${adminUser.name} (DB ID: ${adminUser.id})`);

  // 2. Test MaskHelper
  console.log('\n[TEST 1] Masking Functionality');
  const maskedBank = MaskHelper.maskBank('123456789012');
  const maskedAadhaar = MaskHelper.maskAadhaar('1234 5678 9012');
  const maskedPan = MaskHelper.maskPan('ABCDE1234F');
  console.log('Masked Bank:', maskedBank);
  console.log('Masked Aadhaar:', maskedAadhaar);
  console.log('Masked PAN:', maskedPan);
  if (!maskedBank?.endsWith('9012') || !maskedBank?.startsWith('XXXXXXXX')) {
    throw new Error('Bank masking failed');
  }
  if (!maskedAadhaar?.endsWith('9012') || !maskedAadhaar?.startsWith('XXXXXXXX')) {
    throw new Error('Aadhaar masking failed');
  }
  if (!maskedPan?.endsWith('234F') || !maskedPan?.startsWith('XXXXXX')) {
    throw new Error('PAN masking failed');
  }
  console.log('✓ Masking passed');

  // 3. Test getFullProfile (Masked vs Unmasked)
  console.log('\n[TEST 2] Profile Retrieval (Masked vs Unmasked)');
  // Set test sensitive values first via admin
  await EmployeeProfileService.updateProfile(testEmp.id, adminUser.id, 'admin', {
    accountNumber: '987654321098',
    aadhaarNumber: '998877665544',
    panNumber: 'ABCDE9999Z',
    bankName: 'HDFC Bank',
    ifscCode: 'HDFC0001234',
    branchName: 'Mumbai Main',
    bloodGroup: 'O+',
    dateOfBirth: '1995-05-15',
    gender: 'Male',
    maritalStatus: 'Single',
    personalEmail: 'test.emp.personal@gmail.com',
    currentAddress: '123 Marine Drive, Flat 4B',
    emergencyContactName: 'Jane Doe',
    emergencyContactRelationship: 'Spouse',
    emergencyContactPhone: '9876500000'
  });

  const maskedProfile = await EmployeeProfileService.getFullProfile(testEmp.id, false);
  console.log('Masked profile bank account:', maskedProfile?.accountNumber);
  console.log('Masked profile aadhaar:', maskedProfile?.aadhaarNumber);
  console.log('Masked profile PAN:', maskedProfile?.panNumber);
  if (maskedProfile?.accountNumber !== 'XXXXXXXX1098') {
    throw new Error(`Expected masked bank XXXXXXXX1098, got ${maskedProfile?.accountNumber}`);
  }
  if (maskedProfile?.aadhaarNumber !== 'XXXXXXXX5544') {
    throw new Error(`Expected masked aadhaar XXXXXXXX5544, got ${maskedProfile?.aadhaarNumber}`);
  }

  const unmaskedProfile = await EmployeeProfileService.getFullProfile(testEmp.id, true);
  console.log('Unmasked profile bank account:', unmaskedProfile?.accountNumber);
  if (unmaskedProfile?.accountNumber !== '987654321098') {
    throw new Error(`Expected unmasked bank 987654321098, got ${unmaskedProfile?.accountNumber}`);
  }
  console.log('✓ Profile retrieval (masked & unmasked) passed');

  // 4. Test Completeness Scoring
  console.log('\n[TEST 3] Profile Completeness Scoring');
  console.log(`Completeness Score: ${unmaskedProfile?.completeness?.percentage}%`);
  console.log(`Missing Fields Count: ${unmaskedProfile?.completeness?.missingFields?.length}`);
  console.log(`Missing Fields List:`, unmaskedProfile?.completeness?.missingFields);
  if (typeof unmaskedProfile?.completeness?.percentage !== 'number' || unmaskedProfile.completeness.percentage <= 0) {
    throw new Error('Completeness calculation failed');
  }
  console.log('✓ Profile completeness scoring passed');

  // 5. Test Employee Self-Service Update (allowed fields vs restricted fields)
  console.log('\n[TEST 4] Employee Self-Service RBAC');
  await EmployeeProfileService.updateProfile(testEmp.id, testEmp.id, 'employee', {
    phone: '9998887777',
    personalEmail: 'updated.self@example.com',
    currentAddress: 'New Address 456 Street',
    emergencyContactPhone: '9111222333',
    // Attempt restricted fields:
    department: 'HACKED_DEPARTMENT',
    accountNumber: '000000000000',
    salary: 9999999
  });

  const postSelfUpdate = await EmployeeProfileService.getFullProfile(testEmp.id, true);
  if (postSelfUpdate?.phone !== '9998887777') {
    throw new Error('Self update of phone failed');
  }
  if (postSelfUpdate?.personalEmail !== 'updated.self@example.com') {
    throw new Error('Self update of personal email failed');
  }
  if (postSelfUpdate?.department === 'HACKED_DEPARTMENT') {
    throw new Error('Security Breach! Employee was able to modify department!');
  }
  if (postSelfUpdate?.accountNumber === '000000000000') {
    throw new Error('Security Breach! Employee was able to modify bank account!');
  }
  console.log('✓ Self-service RBAC enforcement passed');

  // 6. Test Salary Profile Sync
  console.log('\n[TEST 5] Employee Salary Profile Sync');
  const salRes = await query('SELECT * FROM employee_salary_profiles WHERE employee_id = $1', [testEmp.id]);
  console.log('Synced salary profile row:', salRes.rows[0]);
  if (!salRes.rows[0] || salRes.rows[0].bank_name !== 'HDFC Bank' || salRes.rows[0].account_number !== '987654321098') {
    throw new Error('Salary profile sync failed');
  }
  console.log('✓ Salary profile sync passed');

  // 7. Test Audit Logs
  console.log('\n[TEST 6] Audit Logging Verification');
  const auditLogs = await EmployeeProfileService.getProfileActivityLogs(testEmp.id, 20);
  console.log(`Found ${auditLogs.length} audit log entries for user ${testEmp.id}`);
  if (auditLogs.length === 0) {
    throw new Error('No audit logs created for profile updates');
  }
  const sampleLog = auditLogs[0];
  console.log('Sample audit log:', {
    action: sampleLog.action,
    entityType: sampleLog.entityType,
    metadata: sampleLog.metadata,
    performedBy: sampleLog.performedByName
  });
  console.log('✓ Audit logging passed');

  // 8. Test Document Management
  console.log('\n[TEST 7] Document Management');
  const testDocFile: any = {
    fieldname: 'file',
    originalname: 'test_resume.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    destination: path.join(process.cwd(), 'uploads', 'documents'),
    filename: `TEST-RESUME-${Date.now()}.pdf`,
    path: path.join(process.cwd(), 'uploads', 'documents', `TEST-RESUME-${Date.now()}.pdf`),
    size: 1024
  };
  // Create physical dummy file
  fs.writeFileSync(testDocFile.path, 'DUMMY PDF CONTENT');

  const savedDoc = await DocumentService.saveDocumentRecord({
    userId: testEmp.id,
    documentType: 'RESUME',
    documentTitle: 'Updated 2026 Resume',
    file: testDocFile,
    uploadedBy: adminUser.id
  });
  console.log('Saved document record:', savedDoc);

  const profileWithDoc = await EmployeeProfileService.getFullProfile(testEmp.id, false);
  const foundDoc = profileWithDoc?.documents?.find((d: any) => d.id === savedDoc.id);
  if (!foundDoc) {
    throw new Error('Uploaded document not found in profile');
  }
  console.log('Found uploaded document in profile:', foundDoc.documentTitle);

  // Delete document
  await DocumentService.deleteDocument(savedDoc.id, testEmp.id, adminUser.id, true);
  const profileAfterDelete = await EmployeeProfileService.getFullProfile(testEmp.id, false);
  const stillExists = profileAfterDelete?.documents?.some((d: any) => d.id === savedDoc.id);
  if (stillExists) {
    throw new Error('Document deletion failed');
  }
  console.log('✓ Document upload and deletion passed');

  // 9. Test Search with Mobile Number
  console.log('\n[TEST 8] Search by Phone Number');
  const searchPhone = '9998887777';
  const searchRes = await query(`
    SELECT id, name, phone, employee_id 
    FROM users 
    WHERE (name ILIKE $1 OR employee_id ILIKE $1 OR employee_code ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1 OR department ILIKE $1 OR designation ILIKE $1)
  `, [`%${searchPhone}%`]);
  console.log(`Search result for '${searchPhone}':`, searchRes.rows);
  if (searchRes.rows.length === 0 || searchRes.rows[0].id !== testEmp.id) {
    throw new Error('Search by phone number failed');
  }
  console.log('✓ Search by phone number passed');

  console.log('\n========================================');
  console.log('ALL 8/8 BACKEND PROFILE TESTS PASSED SUCCESSFULLY!');
  console.log('========================================');
}

verify()
  .catch((err) => {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
