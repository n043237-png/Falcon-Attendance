"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeProfileService = exports.MaskHelper = void 0;
exports.calculateProfileCompleteness = calculateProfileCompleteness;
const db_1 = require("../db");
exports.MaskHelper = {
    maskBank(acc) {
        if (!acc || acc.trim().length === 0)
            return null;
        const clean = acc.trim();
        if (clean.length <= 4)
            return 'XXXX' + clean;
        return 'X'.repeat(clean.length - 4) + clean.slice(-4);
    },
    maskAadhaar(aadhaar) {
        if (!aadhaar || aadhaar.trim().length === 0)
            return null;
        const clean = aadhaar.trim().replace(/\s+/g, '');
        if (clean.length <= 4)
            return 'XXXXXXXX' + clean;
        return 'X'.repeat(clean.length - 4) + clean.slice(-4);
    },
    maskPan(pan) {
        if (!pan || pan.trim().length === 0)
            return null;
        const clean = pan.trim().toUpperCase();
        if (clean.length <= 4)
            return 'XXXXXX' + clean;
        // Mask first 6 characters, keep last 4, e.g. ABCDE1234F -> XXXXXX234F
        return 'X'.repeat(clean.length - 4) + clean.slice(-4);
    }
};
function calculateProfileCompleteness(user, profile, documents) {
    const checklist = [
        { name: 'First Name', ok: Boolean(profile?.first_name || user?.name) },
        { name: 'Last Name', ok: Boolean(profile?.last_name) },
        { name: 'Date of Birth', ok: Boolean(profile?.date_of_birth) },
        { name: 'Gender', ok: Boolean(profile?.gender) },
        { name: 'Blood Group', ok: Boolean(profile?.blood_group) },
        { name: 'Marital Status', ok: Boolean(profile?.marital_status) },
        { name: 'Phone / Mobile', ok: Boolean(user?.phone) },
        { name: 'Personal Email', ok: Boolean(profile?.personal_email) },
        { name: 'Current Address', ok: Boolean(profile?.current_address) },
        { name: 'Permanent Address', ok: Boolean(profile?.permanent_address) },
        { name: 'City', ok: Boolean(profile?.city) },
        { name: 'State', ok: Boolean(profile?.state) },
        { name: 'PIN Code', ok: Boolean(profile?.pin_code) },
        { name: 'Emergency Contact Name', ok: Boolean(profile?.emergency_contact_name) },
        { name: 'Emergency Contact Phone', ok: Boolean(profile?.emergency_contact_phone) },
        { name: 'Aadhaar Number', ok: Boolean(profile?.aadhaar_number) },
        { name: 'PAN Number', ok: Boolean(profile?.pan_number) },
        { name: 'Bank Account Number', ok: Boolean(profile?.account_number) },
        { name: 'Bank IFSC Code', ok: Boolean(profile?.ifsc_code) },
        { name: 'Profile Photo', ok: Boolean(user?.profile_photo_url) },
        { name: 'Resume / Documents', ok: documents && documents.length > 0 }
    ];
    const completed = checklist.filter((item) => item.ok).length;
    const percentage = Math.round((completed / checklist.length) * 100);
    const missingFields = checklist.filter((item) => !item.ok).map((item) => item.name);
    return { percentage, missingFields };
}
class EmployeeProfileService {
    /**
     * Ensure employee_profiles row exists for user
     */
    static async ensureProfileExists(userId) {
        const existing = await (0, db_1.query)('SELECT id FROM employee_profiles WHERE user_id = $1', [userId]);
        if (existing.rows.length === 0) {
            const userRes = await (0, db_1.query)('SELECT name FROM users WHERE id = $1', [userId]);
            const name = userRes.rows[0]?.name || '';
            const parts = name.trim().split(/\s+/);
            const firstName = parts[0] || '';
            const lastName = parts.slice(1).join(' ') || '';
            await (0, db_1.query)(`
        INSERT INTO employee_profiles (user_id, first_name, last_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO NOTHING
      `, [userId, firstName, lastName]);
        }
    }
    /**
     * Get employee full profile with masking and documents
     */
    static async getFullProfile(userId, unmaskSensitive = false) {
        await this.ensureProfileExists(userId);
        const userRes = await (0, db_1.query)(`
      SELECT 
        u.id,
        u.employee_id as "employeeId",
        u.employee_code as "employeeCode",
        u.is_custom_employee_id as "isCustomEmployeeId",
        u.name,
        u.email,
        u.phone,
        u.role,
        u.roles,
        u.department,
        u.designation,
        u.status,
        u.joining_date as "joiningDate",
        u.profile_photo_url as "profilePhotoUrl",
        COALESCE(u.job_status, 'Permanent') as "jobStatus",
        u.provisional_start_date as "provisionalStartDate",
        u.provisional_end_date as "provisionalEndDate",
        ep.id as "profileId",
        ep.first_name as "firstName",
        ep.middle_name as "middleName",
        ep.last_name as "lastName",
        ep.date_of_birth as "dateOfBirth",
        ep.gender,
        ep.blood_group as "bloodGroup",
        ep.marital_status as "maritalStatus",
        ep.nationality,
        ep.aadhaar_number as "aadhaarNumber",
        ep.pan_number as "panNumber",
        ep.personal_email as "personalEmail",
        ep.current_address as "currentAddress",
        ep.permanent_address as "permanentAddress",
        ep.city,
        ep.state,
        ep.country,
        ep.pin_code as "pinCode",
        ep.emergency_contact_name as "emergencyContactName",
        ep.emergency_contact_relationship as "emergencyContactRelationship",
        ep.emergency_contact_phone as "emergencyContactPhone",
        ep.emergency_contact_alt_phone as "emergencyContactAltPhone",
        ep.reporting_manager_id as "reportingManagerId",
        ep.employment_type as "employmentType",
        ep.confirmation_date as "confirmationDate",
        ep.shift_assignment as "shiftAssignment",
        ep.office_location_id as "officeLocationId",
        ep.work_mode as "workMode",
        ep.bank_name as "bankName",
        ep.account_holder_name as "accountHolderName",
        ep.account_number as "accountNumber",
        ep.ifsc_code as "ifscCode",
        ep.branch_name as "branchName",
        ep.upi_id as "upiId",
        ep.mother_name as "motherName",
        ep.father_name as "fatherName",
        ep.reporting_manager as "reportingManager",
        COALESCE(ep.reporting_manager, m.name) as "reportingManagerName",
        m.email as "reportingManagerEmail",
        m.employee_id as "reportingManagerEmployeeId",
        o.name as "officeLocationName"
      FROM users u
      LEFT JOIN employee_profiles ep ON u.id = ep.user_id
      LEFT JOIN users m ON ep.reporting_manager_id = m.id
      LEFT JOIN offices o ON ep.office_location_id = o.id
      WHERE u.id = $1
    `, [userId]);
        if (userRes.rows.length === 0) {
            return null;
        }
        const row = userRes.rows[0];
        // Fetch documents
        const docRes = await (0, db_1.query)(`
      SELECT 
        d.id,
        d.document_type as "documentType",
        d.document_title as "documentTitle",
        d.file_url as "fileUrl",
        d.file_name as "fileName",
        d.file_size as "fileSize",
        d.mime_type as "mimeType",
        d.uploaded_by as "uploadedBy",
        u.name as "uploadedByName",
        d.created_at as "createdAt"
      FROM employee_documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.user_id = $1
      ORDER BY d.created_at DESC
    `, [userId]);
        const documents = docRes.rows;
        // Calculate completeness
        const completeness = calculateProfileCompleteness({ name: row.name, phone: row.phone, profile_photo_url: row.profilePhotoUrl }, {
            first_name: row.firstName,
            last_name: row.lastName,
            date_of_birth: row.dateOfBirth,
            gender: row.gender,
            blood_group: row.bloodGroup,
            marital_status: row.maritalStatus,
            personal_email: row.personalEmail,
            current_address: row.currentAddress,
            permanent_address: row.permanentAddress,
            city: row.city,
            state: row.state,
            pin_code: row.pinCode,
            emergency_contact_name: row.emergencyContactName,
            emergency_contact_phone: row.emergencyContactPhone,
            aadhaar_number: row.aadhaarNumber,
            pan_number: row.panNumber,
            account_number: row.accountNumber,
            ifsc_code: row.ifscCode
        }, documents);
        // Update completeness in DB
        await (0, db_1.query)(`
      UPDATE employee_profiles 
      SET profile_completed_percentage = $1, missing_fields = $2
      WHERE user_id = $3
    `, [completeness.percentage, JSON.stringify(completeness.missingFields), userId]);
        // Store raw values for internal sync if needed
        const rawBank = row.accountNumber;
        const rawAadhaar = row.aadhaarNumber;
        const rawPan = row.panNumber;
        if (!unmaskSensitive) {
            row.accountNumber = exports.MaskHelper.maskBank(row.accountNumber);
            row.aadhaarNumber = exports.MaskHelper.maskAadhaar(row.aadhaarNumber);
            row.panNumber = exports.MaskHelper.maskPan(row.panNumber);
            row.isMasked = true;
        }
        else {
            row.isMasked = false;
        }
        return {
            ...row,
            completeness,
            documents,
            rawBank: unmaskSensitive ? rawBank : undefined,
            rawAadhaar: unmaskSensitive ? rawAadhaar : undefined,
            rawPan: unmaskSensitive ? rawPan : undefined
        };
    }
    /**
     * Update profile fields with RBAC check and audit logging
     */
    static async updateProfile(targetUserId, updatedByUserId, role, updates) {
        await this.ensureProfileExists(targetUserId);
        // Fetch existing data for comparison and auditing
        const existing = await this.getFullProfile(targetUserId, true);
        if (!existing) {
            throw new Error('User not found');
        }
        const auditEntries = [];
        // Fields allowed for self-service employee
        const employeeAllowedProfileFields = [
            'personalEmail',
            'currentAddress',
            'emergencyContactName',
            'emergencyContactRelationship',
            'emergencyContactPhone',
            'emergencyContactAltPhone',
            'motherName',
            'fatherName'
        ];
        const employeeAllowedUserFields = ['phone', 'profilePhotoUrl'];
        // Map camelCase to DB column names for employee_profiles
        const profileColMap = {
            firstName: 'first_name',
            middleName: 'middle_name',
            lastName: 'last_name',
            motherName: 'mother_name',
            fatherName: 'father_name',
            dateOfBirth: 'date_of_birth',
            gender: 'gender',
            bloodGroup: 'blood_group',
            maritalStatus: 'marital_status',
            nationality: 'nationality',
            aadhaarNumber: 'aadhaar_number',
            panNumber: 'pan_number',
            personalEmail: 'personal_email',
            currentAddress: 'current_address',
            permanentAddress: 'permanent_address',
            city: 'city',
            state: 'state',
            country: 'country',
            pinCode: 'pin_code',
            emergencyContactName: 'emergency_contact_name',
            emergencyContactRelationship: 'emergency_contact_relationship',
            emergencyContactPhone: 'emergency_contact_phone',
            emergencyContactAltPhone: 'emergency_contact_alt_phone',
            reportingManager: 'reporting_manager',
            reportingManagerId: 'reporting_manager_id',
            employmentType: 'employment_type',
            confirmationDate: 'confirmation_date',
            shiftAssignment: 'shift_assignment',
            officeLocationId: 'office_location_id',
            workMode: 'work_mode',
            bankName: 'bank_name',
            accountHolderName: 'account_holder_name',
            accountNumber: 'account_number',
            ifscCode: 'ifsc_code',
            branchName: 'branch_name',
            upiId: 'upi_id'
        };
        // User table fields mapping
        const userColMap = {
            phone: 'phone',
            profilePhotoUrl: 'profile_photo_url',
            department: 'department',
            designation: 'designation',
            joiningDate: 'joining_date',
            jobStatus: 'job_status',
            status: 'status',
            name: 'name'
        };
        const profileUpdates = {};
        const userUpdates = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value === undefined)
                continue;
            if (role === 'employee') {
                if (employeeAllowedProfileFields.includes(key)) {
                    profileUpdates[key] = value;
                }
                else if (employeeAllowedUserFields.includes(key)) {
                    userUpdates[key] = value;
                }
            }
            else {
                // Admin can update all valid fields
                if (profileColMap[key]) {
                    profileUpdates[key] = value;
                }
                else if (userColMap[key]) {
                    userUpdates[key] = value;
                }
            }
        }
        // Auto-update users.name if admin provided firstName/lastName
        if (role === 'admin' && (profileUpdates.firstName !== undefined || profileUpdates.lastName !== undefined)) {
            const fName = profileUpdates.firstName !== undefined ? profileUpdates.firstName : existing.firstName;
            const lName = profileUpdates.lastName !== undefined ? profileUpdates.lastName : existing.lastName;
            const fullName = `${fName || ''} ${lName || ''}`.trim();
            if (fullName) {
                userUpdates.name = fullName;
            }
        }
        // Aadhaar number normalization & validation
        if (profileUpdates.aadhaarNumber !== undefined && profileUpdates.aadhaarNumber !== null) {
            const raw = String(profileUpdates.aadhaarNumber).trim();
            if (raw === '') {
                profileUpdates.aadhaarNumber = null;
            }
            else if (raw.includes('X') || raw.includes('*')) {
                delete profileUpdates.aadhaarNumber;
            }
            else {
                const digits = raw.replace(/\D/g, '');
                if (digits.length !== 12) {
                    throw new Error('Aadhaar Number must be exactly 12 digits');
                }
                profileUpdates.aadhaarNumber = digits;
            }
        }
        // PAN number normalization & validation
        if (profileUpdates.panNumber !== undefined && profileUpdates.panNumber !== null) {
            const raw = String(profileUpdates.panNumber).trim().toUpperCase();
            if (raw === '') {
                profileUpdates.panNumber = null;
            }
            else if (raw.includes('X') || raw.includes('*')) {
                delete profileUpdates.panNumber;
            }
            else {
                const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
                if (!panRegex.test(raw)) {
                    throw new Error('PAN Number must be a valid 10-character PAN format (e.g. ABCDE1234F)');
                }
                profileUpdates.panNumber = raw;
            }
        }
        // Personal Email normalization & validation
        if (profileUpdates.personalEmail !== undefined && profileUpdates.personalEmail !== null) {
            let raw = String(profileUpdates.personalEmail).trim().toLowerCase();
            if (raw === '') {
                profileUpdates.personalEmail = null;
            }
            else {
                if (!raw.includes('@')) {
                    raw = `${raw}@gmail.com`;
                }
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(raw)) {
                    throw new Error('Personal Email must be a valid email address (e.g. name@gmail.com)');
                }
                profileUpdates.personalEmail = raw;
            }
        }
        // Process employee_profiles updates
        const profileKeys = Object.keys(profileUpdates);
        if (profileKeys.length > 0) {
            const setClauses = ['updated_at = CURRENT_TIMESTAMP'];
            const values = [];
            profileKeys.forEach((key) => {
                const col = profileColMap[key];
                const val = profileUpdates[key];
                const oldVal = existing[key];
                // Audit diff check
                if (String(val ?? '') !== String(oldVal ?? '')) {
                    auditEntries.push({ field: key, oldVal, newVal: val });
                }
                values.push(val === '' ? null : val);
                setClauses.push(`${col} = $${values.length}`);
            });
            values.push(targetUserId);
            await (0, db_1.query)(`
        UPDATE employee_profiles 
        SET ${setClauses.join(', ')}
        WHERE user_id = $${values.length}
      `, values);
        }
        // Process users table updates
        const userKeys = Object.keys(userUpdates);
        if (userKeys.length > 0) {
            const userSetClauses = ['updated_at = CURRENT_TIMESTAMP'];
            const userValues = [];
            userKeys.forEach((key) => {
                const col = userColMap[key];
                const val = userUpdates[key];
                const oldVal = existing[key];
                if (String(val ?? '') !== String(oldVal ?? '')) {
                    auditEntries.push({ field: key, oldVal, newVal: val });
                }
                userValues.push(val === '' ? null : val);
                userSetClauses.push(`${col} = $${userValues.length}`);
            });
            userValues.push(targetUserId);
            await (0, db_1.query)(`
        UPDATE users 
        SET ${userSetClauses.join(', ')}
        WHERE id = $${userValues.length}
      `, userValues);
        }
        // Sync bank details & PAN to employee_salary_profiles if changed
        if (profileUpdates.bankName !== undefined ||
            profileUpdates.accountNumber !== undefined ||
            profileUpdates.ifscCode !== undefined ||
            profileUpdates.panNumber !== undefined) {
            await this.syncToSalaryProfile(targetUserId, {
                bankName: profileUpdates.bankName ?? existing.bankName,
                accountNumber: profileUpdates.accountNumber ?? existing.accountNumber,
                ifscCode: profileUpdates.ifscCode ?? existing.ifscCode,
                panNumber: profileUpdates.panNumber ?? existing.panNumber
            });
        }
        // Insert audit log entries
        for (const entry of auditEntries) {
            const isSensitive = ['accountNumber', 'panNumber', 'aadhaarNumber'].includes(entry.field);
            let maskedOld = entry.oldVal;
            let maskedNew = entry.newVal;
            if (isSensitive) {
                if (entry.field === 'accountNumber') {
                    maskedOld = exports.MaskHelper.maskBank(entry.oldVal);
                    maskedNew = exports.MaskHelper.maskBank(entry.newVal);
                }
                else if (entry.field === 'aadhaarNumber') {
                    maskedOld = exports.MaskHelper.maskAadhaar(entry.oldVal);
                    maskedNew = exports.MaskHelper.maskAadhaar(entry.newVal);
                }
                else if (entry.field === 'panNumber') {
                    maskedOld = exports.MaskHelper.maskPan(entry.oldVal);
                    maskedNew = exports.MaskHelper.maskPan(entry.newVal);
                }
            }
            await (0, db_1.query)(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `, [
                updatedByUserId,
                'PROFILE_FIELD_UPDATED',
                'employee_profile',
                targetUserId,
                JSON.stringify({
                    field: entry.field,
                    oldValue: maskedOld,
                    newValue: maskedNew,
                    targetUserId,
                    role,
                    timestamp: new Date().toISOString()
                })
            ]);
        }
        return await this.getFullProfile(targetUserId, role === 'admin');
    }
    /**
     * Sync bank and tax details to employee_salary_profiles
     */
    static async syncToSalaryProfile(userId, data) {
        try {
            const existing = await (0, db_1.query)('SELECT id FROM employee_salary_profiles WHERE employee_id = $1', [userId]);
            if (existing.rows.length > 0) {
                await (0, db_1.query)(`
          UPDATE employee_salary_profiles
          SET 
            bank_name = COALESCE($1, bank_name),
            account_number = COALESCE($2, account_number),
            ifsc_code = COALESCE($3, ifsc_code),
            pan_number = COALESCE($4, pan_number),
            updated_at = CURRENT_TIMESTAMP
          WHERE employee_id = $5
        `, [data.bankName || null, data.accountNumber || null, data.ifscCode || null, data.panNumber || null, userId]);
            }
            else {
                await (0, db_1.query)(`
          INSERT INTO employee_salary_profiles (
            employee_id, bank_name, account_number, ifsc_code, pan_number, effective_date
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
        `, [userId, data.bankName || null, data.accountNumber || null, data.ifscCode || null, data.panNumber || null]);
            }
        }
        catch (err) {
            console.error('Error syncing to employee_salary_profiles:', err);
        }
    }
    /**
     * Get activity logs for an employee profile
     */
    static async getProfileActivityLogs(targetUserId, limit = 50) {
        const res = await (0, db_1.query)(`
      SELECT 
        a.id,
        a.action,
        a.entity_type as "entityType",
        a.entity_id as "entityId",
        a.metadata,
        a.created_at as "createdAt",
        u.name as "performedByName",
        u.email as "performedByEmail",
        u.role as "performedByRole"
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE (a.entity_type = 'employee_profile' AND a.entity_id = $1)
         OR (a.metadata->>'targetUserId' = $2)
      ORDER BY a.created_at DESC
      LIMIT $3
    `, [targetUserId, String(targetUserId), limit]);
        return res.rows;
    }
}
exports.EmployeeProfileService = EmployeeProfileService;
