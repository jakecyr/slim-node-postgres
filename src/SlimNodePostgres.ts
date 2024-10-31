import { Pool, PoolConfig } from 'pg';
import { PoolAlreadyExistsError } from './errors/PoolAlreadyExistsError';
import { ExecuteResult } from './models/ExecuteResult';
import { PreparedStatementParameters } from './models/PreparedStatementParameters';
import { InsertResult } from './models/InsertResult';

/**
 * The main class for SlimNodePostgres to create a new connection to the database and perform queries.
 */
export class SlimNodePostgres {
  private pool: Pool;
  private config: string | PoolConfig;
  private otherPoolOptions?: PoolConfig;

  constructor(config: string | PoolConfig, otherPoolOptions?: PoolConfig) {
    this.config = config;
    this.otherPoolOptions = otherPoolOptions;
    this.pool = new Pool({
      ...this.otherPoolOptions,
      connectionString: typeof config === 'string' ? config : undefined,
      ...(typeof config !== 'string' ? config : {}),
    });
  }

  /**
   * Check if there is an open pool.
   * @returns true if the pool is open.
   */
  hasOpenPool(): boolean {
    return this.pool != null;
  }

  /**
   * Re-connect to the database if the close method has been called.
   * The constructor auto-connects to the database so this method is only needed if the close method has been called.
   */
  connect() {
    if (this.pool) {
      throw new PoolAlreadyExistsError(
        'The pool has already been initialized. Please close the current pool first or create another instance of SlimNodePostgres.'
      );
    }

    this.pool = new Pool({
      ...this.otherPoolOptions,
      connectionString: typeof this.config === 'string' ? this.config : undefined,
      ...(typeof this.config !== 'string' ? this.config : {}),
    });
  }

  /**
   * Inserts a new record into the specified table.
   * @param tableName The name of the table to insert into.
   * @param columns An array of column names to insert values into.
   * @param values An array of values corresponding to the columns.
   * @returns An ExecuteResult object containing information about the operation.
   */
  async insert(
    tableName: string,
    columns: string[],
    values: any[]
  ): Promise<InsertResult> {
    if (columns.length !== values.length) {
      throw new Error('Columns length must match values length.');
    }

    // Generate the parameter placeholders ($1, $2, ...)
    const placeholders = values.map((_, index) => `$${index + 1}`);

    // Construct the INSERT statement
    const sql = `INSERT INTO ${this.escapeIdentifier(tableName)} (${columns
      .map((col) => this.escapeIdentifier(col))
      .join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`;

    const result = await this.pool.query(sql, values);

    return {
      affectedRows: result.rowCount,
      changedRows: result.rowCount,
      insertId: result.rows.length > 0 ? result.rows[0].id : null,
    };
  }

  /**
   * Executes a create, update, or delete SQL query and returns the result.
   * @param sql SQL to run
   * @param parameters Prepared statement parameters to replace in the SQL (keys should match the "@" in the SQL)
   * @returns An ExecuteResult object.
   */
  async execute(
    sql: string,
    parameters?: PreparedStatementParameters
  ): Promise<ExecuteResult> {
    const preparedStatement = this.prepare(sql, parameters);
    const result = await this.pool.query(
      preparedStatement.preparedSQL,
      preparedStatement.preparedValues
    );
    return {
      affectedRows: result.rowCount,
      changedRows: result.rowCount,
    };
  }

  /**
   * Query the database for a list of records.
   * @param sql The SQL to run to get records.
   * @param parameters The prepared statement parameters to replace in the SQL (keys should match the "@" in the SQL)
   * @returns A list of records.
   */
  async query<TableModel>(
    sql: string,
    parameters?: PreparedStatementParameters
  ): Promise<TableModel[]> {
    const preparedStatement = this.prepare(sql, parameters);
    const result = await this.pool.query(
      preparedStatement.preparedSQL,
      preparedStatement.preparedValues
    );
    return result.rows;
  }

  /**
   * Return a single record from the database or null if no record is found. For large queries, use a LIMIT in the SQL for better performance.
   * @param sql The SQL to run to get a single record.
   * @param parameters The prepared statement parameters to replace in the SQL (keys should match the "@" in the SQL)
   * @returns the record or null.
   */
  async getOne<TableModel>(
    sql: string,
    parameters?: PreparedStatementParameters
  ): Promise<TableModel | null> {
    const data: TableModel[] = await this.query<TableModel>(sql, parameters);
    return data.length > 0 ? data[0] : null;
  }

  /**
   * Get a single value from a record. For large queries, use a LIMIT in the SQL for better performance.
   * @param column the column of the record to return.
   * @param sql the SQL to run to get the record.
   * @param parameters the prepared statement parameters to replace in the SQL (keys should match the "@" in the SQL)
   * @returns the value of the column or null if no record is found.
   */
  async getValue<TableModel, K extends keyof TableModel>(
    column: K,
    sql: string,
    parameters?: PreparedStatementParameters
  ): Promise<TableModel[K] | null> {
    const data = await this.query<TableModel>(sql, parameters);
    return data.length > 0 ? data[0][column] : null;
  }

  /**
   * Check if a given record exists.
   * @param sql SQL to run to check if a record exists.
   * @param parameters Prepared statement parameters to replace in the SQL (keys should match the "@" in the SQL)
   * @returns boolean value if the record exists.
   */
  async exists<TableModel>(
    sql: string,
    parameters?: PreparedStatementParameters
  ): Promise<boolean> {
    const data = await this.query<TableModel>(sql, parameters);
    return data.length > 0;
  }

  /**
   * Close the database pool.
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
    this.pool = null;
  }

  /**
   * Prepares an SQL statement, replacing variables with positional parameters.
   * @param sql The SQL string with variables.
   * @param parameters The parameters to replace in the SQL string.
   * @returns A parsed prepared statement.
   */
  private prepare(sql: string, parameters?: PreparedStatementParameters) {
    let preparedSQL = sql;
    const preparedValues = [];
    let match: RegExpMatchArray;
    let index = 1;

    while ((match = preparedSQL.match(/@([A-Za-z_]+)/))) {
      const variableName = match[0];
      const baseVariableName = match[1];

      if (!parameters || !(baseVariableName in parameters)) {
        throw new Error(
          `Missing prepared statement value for SQL variable '${variableName}'`
        );
      }

      preparedSQL = preparedSQL.replace(variableName, `$${index}`);
      preparedValues.push(parameters[baseVariableName]);
      index++;
    }

    return {
      preparedSQL,
      preparedValues,
    };
  }

  /**
   * Escapes an identifier (e.g., table name or column name) to prevent SQL injection.
   * @param identifier The identifier to escape.
   * @returns The escaped identifier.
   */
  private escapeIdentifier(identifier: string): string {
    // Use double quotes to escape identifiers in PostgreSQL
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}
