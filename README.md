# sqlc-gen-typescript

> [!CAUTION]
> Here be dragons! This plugin is still in early access. Expect breaking changes, missing functionality, and sub-optimal output. Please report all issues and errors. Good luck!

## Usage

```yaml
version: '2'
plugins:
- name: ts
  wasm:
    url: https://downloads.sqlc.dev/plugin/sqlc-gen-typescript_0.1.3.wasm
    sha256: 287df8f6cc06377d67ad5ba02c9e0f00c585509881434d15ea8bd9fc751a9368
sql:
- schema: "schema.sql"
  queries: "query.sql"
  engine: postgresql
  codegen:
  - out: src/authors
    plugin: ts
    options:
      runtime: node
      driver: postgres
```

## Supported engines and drivers

- PostgreSQL via [pg](https://www.npmjs.com/package/pg) or [postgres](https://www.npmjs.com/package/postgres).
- MySQL via [mysql2](https://www.npmjs.com/package/mysql2).
- SQLite via [sqlite3](https://www.npmjs.com/package/better-sqlite3).

## Getting started

This tutorial assumes that the latest version of sqlc is
[installed](https://docs.sqlc.dev/en/latest/overview/install.html) and ready to use.

We'll generate TypeScript here, but other [language
plugins](https://docs.sqlc.dev/en/latest/reference/language-support.html) are
available. You'll need Bun (or Node.js) installed if you want to build and run a
program with the code sqlc generates, but sqlc itself has no dependencies.

We'll also rely on sqlc's [managed databases](https://docs.sqlc.dev/en/latest/howto/managed-databases.html),
which require a sqlc Cloud project and auth token. You can get those from
the [sqlc Cloud dashboard](https://dashboard.sqlc.dev/). Managed databases are
an optional feature that improves sqlc's query analysis in many cases, but you
can turn it off simply by removing the `cloud` and `database` sections of your
configuration.

### Setting up

Create a new directory called `sqlc-tutorial` and open it up.

Initialize a new package.

```shell
$ bun init
```

sqlc looks for either a `sqlc.(yaml|yml)` or `sqlc.json` file in the current
directory. In our new directory, create a file named `sqlc.yaml` with the
following contents:

```yaml
version: "2"
cloud:
  # Replace <PROJECT_ID> with your project ID from the sqlc Cloud dashboard
  project: "<PROJECT_ID>"
plugins:
- name: ts
  wasm:
    url: https://downloads.sqlc.dev/plugin/sqlc-gen-typescript_0.1.3.wasm
    sha256: 287df8f6cc06377d67ad5ba02c9e0f00c585509881434d15ea8bd9fc751a9368
sql:
  - engine: "postgresql"
    queries: "query.sql"
    schema: "schema.sql"
    database:
      managed: true
    codegen:
    - out: db
      plugin: ts
      options:
        runtime: node
        driver: pg
```

Replace `<PROJECT_ID>` with your project ID from the sqlc Cloud dashboard. It
will look something like `01HA8SZH31HKYE9RR3N3N3TSJM`.

And finally, set the `SQLC_AUTH_TOKEN` environment variable:

```shell
export SQLC_AUTH_TOKEN="<your sqlc auth token>"
```

### Schema and queries

sqlc needs to know your database schema and queries in order to generate code.
In the same directory, create a file named `schema.sql` with the following
content:

```sql
CREATE TABLE authors (
  id   BIGSERIAL PRIMARY KEY,
  name text      NOT NULL,
  bio  text
);
```

Next, create a `query.sql` file with the following five queries:

```sql
-- name: GetAuthor :one
SELECT * FROM authors
WHERE id = $1 LIMIT 1;

-- name: ListAuthors :many
SELECT * FROM authors
ORDER BY name;

-- name: CreateAuthor :one
INSERT INTO authors (
  name, bio
) VALUES (
  $1, $2
)
RETURNING *;

-- name: UpdateAuthor :exec
UPDATE authors
  set name = $2,
  bio = $3
WHERE id = $1;

-- name: DeleteAuthor :exec
DELETE FROM authors
WHERE id = $1;
```

If you prefer, you can alter the `UpdateAuthor` query to return the updated
record:

```sql
-- name: UpdateAuthor :one
UPDATE authors
  set name = $2,
  bio = $3
WHERE id = $1
RETURNING *;
```

### Generating code

You are now ready to generate code. You shouldn't see any output when you run
the `generate` subcommand, unless something goes wrong:

```shell
$ sqlc generate
```

You should now have a `tutorial` subdirectory with three files containing Go
source code. These files comprise a Go package named `tutorial`:

```
├── package.json
├── query.sql
├── schema.sql
├── sqlc.yaml
└── db
    ├── query_sql.ts
```

### Using generated code

You can use your newly-generated code package from any TypeScript program.
Create a file named `index.ts` and add the following contents:

```ts
import { Pool } from "pg";

import {
  createAuthor,
  deleteAuthor,
  getAuthor,
  listAuthors,
} from "./db/query_sql";

async function main() {
  const client = new Pool({ connectionString: process.env["DATABASE_URL"] });
  await client.connect();

  // list all authors
  const authors = await listAuthors(client);
  console.log(authors);

  // create an author
  const author = await createAuthor(client, {
    name: "Anders Hejlsberg",
	bio: "Original author of Turbo Pascal and co-creator of TypeScript",
  });
  if (author === null) {
    throw new Error("author not created");
  }
  console.log(author);

  // get the author we just created
  const anders = await getAuthor(client, { id: author.id });
  if (anders === null) {
    throw new Error("anders not found");
  }
  console.log(anders);

  // delete the author
  await deleteAuthor(client, { id: anders.id });
}

(async () => {
  await main();
  process.exit()
})();
```

Before this code will run you'll need to install the `pg` package:

```shell
$ bun install pg
```

The program should compile without errors. To make that possible, sqlc generates
readable, **idiomatic** TypeScript code that you otherwise would've had to write
yourself. Take a look in `db/query_sql.ts`.

Of course for this program to run successfully you'll need to run after setting
the `DATABASE_URL` environment variable. And your database must have the
`authors` table as defined in `schema.sql`.

```shell
$ DATABASE_URL="$(sqlc createdb)" bun run index.ts
```

```shell
$ bun run index.ts
```

You should now have a working program using sqlc's generated TypeScript source
code, and hopefully can see how you'd use sqlc in your own real-world
applications.

## Configuration

### PostgreSQL and node-postgres

```yaml
version: '2'
plugins:
- name: ts
  wasm:
    url: https://downloads.sqlc.dev/plugin/sqlc-gen-typescript_0.1.3.wasm
    sha256: 287df8f6cc06377d67ad5ba02c9e0f00c585509881434d15ea8bd9fc751a9368
sql:
- schema: "schema.sql"
  queries: "query.sql"
  engine: postgresql
  codegen:
  - out: db
    plugin: ts
    options:
      runtime: node
      driver: pg # npm package name
```

### PostgreSQL and postgres.js

```yaml
version: '2'
plugins:
- name: ts
  wasm:
    url: https://downloads.sqlc.dev/plugin/sqlc-gen-typescript_0.1.3.wasm
    sha256: 287df8f6cc06377d67ad5ba02c9e0f00c585509881434d15ea8bd9fc751a9368
sql:
- schema: "schema.sql"
  queries: "query.sql"
  engine: postgresql
  codegen:
  - out: db
    plugin: ts
    options:
      runtime: node
      driver: postgres # npm package name
```


### MySQL and mysql2

```yaml
version: '2'
plugins:
- name: ts
  wasm:
    url: https://downloads.sqlc.dev/plugin/sqlc-gen-typescript_0.1.3.wasm
    sha256: 287df8f6cc06377d67ad5ba02c9e0f00c585509881434d15ea8bd9fc751a9368
sql:
- schema: "schema.sql"
  queries: "query.sql"
  engine: "mysql"
  codegen:
  - out: db
    plugin: ts
    options:
      runtime: node
      driver: mysql2 # npm package name
```

### SQLite and better-sqlite3 (Beta)

```yaml
version: '2'
plugins:
- name: ts
  wasm:
    url: https://downloads.sqlc.dev/plugin/sqlc-gen-typescript_0.1.3.wasm
    sha256: 287df8f6cc06377d67ad5ba02c9e0f00c585509881434d15ea8bd9fc751a9368
sql:
- schema: "schema.sql"
  queries: "query.sql"
  engine: sqlite
  codegen:
  - out: db
    plugin: ts
    options:
      runtime: node
      driver: better-sqlite3 # npm package name
```

## Strongly typed columns

### Enums

Enum types declared in your schema are generated as string literal union
types, along with a runtime array of their values. No configuration is
required.

```sql
CREATE TYPE status AS ENUM ('active', 'inactive', 'banned');

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  st status NOT NULL
);
```

```ts
export type Status = "active" | "inactive" | "banned";

export const StatusValues: readonly Status[] = ["active", "inactive", "banned"];

export interface GetUserRow {
    id: string;
    st: Status;
}
```

### Type overrides

Use the `overrides` option to map SQL types (including domains and other
custom types) or individual columns to your own TypeScript types. Each entry
matches either a SQL type name (`db_type`) or a single column
(`column: "table.column"`), and emits `ts_type` verbatim. An optional
`import` adds a type-only import to files that use the override.

```yaml
codegen:
- out: db
  plugin: ts
  options:
    runtime: node
    driver: pg
    overrides:
    # Map a domain (or any SQL type) to an imported type
    - db_type: "email"
      ts_type: "Email"
      import:
        path: "./brands"
        name: "Email"
    # Inline branded/nominal types work too
    - db_type: "user_id"
      ts_type: 'string & { readonly __brand: "user_id" }'
    # Give a JSON column a concrete payload type
    - column: "users.meta"
      ts_type: "UserMeta"
      import:
        path: "./brands"
        name: "UserMeta"
```

```ts
import type { Email, UserMeta } from "./brands";

export interface GetUserRow {
    id: string & { readonly __brand: "user_id" };
    email: Email;
    meta: UserMeta | null;
}
```

Column overrides take precedence over `db_type` overrides, which take
precedence over generated enum types and the built-in type mappings.
Nullability and array handling still apply: a nullable overridden column is
emitted as `T | null`, and an array column as `T[]`.

Note that overrides only change the generated *types* — converting values at
runtime (for example, parsing a `numeric` string into a `Big`) is still up to
your driver configuration.

### Types-only generation

Set `types_only: true` to generate only the `Args`/`Row` interfaces, enum
union types, and override imports — no driver imports, query constants, or
query functions. This is useful for sharing database types with a frontend
that never runs the queries itself.

```yaml
codegen:
- out: src/types/db
  plugin: ts
  options:
    runtime: node
    driver: pg
    types_only: true
```

## Development

If you want to build and test sqlc-gen-typescript locally, follow these steps:

1. Clone the repository and install dependencies:
   ```
   git clone https://github.com/sqlc-dev/sqlc-gen-typescript.git
   cd sqlc-gen-typescript
   npm install
   ```

2. Make your desired changes to the codebase. The main source files are located in the `src` directory.

3. If you've made changes that require updating dependencies, run:
   ```
   npm install
   ```

4. Build the WASM plugin:  
Check the `Makefile` for details.
   ```
   make out.js

   # Ensure you have Javy installed and available in your PATH
   make examples/plugin.wasm
   ```

5. To test your local build, create a test project with a `sqlc.yaml` file containing:

   ```yaml
   version: '2'
   plugins:
   - name: ts
     wasm:
       url: file://{path_to_your_local_wasm_file}
       sha256: {sha256_of_your_wasm_file}
   sql:
   - schema: "schema.sql"
     queries: "query.sql"
     engine: {your_database_engine}
     codegen:
     - out: db
       plugin: ts
       options:
         runtime: node
         driver: {your_database_driver}
   ```

   Replace the placeholders with appropriate values for your setup.

6. Run sqlc in your test project to generate TypeScript code using your local plugin build:
   ```
   sqlc generate
   ```

For more details on sqlc development, refer to the sqlc core development guide. This guide provides additional information on setting up and working with sqlc in general, which may be useful for contributors to this project.  
https://docs.sqlc.dev/en/latest/guides/development.html