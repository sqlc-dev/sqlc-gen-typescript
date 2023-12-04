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

  // Create an author
  const author = await createAuthor(client, {
    name: "Seal",
    bio: "Kissed from a rose",
  });
  if (author === null) {
    throw new Error("author not created");
  }
  console.log(author);

  // List the authors
  const authors = await listAuthors(client);
  console.log(authors);

  // Get that author
  const seal = await getAuthor(client, { id: author.id });
  if (seal === null) {
    throw new Error("seal not found");
  }
  console.log(seal);

  // Delete the author
  await deleteAuthor(client, { id: seal.id });
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
