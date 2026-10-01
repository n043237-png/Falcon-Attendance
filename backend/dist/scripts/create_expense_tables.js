"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
async function migrate() {
    console.log('--- 🚀 Running Expense & Advance Requests Migration ---');
    // 1. Advance Requests Table
    await (0, db_1.query)(`
    CREATE TABLE IF NOT EXISTS project_advance_requests (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_name VARCHAR(150) NOT NULL,
      client_name VARCHAR(150),
      purpose TEXT NOT NULL,
      amount_requested NUMERIC(12, 2) NOT NULL,
      required_date DATE NOT NULL,
      employee_remarks TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      admin_remarks TEXT,
      approved_by INTEGER REFERENCES users(id),
      approved_at TIMESTAMP WITH TIME ZONE,
      paid_by INTEGER REFERENCES users(id),
      paid_at TIMESTAMP WITH TIME ZONE,
      payment_reference VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
    console.log('✓ Created/verified project_advance_requests table');
    // 2. Expense Requests Table
    await (0, db_1.query)(`
    CREATE TABLE IF NOT EXISTS project_expense_requests (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      advance_id INTEGER REFERENCES project_advance_requests(id) ON DELETE SET NULL,
      project_name VARCHAR(150) NOT NULL,
      client_name VARCHAR(150),
      expense_category VARCHAR(50) NOT NULL,
      expense_date DATE NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      description TEXT NOT NULL,
      payment_method VARCHAR(50) DEFAULT 'Cash',
      employee_remarks TEXT,
      receipt_url TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      admin_remarks TEXT,
      approved_by INTEGER REFERENCES users(id),
      approved_at TIMESTAMP WITH TIME ZONE,
      reimbursed_by INTEGER REFERENCES users(id),
      reimbursed_at TIMESTAMP WITH TIME ZONE,
      reimbursement_reference VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
    console.log('✓ Created/verified project_expense_requests table');
    // 3. Supporting Documents Table
    await (0, db_1.query)(`
    CREATE TABLE IF NOT EXISTS project_expense_documents (
      id SERIAL PRIMARY KEY,
      expense_id INTEGER NOT NULL REFERENCES project_expense_requests(id) ON DELETE CASCADE,
      file_name VARCHAR(255) NOT NULL,
      file_url VARCHAR(500) NOT NULL,
      file_type VARCHAR(50) DEFAULT 'RECEIPT',
      mime_type VARCHAR(100),
      file_size INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
    console.log('✓ Created/verified project_expense_documents table');
    // 4. Indexes for fast lookup
    await (0, db_1.query)(`
    CREATE INDEX IF NOT EXISTS idx_adv_emp_id ON project_advance_requests(employee_id);
    CREATE INDEX IF NOT EXISTS idx_adv_status ON project_advance_requests(status);
    CREATE INDEX IF NOT EXISTS idx_adv_project ON project_advance_requests(project_name);
    CREATE INDEX IF NOT EXISTS idx_exp_emp_id ON project_expense_requests(employee_id);
    CREATE INDEX IF NOT EXISTS idx_exp_status ON project_expense_requests(status);
    CREATE INDEX IF NOT EXISTS idx_exp_category ON project_expense_requests(expense_category);
    CREATE INDEX IF NOT EXISTS idx_exp_project ON project_expense_requests(project_name);
    CREATE INDEX IF NOT EXISTS idx_exp_date ON project_expense_requests(expense_date);
    CREATE INDEX IF NOT EXISTS idx_exp_docs_expense ON project_expense_documents(expense_id);
  `);
    console.log('✓ Created performance indexes');
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
}
migrate().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
