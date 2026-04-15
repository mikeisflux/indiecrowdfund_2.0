// Prisma CLI configuration file.
//
// Replaces the legacy `package.json#prisma` configuration, which is
// deprecated in Prisma 6.13+ and will be removed in Prisma 7.
//
// Only purpose right now: tell the Prisma CLI where our multi-file
// schema folder lives. Everything else (the DATABASE_URL and other
// env vars) still comes from the process environment via the
// `env("...")` directive in prisma/schema/base.prisma — PM2 sets
// those at runtime in production, and developers export them from
// their shell locally.
//
// NOTE: unlike the old package.json#prisma block, `prisma.config.ts`
// does NOT automatically load .env files. If we ever introduce a
// `.env` file that the CLI itself needs to read (e.g. for DATABASE_URL
// during `prisma db push`), wire in `dotenv` here. Today we don't
// need it — `prisma generate` doesn't connect to the DB, and
// `prisma db push`/`prisma validate` are only run from a shell that
// already has DATABASE_URL exported.

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema",
});
