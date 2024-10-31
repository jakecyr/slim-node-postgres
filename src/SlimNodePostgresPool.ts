import { Pool, PoolConfig } from 'pg';
import { DatabasePool } from './interfaces/Pool';
import { ConnectionConfig } from './models/ConnectionConfig';
import { ExecuteResult } from './models/ExecuteResult';
import { PreparedStatementParameters } from './models/PreparedStatementParameters';
import { PostgresPreparedStatement } from './PostgresPreparedStatement';
import { ConnectionStringParserStrategy } from './parsers/ConnectionStringParserStrategy';

export class SlimNodePostgresPool implements DatabasePool {
  private pool: Pool;

  constructor(config: string | PoolConfig, otherPoolOptions?: PoolConfig) {
    if (typeof config === 'string') {
      const connection: ConnectionConfig =
        ConnectionStringParserStrategy.getParserStrategy(
          config
        ).parseConnectionString(config);

      this.pool = new Pool({
        ...otherPoolOptions,
        host: connection.host,
        user: connection.user,
        password: connection.password,
        database: connection.database,
      });
    } else {
      this.pool = new Pool(config);
    }
  }

  async query<ReturnType>(
    sql: string,
    parameters?: PreparedStatementParameters
  ): Promise<ReturnType[]> {
    if (parameters) {
      return this.queryPrepared<ReturnType>(sql, parameters);
    }

    return this.promiseQuery<ReturnType[]>(sql);
  }

  async execute(
    sql: string,
    parameters?: PreparedStatementParameters
  ): Promise<ExecuteResult> {
    let preparedSQL: string = sql;
    let preparedValues: any[];

    if (parameters) {
      const preparedStatement = new PostgresPreparedStatement(
        this.pool,
        sql,
        parameters
      );
      ({ preparedSQL, preparedValues } = preparedStatement.prepare());
    }

    const result = await this.pool.query(preparedSQL, preparedValues);

    return {
      affectedRows: result.rowCount,
      changedRows: result.rowCount,
      insertId: result.rows.length > 0 ? result.rows[0].id : null,
    };
  }

  async close(): Promise<void> {
    await this.pool?.end();
  }

  private async queryPrepared<ReturnType>(
    sql: string,
    parameters: PreparedStatementParameters
  ): Promise<ReturnType[]> {
    const preparedStatement = new PostgresPreparedStatement(
      this.pool,
      sql,
      parameters
    );
    const { preparedSQL, preparedValues } = preparedStatement.prepare();
    return this.promiseQuery<ReturnType[]>(preparedSQL, preparedValues);
  }

  private async promiseQuery<ReturnType>(
    sql: string,
    preparedValues?: any[]
  ): Promise<ReturnType> {
    const result: any = await this.pool.query<ReturnType>(sql, preparedValues);
    return result.rows;
  }
}
