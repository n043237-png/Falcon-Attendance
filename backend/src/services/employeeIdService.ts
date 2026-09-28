import { query } from '../db';
import { PoolClient } from 'pg';

export class EmployeeIdService {
  /**
   * Generates the next sequential Employee ID in the format FISPL001, FISPL002, etc.
   * Only auto-generated IDs matching FISPL + digits are considered.
   * Manually entered custom IDs (e.g. CEO001, DIRECTOR01) are strictly ignored.
   */
  public static async getNextEmployeeId(client?: PoolClient): Promise<string> {
    const runner = client ? client.query.bind(client) : query;

    // Find the highest numeric value among valid automatic format IDs
    const res = await runner(`
      SELECT employee_id,
             CAST(SUBSTRING(employee_id FROM '(?i)^FISPL([0-9]+)$') AS INTEGER) as num
      FROM users
      WHERE (is_custom_employee_id IS FALSE OR is_custom_employee_id IS NULL)
        AND employee_id ~* '^FISPL[0-9]+$'
      ORDER BY num DESC
      LIMIT 1
    `);

    let nextNum = 1;
    if (res.rows.length > 0 && res.rows[0].num !== null) {
      nextNum = parseInt(res.rows[0].num, 10) + 1;
    }

    // Ensure generated ID is strictly unique (avoiding any collision with custom IDs)
    while (true) {
      const candidateId = `FISPL${String(nextNum).padStart(3, '0')}`;
      const checkRes = await runner(
        `SELECT id FROM users WHERE LOWER(employee_id) = LOWER($1) OR LOWER(employee_code) = LOWER($1) LIMIT 1`,
        [candidateId]
      );
      if (checkRes.rows.length === 0) {
        return candidateId;
      }
      nextNum++;
    }
  }

  /**
   * Validates an Employee ID for format and case-insensitive uniqueness.
   * - 1 to 20 characters
   * - Letters, numbers, and hyphens only
   * - No spaces
   * - Case-insensitive uniqueness check against database
   */
  public static async validateEmployeeId(
    employeeId: string,
    excludeUserId?: number,
    client?: PoolClient
  ): Promise<{ valid: boolean; message?: string }> {
    if (!employeeId || typeof employeeId !== 'string') {
      return { valid: false, message: 'Employee ID is required.' };
    }

    const trimmed = employeeId.trim();
    if (trimmed.length === 0) {
      return { valid: false, message: 'Employee ID cannot be empty.' };
    }

    if (trimmed.length > 20) {
      return { valid: false, message: 'Employee ID cannot exceed 20 characters.' };
    }

    // Letters, numbers, hyphens only, no spaces
    const formatRegex = /^[A-Za-z0-9-]+$/;
    if (!formatRegex.test(trimmed)) {
      return {
        valid: false,
        message: 'Employee ID can only contain letters, numbers, and hyphens without spaces.',
      };
    }

    // Check case-insensitive uniqueness
    const runner = client ? client.query.bind(client) : query;
    const queryParams: any[] = [trimmed];
    let sql = `
      SELECT id FROM users 
      WHERE (LOWER(employee_id) = LOWER($1) OR LOWER(employee_code) = LOWER($1))
    `;

    if (excludeUserId) {
      queryParams.push(excludeUserId);
      sql += ` AND id != $${queryParams.length}`;
    }

    sql += ' LIMIT 1';

    const checkRes = await runner(sql, queryParams);
    if (checkRes.rows.length > 0) {
      return {
        valid: false,
        message: 'Employee ID already exists. Please choose another Employee ID.',
      };
    }

    return { valid: true };
  }
}
