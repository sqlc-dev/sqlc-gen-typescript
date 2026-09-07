import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadGenerator } from "./generator.mjs";

const temporary = await mkdtemp(join(tmpdir(), "sqlc-deno-check-"));

try {
  const { codegen, GenerateRequest, Query } = await loadGenerator();
  await writeFile(join(temporary, "deno.json"), JSON.stringify({
    compilerOptions: { strict: true },
    imports: {
      "npm:@types/pg": "npm:@types/pg@8.23.1",
      "npm:@types/better-sqlite3": "npm:@types/better-sqlite3@9.6.0",
      "npm:postgres": "npm:postgres@3.4.9",
      "npm:postgres-interval": "npm:postgres-interval@1.2.0",
      "npm:mysql2/promise": "npm:mysql2@3.24.3/promise",
    },
  }, null, 2));

  const column = (name, type, extra = {}) => ({ name, type: { name: type }, notNull: true, ...extra });
  const paths = [];
  for (const driver of ["pg", "postgres", "mysql2", "better-sqlite3"]) {
    const pg = driver === "pg" || driver === "postgres";
    const binaryType = pg ? "pg_catalog.bytea" : "blob";
    const columns = [
      column("row_id", pg ? "int8" : "bigint"),
      column("image_data", binaryType, { notNull: false }),
      column("display_name", "text"),
    ];
    if (driver === "pg") {
      columns.push(column("time_span", "interval", { isArray: true }));
      columns.push(column("image_list", "pg_catalog.bytea", { isArray: true }));
    }
    const params = [{ number: 1, column: column("image_data", binaryType, { notNull: false }) }];
    const queries = [
      new Query({ name: "FindRow", filename: "query.sql", cmd: ":one", text: "SELECT * FROM rows WHERE image_data = " + (pg ? "$1" : "?"), columns, params }),
      new Query({ name: "ListRows", filename: "query.sql", cmd: ":many", text: "SELECT * FROM rows", columns }),
      new Query({ name: "DeleteRow", filename: "query.sql", cmd: ":exec", text: "DELETE FROM rows WHERE image_data = " + (pg ? "$1" : "?"), params }),
    ];
    if (driver === "mysql2") {
      queries.push(new Query({ name: "InsertRow", filename: "query.sql", cmd: ":execlastid", text: "INSERT INTO rows (image_data) VALUES (?)", params }));
    }
    const result = codegen(new GenerateRequest({
      pluginOptions: new TextEncoder().encode(JSON.stringify({
        driver,
        runtime: "deno",
        mysql2: { support_big_numbers: true, big_number_strings: true },
      })),
      queries,
    }));
    const path = join(temporary, `${driver}.ts`);
    await writeFile(path, result.files.at(-1).contents);
    paths.push(path);
  }

  // Resolve real package declarations: transpilation alone does not check
  // import type syntax or the client signatures used by generated queries.
  execFileSync("deno", ["check", "--config", join(temporary, "deno.json"), ...paths], {
    cwd: temporary,
    stdio: "inherit",
  });
} finally {
  await rm(temporary, { recursive: true, force: true });
}
