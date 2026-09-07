-- name: CreateRecord :one
INSERT INTO records (display_name, event_count, is_active, score, payload)
VALUES (?, ?, ?, ?, ?)
RETURNING *;

-- name: GetRecord :one
SELECT * FROM records WHERE id = ?;

-- name: ListRecords :many
SELECT * FROM records ORDER BY display_name;

-- name: InsertRecord :execlastid
INSERT INTO records (display_name, event_count, is_active, score, payload)
VALUES (?, ?, ?, ?, ?);

-- name: RenameRecord :exec
UPDATE records SET display_name = ? WHERE id = ?;
