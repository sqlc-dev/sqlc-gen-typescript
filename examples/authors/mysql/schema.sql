CREATE TABLE authors (
          id   BIGINT PRIMARY KEY AUTO_INCREMENT,
          name text      NOT NULL,
          bio  text
);

CREATE TABLE node_mysql_types (
  c_bit BIT,
  c_tinyint TINYINT,
  c_bool BOOL,
  c_boolean BOOLEAN,
  c_smallint SMALLINT,
  c_mediumint MEDIUMINT,
  c_int INT,
  c_integer INTEGER,
  c_bigint BIGINT,
  c_serial SERIAL,
  c_decimal DECIMAL(2,1),
  c_dec DEC(2,1),
  c_numeric NUMERIC(2,1),
  c_fixed FIXED(2,1),
  c_float FLOAT,
  c_double DOUBLE,
  c_double_precision DOUBLE PRECISION,

  /* 11.2 Date and Time Data Types */
  c_date DATE,
  c_time TIME,
  c_datetime DATETIME,
  c_timestamp TIMESTAMP,
  c_year YEAR,

  /* 11.3.1 String Data Type Syntax */
  c_char CHAR,
  c_nchar NCHAR,
  c_national_char NATIONAL CHAR,
  c_varchar VARCHAR(10),
  c_binary BINARY,
  c_varbinary VARBINARY(10),
  c_tinyblob TINYBLOB,
  c_tinytext TINYTEXT,
  c_blob BLOB,
  c_text TEXT,
  c_mediumblob MEDIUMBLOB,
  c_mediumtext MEDIUMTEXT,
  c_longblob LONGBLOB,
  c_longtext LONGTEXT,
  /* c_enum ENUM('a', 'b', 'c'), */
  /* c_set SET('a', 'b', 'c'), */

  c_json JSON
);

/* https://dev.mysql.com/doc/refman/8.4/en/keywords.html#keywords-8-4-detailed-I */
CREATE TABLE reserved_words (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `key` TEXT,
  `value` TEXT
);
