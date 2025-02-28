import { SQL } from "bun";

import {
  createAuthor,
  deleteAuthor,
  getAuthor,
  listAuthors,
} from "./db/query_sql";

async function main() {
  const sql = new SQL(); // You can also specify connection options here

  // Create an author
  const author = await createAuthor(sql, {
    name: "Seal",
    bio: "Kissed from a rose",
  });
  if (author === null) {
    throw new Error("author not created");
  }
  console.log(author);

  // List the authors
  const authors = await listAuthors(sql);
  console.log(authors);

  // Get that author
  const seal = await getAuthor(sql, { id: author.id });
  if (seal === null) {
    throw new Error("seal not found");
  }
  console.log(seal);

  // Delete the author
  await deleteAuthor(sql, { id: seal.id });
}

(async () => {
  try {
    await main();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
