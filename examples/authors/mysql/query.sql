/* name: GetAuthor :one */
SELECT * FROM authors
WHERE id = ? LIMIT 1;

/* name: ListAuthors :many */
SELECT * FROM authors
ORDER BY name;

/* name: CreateAuthor :exec */
/* Create a new author. */
INSERT INTO authors (
  name, bio
) VALUES (
  ?, ?
);

/* name: CreateAuthorReturnId :execlastid */
INSERT INTO authors (
  name, bio
) VALUES (
  ?, ?
);

/* name: DeleteAuthor :exec */
DELETE FROM authors
WHERE id = ?;

/* name: Test :one */
SELECT * FROM node_mysql_types
LIMIT 1;
