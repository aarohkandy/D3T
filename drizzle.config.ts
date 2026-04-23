import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import type { Config } from "drizzle-kit";

const localEnvPath = resolve(process.cwd(), ".env.local");

if (!process.env.DATABASE_URL && existsSync(localEnvPath)) {
  process.loadEnvFile(localEnvPath);
}

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
} satisfies Config;
