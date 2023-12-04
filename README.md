# sqlc-gen-typescript

> [!CAUTION]
> Here be dragons! This plugin is still in early access. Expect breaking changes, missing functionality, and sub-optimal output. Please report all issues and errors. Good luck!

## Usage

```yaml
version: '2'
plugins:
- name: ts
  wasm:
    url: https://downloads.sqlc.dev/plugin/sqlc-gen-typescript_0.1.0.wasm
    sha256: c78326f02dfadcc0de61cd77c157aa0985d1f8f446efb8224c4c113ec3718ea0
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
    url: https://downloads.sqlc.dev/plugin/sqlc-gen-typescript_0.1.0.wasm
    sha256: c78326f02dfadcc0de61cd77c157aa0985d1f8f446efb8224c4c113ec3718ea0
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
    url: https://downloads.sqlc.dev/plugin/sqlc-gen-typescript_0.1.0.wasm
    sha256: c78326f02dfadcc0de61cd77c157aa0985d1f8f446efb8224c4c113ec3718ea0
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
    url: https://downloads.sqlc.dev/plugin/sqlc-gen-typescript_0.1.0.wasm
    sha256: c78326f02dfadcc0de61cd77c157aa0985d1f8f446efb8224c4c113ec3718ea0
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
    url: https://downloads.sqlc.dev/plugin/sqlc-gen-typescript_0.1.0.wasm
    sha256: c78326f02dfadcc0de61cd77c157aa0985d1f8f446efb8224c4c113ec3718ea0
sql:
- schema: "schema.sql"
  queries: "query.sql"
  engine: postgresql
  codegen:
  - out: db
    plugin: ts
    options:
      runtime: node
      driver: mysql2 # npm package name
```