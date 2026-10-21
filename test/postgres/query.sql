-- name: CreateTicket :exec
insert into ticket (id, title, status, urgent, seats, weight, price, due, created_at, label, tags, meta)
values (
  sqlc.arg(id), sqlc.arg(title), sqlc.arg(status), sqlc.arg(urgent), sqlc.arg(seats),
  sqlc.narg(weight), sqlc.arg(price), sqlc.narg(due), sqlc.arg(created_at),
  sqlc.narg(label), sqlc.arg(tags), sqlc.narg(meta)
);

-- name: GetTicket :one
select id, title, status, urgent, seats, weight, price, due, created_at, label, tags, meta,
       seats > 2 as crowded
from ticket
where id = $1;

-- name: ListTickets :many
select id from ticket
where id = any(sqlc.arg(ids)::uuid[])
  and urgent = sqlc.arg(urgent)
  and seats >= sqlc.arg(min_seats)
  and status = any(sqlc.arg(statuses)::ticket_status[])
order by title;

-- name: SearchTickets :many
select id from ticket
where title like '%' || replace(sqlc.arg(term), '%', '\%') || '%' escape '\'
order by title;

-- name: CountWithBackslash :one
select length('a\b')::integer as len, '`${x}`' as raw;
