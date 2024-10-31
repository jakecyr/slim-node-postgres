import { ExecuteResult } from '../src/models/ExecuteResult';
import { InsertResult } from '../src/models/InsertResult';
import { SlimNodePostgres } from '../src/SlimNodePostgres';

const CONNECTION_STRING = process.env.CONNECTION_STRING;

if (!CONNECTION_STRING) {
  throw new Error('CONNECTION_STRING must be set');
}

interface TempTable {
  id: number;
  name: string;
}

const tempTableName = 'temptable';

describe('SlimNodePostgres', () => {
  let db: SlimNodePostgres;

  beforeAll(async () => {
    db = new SlimNodePostgres(CONNECTION_STRING);

    try {
      await db.execute(
        `CREATE TABLE IF NOT EXISTS ${tempTableName} (id SERIAL PRIMARY KEY, name VARCHAR(255))`
      );
    } catch (e) {
      console.error('Error during table creation', e);
    }
  });

  beforeEach(async () => {
    if (db) {
      await db.close();
    }
    db = new SlimNodePostgres(CONNECTION_STRING);
  });

  afterEach(async () => {
    await db.execute(`DELETE FROM ${tempTableName}`);
    await db.close();
  });

  afterAll(async () => {
    db = new SlimNodePostgres(CONNECTION_STRING);

    await db.execute(`DROP TABLE IF EXISTS ${tempTableName}`);
    await db.close();
  });

  describe('execute', () => {
    it('should run an insert and return an execute result', async () => {
      const result: InsertResult = await db.insert(
        tempTableName,
        ['name'],
        ['test']
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('affectedRows');
      expect(result).toHaveProperty('insertId');
      expect(result.insertId).toEqual(1);
      expect(result.affectedRows).toEqual(1);
    });

    it('should run an update and return an execute result', async () => {
      await db.insert(tempTableName, ['id', 'name'], [1, 'test']);

      const updateResult: ExecuteResult = await db.execute(
        `update ${tempTableName} set name = @name where id = @id`,
        {
          id: 1,
          name: 'test2',
        }
      );

      expect(updateResult).toBeDefined();
      expect(updateResult).toHaveProperty('affectedRows');
      expect(updateResult.affectedRows).toEqual(1);
      expect(updateResult.changedRows).toEqual(1);
    });

    it('returns the correct object for a delete', async () => {
      await db.insert(tempTableName, ['id', 'name'], [1, 'test']);

      const deletionResult = await db.execute(
        `delete from ${tempTableName} where id = 1`
      );

      expect(deletionResult).toBeDefined();
      expect(deletionResult).toHaveProperty('affectedRows');
      expect(deletionResult.affectedRows).toEqual(1);

      const itemExistsFalse = await db.exists(
        `select * from ${tempTableName} where id = 1`
      );

      expect(itemExistsFalse).toBeFalsy();
    });
  });

  describe('query', () => {
    it('queries without prepared statement and returns an array', async () => {
      const name = 'test';

      await db.insert(tempTableName, ['id', 'name'], [1, name]);

      const queryValues = await db.query<TempTable>(
        `select * from ${tempTableName}`
      );

      expect(queryValues.length === 1 && queryValues[0].name === name).toBeTruthy();
    });

    it('queries with prepared statement and returns an array', async () => {
      const id = 1;
      const name = 'test2';

      await db.insert(tempTableName, ['id', 'name'], [id, name]);

      const queryValuesWithParams = await db.query<TempTable>(
        `
          select * from ${tempTableName}
          where id = @id and name = @name
        `,
        {
          id,
          name,
        }
      );

      expect(queryValuesWithParams).toHaveLength(1);
      expect(queryValuesWithParams[0]).toHaveProperty('id');
      expect(queryValuesWithParams[0]).toHaveProperty('name');
      expect(queryValuesWithParams[0].id).toEqual(id);
      expect(queryValuesWithParams[0].name).toEqual(name);
    });
  });

  describe('getValue', () => {
    it('returns the correct value', async () => {
      await db.insert(tempTableName, ['id', 'name'], [1, 'test']);

      const value: string | null = await db.getValue<TempTable, 'name'>(
        'name',
        `select * from ${tempTableName} limit 1`
      );

      expect(value).toEqual('test');
    });
  });

  describe('hasOpenPool', () => {
    it('should be toggled based on pool status', async () => {
      expect(db.hasOpenPool()).toBeTruthy();

      await db.close();

      expect(db.hasOpenPool()).toBeFalsy();

      db.connect();

      expect(db.hasOpenPool()).toBeTruthy();
    });
  });

  describe('exists', () => {
    it('returns true if the item exists', async () => {
      await db.insert(tempTableName, ['name'], ['test']);

      expect(
        db.exists(`select * from ${tempTableName} where name = 'test'`)
      ).resolves.toBeTruthy();
    });

    it('returns false if the item does not exist', async () => {
      await db.insert(tempTableName, ['name'], ['test']);

      expect(
        db.exists(`select * from ${tempTableName} where name = 'FAKE'`)
      ).resolves.toBeFalsy();
    });
  });
});
