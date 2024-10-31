/**
 * Result of running an INSERT, UPDATE, DELETE query.
 */
export interface InsertResult {
  /**
   * Number of rows affected by the SQL statement (INSERT, UPDATE, DELETE).
   */
  affectedRows: number;

  /**
   * Number of existing rows that have been modified by the SQL statement.
   */
  changedRows: number;

  /**
   * ID of the inserted record.
   */
  insertId: number;
}
