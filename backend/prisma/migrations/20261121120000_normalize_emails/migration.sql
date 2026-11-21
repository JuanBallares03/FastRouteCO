-- Normalize existing emails so they are stored without surrounding spaces and in lowercase.
UPDATE "users"
SET "email" = lower(btrim("email"))
WHERE "email" <> lower(btrim("email"));

UPDATE "companies"
SET "email" = lower(btrim("email"))
WHERE "email" <> lower(btrim("email"));

-- Enforce case-insensitive uniqueness for accounts. Prisma cannot model expression
-- indexes, so this index exists only in SQL.
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (lower("email"));
