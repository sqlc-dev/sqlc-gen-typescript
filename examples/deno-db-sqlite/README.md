# Deno and @db/sqlite

This example runs the shared SQLite author queries with Deno 2 and
[`@db/sqlite`](https://jsr.io/@db/sqlite). It uses an in-memory database and
needs no database server. `deno.json` pins the driver to version `0.13.0`.

To run the checked-in generated code, install Deno 2, then run from this folder:

```sh
deno task check
deno task start
deno task test
```

Node.js and sqlc are not needed to run the example. To regenerate its code,
install sqlc and build the WASM plugin from this source tree. The released
`0.1.3` plugin does not include Deno or `@db/sqlite` support. The source build
uses the repository's existing Node.js/npm and Javy toolchain. Place the
[Javy v1.2.0 executable](https://github.com/bytecodealliance/javy/releases/tag/v1.2.0)
at `./javy`, then run from the repository root:

```sh
npm install
make examples/plugin.wasm
cd examples/deno-db-sqlite
deno task generate
```

`sqlc.yaml` uses the local `../plugin.wasm` build. Once built, generating code
requires only sqlc; the plugin runs as WASM.

The `start` and `test` tasks use `-A` because the driver loads a native SQLite
library through Deno's FFI. On the first run, the driver also downloads and
caches that library. See the
[driver's permission notes](https://jsr.io/@db/sqlite) for more detail.

Generated functions are synchronous, so they work inside `database.transaction`
callbacks. They finalize each prepared statement, return `null` when a `:one`
query finds no row, and return camelCase properties for SQL column names such as
`display_name`. Blobs use `Uint8Array`. The example opens its database with
`{ int64: true }` so large SQLite integers retain their value; generated integer
types allow `number | bigint`.

The tests cover author CRUD, missing rows, nullable values, camelCase results,
blobs, large integers, inserted row IDs, and rollback after a failed query.
