import { ConnectionStringParseError } from '../errors/ConnectionStringParseError';
import { ConnectionStringParser } from '../interfaces/ConnectionStringParser';
import { PostgresConnectionStringParser } from './MySQLConnectionStringParser';

export class ConnectionStringParserStrategy {
  public static getParserStrategy(connectionString: string): ConnectionStringParser {
    if (connectionString.startsWith('mysql://')) {
      return new PostgresConnectionStringParser();
    } else {
      throw new ConnectionStringParseError('No parser for connection string type');
    }
  }
}
