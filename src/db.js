"use strict";

const path = require("path");
const { PrismaClient } = require("../generated/prisma");

// Default SQLite database URL (file in repo root data/ dir)
const defaultDbUrl = "file:" + path.resolve(__dirname, "..", "data", "callguard.db");

let prisma;

/**
 * Returns a singleton PrismaClient instance.
 * In development, reuses the instance across hot reloads to avoid
 * exhausting the connection pool.
 */
function getClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL || defaultDbUrl,
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  }
  return prisma;
}

module.exports = { getClient };
