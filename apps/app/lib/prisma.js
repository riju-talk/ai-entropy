import { PrismaClient } from "@prisma/client"

// One client per server instance (survives hot reloads in dev). Use this in new code.
const globalForPrisma = globalThis
/** @type {PrismaClient} */
export const prisma = globalForPrisma.__entropyPrisma || new PrismaClient({ log: ["error", "warn"] })
if (process.env.NODE_ENV !== "production") globalForPrisma.__entropyPrisma = prisma
