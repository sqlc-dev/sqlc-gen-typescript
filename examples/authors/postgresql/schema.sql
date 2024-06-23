CREATE TYPE authors_role AS ENUM ('admin', 'guest');

CREATE TABLE authors (
  id BIGSERIAL PRIMARY KEY,
  name text NOT NULL,
  bio text,
  role authors_role
);
