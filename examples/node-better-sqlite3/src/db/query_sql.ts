import { Database } from "better-sqlite3";

export const getAuthorQuery = `-- name: GetAuthor :one
SELECT id, name, bio FROM authors
WHERE id = ? LIMIT 1`;

export interface GetAuthorArgs {
    id: any;
}

export interface GetAuthorRow {
    id: any;
    name: any;
    bio: any | null;
}

export async function getAuthor(database: Database, args: GetAuthorArgs): Promise<GetAuthorRow | null> {
    const stmt = database.prepare(getAuthorQuery);
    const result = await stmt.get(args.id);
    if (result == undefined) {
        return null;
    }
    return result as GetAuthorRow;
}

export const listAuthorsQuery = `-- name: ListAuthors :many
SELECT id, name, bio FROM authors
ORDER BY name`;

export interface ListAuthorsRow {
    id: any;
    name: any;
    bio: any | null;
}

export async function listAuthors(database: Database): Promise<ListAuthorsRow[]> {
    const stmt = database.prepare(listAuthorsQuery);
    const result = await stmt.all();
    return result as ListAuthorsRow[];
}

export const createAuthorQuery = `-- name: CreateAuthor :exec
INSERT INTO authors (
  name, bio
) VALUES (
  ?, ?
)`;

export interface CreateAuthorArgs {
    name: any;
    bio: any | null;
}

export async function createAuthor(database: Database, args: CreateAuthorArgs): Promise<void> {
    const stmt = database.prepare(createAuthorQuery);
    await stmt.run(args.name, args.bio);
}

export const deleteAuthorQuery = `-- name: DeleteAuthor :exec
DELETE FROM authors
WHERE id = ?`;

export interface DeleteAuthorArgs {
    id: any;
}

export async function deleteAuthor(database: Database, args: DeleteAuthorArgs): Promise<void> {
    const stmt = database.prepare(deleteAuthorQuery);
    await stmt.run(args.id);
}

