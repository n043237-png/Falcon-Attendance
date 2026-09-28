exports.up = (pgm) => {
  // 1. Create employee_profiles table
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS employee_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      
      -- Personal Information
      first_name VARCHAR(100),
      middle_name VARCHAR(100),
      last_name VARCHAR(100),
      date_of_birth DATE,
      gender VARCHAR(20),
      blood_group VARCHAR(10),
      marital_status VARCHAR(20),
      nationality VARCHAR(50) DEFAULT 'Indian',
      aadhaar_number VARCHAR(20),
      pan_number VARCHAR(20),

      -- Contact Information
      personal_email VARCHAR(150),
      current_address TEXT,
      permanent_address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      country VARCHAR(100) DEFAULT 'India',
      pin_code VARCHAR(20),

      -- Emergency Contact Information
      emergency_contact_name VARCHAR(100),
      emergency_contact_relationship VARCHAR(50),
      emergency_contact_phone VARCHAR(20),
      emergency_contact_alt_phone VARCHAR(20),

      -- Professional Details
      reporting_manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      employment_type VARCHAR(50) DEFAULT 'Full-Time',
      confirmation_date DATE,
      shift_assignment VARCHAR(100) DEFAULT 'General Shift',
      office_location_id INTEGER REFERENCES offices(id) ON DELETE SET NULL,
      work_mode VARCHAR(50) DEFAULT 'Office',

      -- Banking Information
      bank_name VARCHAR(100),
      account_holder_name VARCHAR(150),
      account_number VARCHAR(50),
      ifsc_code VARCHAR(50),
      branch_name VARCHAR(100),
      upi_id VARCHAR(100),

      -- Metadata & Completeness
      profile_completed_percentage INTEGER DEFAULT 0,
      missing_fields JSONB DEFAULT '[]'::jsonb,

      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Indexes for employee_profiles
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_employee_profiles_user_id ON employee_profiles(user_id);
    CREATE INDEX IF NOT EXISTS idx_employee_profiles_reporting_manager ON employee_profiles(reporting_manager_id);
  `);

  // 3. Create employee_documents table
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS employee_documents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_type VARCHAR(50) NOT NULL,
      document_title VARCHAR(255) NOT NULL,
      file_url TEXT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Indexes for employee_documents
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_employee_documents_user_id ON employee_documents(user_id);
    CREATE INDEX IF NOT EXISTS idx_employee_documents_type ON employee_documents(document_type);
  `);

  // 5. Seed profiles for all existing users with available data from users & salary profiles
  pgm.sql(`
    INSERT INTO employee_profiles (
      user_id,
      first_name,
      last_name,
      pan_number,
      bank_name,
      account_number,
      ifsc_code,
      account_holder_name
    )
    SELECT 
      u.id,
      SPLIT_PART(TRIM(u.name), ' ', 1),
      CASE 
        WHEN POSITION(' ' IN TRIM(u.name)) > 0 
        THEN SUBSTRING(TRIM(u.name) FROM POSITION(' ' IN TRIM(u.name)) + 1)
        ELSE ''
      END,
      p.pan_number,
      p.bank_name,
      p.account_number,
      p.ifsc_code,
      CASE WHEN p.account_number IS NOT NULL THEN u.name ELSE NULL END
    FROM users u
    LEFT JOIN employee_salary_profiles p ON u.id = p.employee_id
    ON CONFLICT (user_id) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS employee_documents;`);
  pgm.sql(`DROP TABLE IF EXISTS employee_profiles;`);
};
