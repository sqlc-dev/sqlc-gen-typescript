import * as mysql from "mysql2/promise";

import {
  createAuthor,
  deleteAuthor,
  getAuthor,
  listAuthors,
} from "./db/query_sql";

interface Author {
  id: string;
  name: string;
  bio: string | null;
}

async function main() {
  const url = new URL(process.env["DATABASE_URL"] ?? "");

  const client = mysql.createPool({
    host: url.hostname,
    port: parseInt(url.port, 10),
    user: url.username,
    password: url.password,
    database: url.pathname.substring(1),
    supportBigNumbers: true,
    bigNumberStrings: true,
    ssl: {
      // TODO: FIXME
      rejectUnauthorized: false,
    },
  });

  // Create an author
  await createAuthor(client, {
    name: "Seal",
    bio: "Kissed from a rose",
  });

  // List the authors
  const authors = await listAuthors(client);
  console.log(authors);

  // Get that author
  const seal = await getAuthor(client, { id: authors[0].id });
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
