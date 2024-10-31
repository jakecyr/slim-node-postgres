# Slim Node Postgres

Postgres database class to abstract pooling and prepared statements.

![Another](https://img.shields.io/npm/v/slim-node-postgres.svg)

## Table of Contents

- [Installation](#installation)
- [Download](#download)
- [Example Setup](#example-setup)
- [Usage](#usage)
- [Methods](#methods)
  - [query](#query)
  - [execute](#execute)
  - [insert](#insert)
  - [getOne](#getone)
  - [getValue](#getvalue)
  - [exists](#exists)
- [Testing](#testing)
  - [Unit Tests](#unit-tests)
  - [Functional Tests](#functional-tests)

## Installation

To install the package from npm run:

```bash
npm install slim-node-postgres
```

## Download

[Download the latest Slim Node Postgres package.](https://unpkg.com/slim-node-postgres)

## Example Setup

It is recommended that a single `SlimNodePostgres` instance is used throughout your app so it can effectively manage pooling.

```javascript
const { SlimNodePostgres } = require('slim-node-postgres');

// create new database instance with the Postgres connection string
const database = new SlimNodePostgres(env.database);
```

## Usage

If non-`SELECT` queries are executed, the resulting value will be of the type `ExecuteResult` containing the following properties:

```typescript
interface ExecuteResult {
  affectedRows: number;
  changedRows: number;
}
```

## Methods

### query

```typescript
// returns an array of rows found or an empty array if nothing is found
const data: User[] = await database.query<User>(
  `
  SELECT
      *
  FROM
      User
  WHERE
      id = @id
  `,
  {
    id: 1,
  }
);
```

### execute

Used to run all non-SELECT queries.

Example update:

```typescript
const result: ExecuteResult = await database.execute(
  `
    UPDATE User
    SET username = @username
    WHERE id = @id
  `,
  {
    id: 1,
    username: 'newUsername',
  }
);

console.log(result.affectedRows); // 1
console.log(result.changedRows); // 1
```

### insert

A convenient method for inserting data by specifying the table, columns, and values.

Example insert:

```typescript
const result: ExecuteResult = await database.insert(
  'User',
  ['id', 'username'],
  [3, 'newUsername']
);

console.log(result.affectedRows); // 1
console.log(result.insertId); // The ID of the newly inserted row
console.log(result.changedRows); // 0
```

### getOne

```typescript
// returns an object with data from the matched row or null if no match was found
const data: User | null = await database.getOne<User>(
  `
    SELECT
        *
    FROM
        User
    WHERE
        id = @id
    LIMIT 1
`,
  {
    id: 1,
  }
);
```

### getValue

```typescript
// returns value from column specified (generics are optional)
const username: string | null = await database.getValue<User, 'username'>(
  'username',
  `
    SELECT
        *
    FROM
        User
    WHERE
        id = @id
    LIMIT 1
`,
  {
    id: 1,
  }
);
```

### exists

```typescript
// returns a boolean value depending on if any rows are returned or not
const exists: boolean = await database.exists(
  `
    SELECT *
    FROM User
    WHERE id = @id
    LIMIT 1
`,
  {
    id: 1,
  }
);

console.log(exists); // true
```

## Testing

### Unit Tests

```bash
npm run test
```

### Functional Tests

```bash
CONNECTION_STRING=<TEST DATABASE CONNECTION STRING> ./node_modules/.bin/jest functional-tests/**/*.test.ts --runInBand
```
