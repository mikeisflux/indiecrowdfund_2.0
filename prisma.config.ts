// Prisma CLI configuration file.
//
// In Prisma 7 this file is the canonical location for the datasource
// configuration (previously in schema.prisma). The `url`, `directUrl`,
// and `shadowDatabaseUrl` fields in a schema datasource block are
// deprecated in 7.0, so we define the datasource here instead.
//
// Prisma 7 also no longer auto-loads .env files — we have to do it
// ourselves. `import "dotenv/config"` reads .env from the current
// working directory (project root). In production the server sets
// DATABASE_URL via PM2's ecosystem env, so .env may or may not exist
// there and dotenv/config is a no-op if there's nothing to read.
//
// `schema` still points at our multi-file schema folder. Multi-file
// schemas have been GA since 6.7 and remain supported in 7.

import "dotenv/config";
import { defineConfig } from "prisma/config";

// NOTE: we intentionally use `process.env.DATABASE_URL` instead of the
// Prisma `env()` helper. `env()` throws `PrismaConfigEnvError: Missing
// required environment variable` at load time when DATABASE_URL is
// not set — which breaks `prisma generate` during `npm install`
// postinstall in environments that don't carry a DATABASE_URL (CI,
// Docker build images, this dev sandbox). `prisma generate` doesn't
// actually need the URL to produce the TypeScript client; it only
// needs the schema. `process.env.DATABASE_URL` evaluates to
// `undefined` when missing, and Prisma only surfaces that as an error
// on commands that actually talk to the database (`db push`,
// `migrate`, etc.) — exactly what we want.
export default defineConfig({
  schema: "prisma/schema",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
