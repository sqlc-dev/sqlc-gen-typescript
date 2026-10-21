// Runs the code generated in gen/ (sqlc with the database analyzer, see
// sqlc.yaml) against the database in DATABASE_URL, which has schema.sql.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

import {
  countWithBackslash,
  createTicket,
  getTicket,
  listTickets,
  searchTickets,
} from "./gen/query_sql";

const sql = postgres(process.env.DATABASE_URL ?? "", {
  prepare: false,
  max: 1,
  onnotice: () => {},
});

const a = "00000000-0000-4000-8000-00000000000a";
const b = "00000000-0000-4000-8000-00000000000b";

before(async () => {
  await sql`truncate ticket`;
  await createTicket(sql, {
    id: a,
    title: "100% sure",
    status: "open",
    urgent: true,
    seats: 3,
    weight: 1.5,
    price: "10.50",
    due: "2026-10-21",
    createdAt: new Date("2026-10-21T10:00:00.123Z"),
    label: null,
    tags: ["x", "y"],
    meta: { k: 1 },
  });
  await createTicket(sql, {
    id: b,
    title: "plain",
    status: "closed",
    urgent: false,
    seats: 1,
    weight: null,
    price: "1",
    due: null,
    createdAt: "2026-10-21T10:00:00Z",
    label: "l",
    tags: [],
    meta: null,
  });
});

after(async () => {
  await sql.end();
});

test("booleans, integers and enums round-trip", async () => {
  const row = await getTicket(sql, { id: a });
  assert.ok(row);
  assert.equal(row.urgent, true);
  assert.equal(row.seats, 3);
  assert.equal(row.crowded, true);
  assert.equal(row.status, "open");
  assert.equal(row.price, "10.50");
  assert.deepEqual(row.tags, ["x", "y"]);
  assert.deepEqual(row.meta, { k: 1 });
  assert.equal(row.due?.toISOString(), "2026-10-21T00:00:00.000Z");
  assert.equal(row.createdAt.toISOString(), "2026-10-21T10:00:00.123Z");

  const other = await getTicket(sql, { id: b });
  assert.ok(other);
  assert.equal(other.urgent, false);
  assert.equal(other.crowded, false);
  assert.equal(other.due, null);
});

test("array parameters", async () => {
  assert.deepEqual(
    await listTickets(sql, { ids: [a, b], urgent: true, minSeats: 2, statuses: ["open", "closed"] }),
    [{ id: a }]
  );
  assert.deepEqual(
    await listTickets(sql, { ids: [a, b], urgent: false, minSeats: 0, statuses: ["closed"] }),
    [{ id: b }]
  );
});

test("backslashes in a query reach the database", async () => {
  assert.deepEqual(await searchTickets(sql, { term: "%" }), [{ id: a }]);
  assert.deepEqual(await countWithBackslash(sql), { len: 3, raw: "`${x}`" });
});

// Compile-time checks: tsc --noEmit fails if the generated types loosen.
async function types() {
  const row = await getTicket(sql, { id: a });
  if (row) {
    const urgent: boolean = row.urgent;
    const seats: number = row.seats;
    const status: "open" | "closed" = row.status;
    const crowded: boolean = row.crowded;
    void [urgent, seats, status, crowded];
  }
  // @ts-expect-error a boolean parameter takes a boolean, not its text
  await listTickets(sql, { ids: [], urgent: "true", minSeats: 0, statuses: [] });
  // @ts-expect-error an integer parameter takes a number
  await listTickets(sql, { ids: [], urgent: true, minSeats: "0", statuses: [] });
  // @ts-expect-error an enum parameter takes one of its values
  await listTickets(sql, { ids: [], urgent: true, minSeats: 0, statuses: ["pending"] });
}
void types;
