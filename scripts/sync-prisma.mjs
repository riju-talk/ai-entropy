// apps/app/prisma/schema.prisma is the single source of truth. The FastAPI service needs the same
// models with the Python client generator, so derive its schema instead of maintaining two copies.
//   node scripts/sync-prisma.mjs          write apps/ai-agent/prisma/schema.prisma
//   node scripts/sync-prisma.mjs --check  exit 1 if it is out of date (used in CI)
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const src = path.join(root, "apps/app/prisma/schema.prisma")
const dst = path.join(root, "apps/ai-agent/prisma/schema.prisma")

const pyGenerator = `generator client {
  provider             = "prisma-client-py"
  interface            = "asyncio"
  recursive_type_depth = "2"
  binaryTargets        = ["native", "rhel-openssl-3.0.x"]
}`

const text = readFileSync(src, "utf8").replace(/\r\n/g, "\n")
const next = text.replace(/generator client \{[^}]*\}/, pyGenerator)
if (next === text) throw new Error("generator block not found in app schema")

if (process.argv.includes("--check")) {
  const cur = existsSync(dst) ? readFileSync(dst, "utf8").replace(/\r\n/g, "\n") : ""
  if (cur !== next) {
    console.error("apps/ai-agent/prisma/schema.prisma is out of date. Run: npm run db:sync")
    process.exit(1)
  }
  console.log("prisma schemas in sync")
} else {
  writeFileSync(dst, next)
  console.log("wrote", path.relative(root, dst))
}
