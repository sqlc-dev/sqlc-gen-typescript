CREATE TYPE ticket_status AS ENUM ('open', 'closed');

CREATE TABLE ticket (
  id          uuid PRIMARY KEY,
  title       text NOT NULL,
  status      ticket_status NOT NULL,
  urgent      boolean NOT NULL,
  seats       integer NOT NULL,
  weight      double precision,
  price       numeric(12, 2) NOT NULL,
  due         date,
  created_at  timestamp(3) with time zone NOT NULL,
  label       character varying(40),
  tags        text[] NOT NULL,
  meta        jsonb
);
