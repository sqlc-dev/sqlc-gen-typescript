import { Database } from "jsr:@db/sqlite";
import {
  createAuthor,
  deleteAuthor,
  getAuthor,
  listAuthors,
} from "./db/query_sql.ts";

const schema = await Deno.readTextFile(
  new URL("../../authors/sqlite/schema.sql", import.meta.url),
);
const database = new Database(":memory:", { int64: true });

try {
  database.exec(schema);

  // Generated functions run in the same synchronous transaction.
  database.transaction(() => {
    createAuthor(database, {
      name: "Anders Hejlsberg",
      bio: "Co-creator of TypeScript",
    });
    createAuthor(database, { name: "Ada Lovelace", bio: null });
  })();

  const authors = listAuthors(database);
  console.log(authors);

  const author = getAuthor(database, { id: authors[0].id });
  if (author === null) {
    throw new Error("Author not found");
  }
  console.log(author);

  deleteAuthor(database, { id: author.id });
  console.log("After deletion:", getAuthor(database, { id: author.id }));
} finally {
  database.close();
}
