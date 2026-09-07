import assert from "node:assert/strict";
import { Database } from "jsr:@db/sqlite";
import {
  createAuthor,
  deleteAuthor,
  getAuthor,
  listAuthors,
} from "../src/db/query_sql.ts";
import {
  createRecord,
  getRecord,
  insertRecord,
  listRecords,
  renameRecord,
} from "./db/query_sql.ts";

const authorSchema = await Deno.readTextFile(
  new URL("../../authors/sqlite/schema.sql", import.meta.url),
);
const recordSchema = await Deno.readTextFile(
  new URL("./fixtures/schema.sql", import.meta.url),
);

function withDatabase(test: (database: Database) => void): void {
  const database = new Database(":memory:", { int64: true });
  try {
    database.exec(authorSchema);
    database.exec(recordSchema);
    test(database);
  } finally {
    database.close();
  }
}

Deno.test("authors support synchronous CRUD, null fields, and missing rows", () => {
  withDatabase((database) => {
    assert.deepEqual(listAuthors(database), []);
    assert.equal(getAuthor(database, { id: 1 }), null);
    assert.equal(createAuthor(database, { name: "Ada", bio: null }), undefined);
    createAuthor(database, { name: "Grace", bio: "Compiler pioneer" });

    const authors = listAuthors(database);
    assert.equal(authors.length, 2);
    assert.equal(authors[0].name, "Ada");
    assert.equal(authors[0].bio, null);
    assert.deepEqual(getAuthor(database, { id: authors[0].id }), authors[0]);

    assert.equal(deleteAuthor(database, { id: authors[0].id }), undefined);
    assert.equal(getAuthor(database, { id: authors[0].id }), null);
    assert.equal(listAuthors(database).length, 1);
  });
});

Deno.test("rows use camelCase and preserve blobs and large integers", () => {
  withDatabase((database) => {
    const payload = new Uint8Array([0, 1, 127, 128, 255]);
    const record = createRecord(database, {
      displayName: "Sample",
      eventCount: 9_007_199_254_740_993n,
      isActive: 1,
      score: 4.5,
      payload,
    });
    assert.ok(record);
    assert.equal(record.displayName, "Sample");
    assert.equal(record.eventCount, 9_007_199_254_740_993n);
    assert.equal(Number(record.isActive), 1);
    assert.equal(record.score, 4.5);
    assert.ok(record.payload instanceof Uint8Array);
    assert.deepEqual(record.payload, payload);
    assert.equal("display_name" in record, false);
    assert.deepEqual(getRecord(database, { id: record.id }), record);
    assert.deepEqual(listRecords(database), [record]);

    renameRecord(database, { id: record.id, displayName: "Renamed" });
    assert.equal(
      getRecord(database, { id: record.id })?.displayName,
      "Renamed",
    );
  });
});

Deno.test("execlastid returns the new row id and supports nullable blobs", () => {
  withDatabase((database) => {
    const id = insertRecord(database, {
      displayName: "Without a blob",
      eventCount: 0,
      isActive: 0,
      score: 0,
      payload: null,
    });
    assert.equal(typeof id, "number");
    assert.equal(getRecord(database, { id })?.payload, null);
  });
});

Deno.test("database transactions roll back generated calls on failure", () => {
  withDatabase((database) => {
    const transaction = database.transaction(() => {
      createAuthor(database, { name: "Rolled back", bio: null });
      const args = {
        displayName: "Duplicate",
        eventCount: 1,
        isActive: 1,
        score: 1,
        payload: null,
      };
      insertRecord(database, args);
      insertRecord(database, args);
    });

    assert.throws(transaction, /constraint failed/);
    assert.deepEqual(listAuthors(database), []);
    assert.deepEqual(listRecords(database), []);

    // A failed statement leaves the connection ready for the next query.
    createAuthor(database, { name: "Committed", bio: null });
    assert.equal(listAuthors(database)[0].name, "Committed");
  });
});
