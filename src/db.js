"use strict";

const { PrismaClient } = require("../generated/prisma");

let prisma;

/**
 * Returns a singleton PrismaClient instance.
 * In development, reuses the instance across hot reloads to avoid
 * exhausting the connection pool.
 */
function getClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  }
  return prisma;
}

module.exports = { getClient };
