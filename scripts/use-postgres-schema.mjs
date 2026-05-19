import fs from "node:fs";

const schemaPath = "prisma/schema.prisma";
const schema = fs.readFileSync(schemaPath, "utf8");

if (!schema.includes('provider = "sqlite"')) {
  console.log("Prisma schema is already not using SQLite; leaving it unchanged.");
  process.exit(0);
}

fs.writeFileSync(schemaPath, schema.replace('provider = "sqlite"', 'provider = "postgresql"'));
console.log("Prisma schema provider changed from SQLite to PostgreSQL for deployment.");
