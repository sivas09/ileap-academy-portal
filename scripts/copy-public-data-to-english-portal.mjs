import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const tables = [
  "Level",
  "User",
  "PasswordResetToken",
  "StudentProfile",
  "TeacherProfile",
  "TeacherLevel",
  "Topic",
  "Lesson",
  "Resource",
  "Assignment",
  "WritingSubmission",
  "AiPrompt",
  "AiFeedback",
  "Product",
  "ProductResource",
  "Order",
  "OrderItem",
  "Entitlement",
  "AuditLog",
  "SiteContent"
];

function quoteIdent(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function tableExists(schema, table) {
  const rows = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = ${schema}
        AND table_name = ${table}
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

async function countRows(schema, table) {
  return Number((await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM ${quoteIdent(schema)}.${quoteIdent(table)}`))[0]?.count ?? 0);
}

async function copyTable(table) {
  const sourceExists = await tableExists("public", table);
  const targetExists = await tableExists("english_portal", table);

  if (!sourceExists || !targetExists) {
    return { table, skipped: true, sourceExists, targetExists, sourceCount: 0, targetBefore: 0, copied: 0, targetAfter: 0 };
  }

  const sourceCount = await countRows("public", table);
  const targetBefore = await countRows("english_portal", table);
  let copied = 0;

  if (apply && sourceCount > 0) {
    const result = await prisma.$executeRawUnsafe(
      `INSERT INTO "english_portal".${quoteIdent(table)}
       SELECT * FROM "public".${quoteIdent(table)}
       ON CONFLICT DO NOTHING`
    );
    copied = Number(result);
  }

  const targetAfter = apply ? await countRows("english_portal", table) : targetBefore;
  return { table, skipped: false, sourceExists, targetExists, sourceCount, targetBefore, copied, targetAfter };
}

try {
  const searchPath = await prisma.$queryRaw`SHOW search_path`;
  console.log(`Mode: ${apply ? "apply" : "dry-run"}`);
  console.log(`Current search_path: ${searchPath[0]?.search_path ?? "unknown"}`);

  for (const table of tables) {
    const result = await copyTable(table);
    if (result.skipped) {
      console.log(`${table}: skipped sourceExists=${result.sourceExists} targetExists=${result.targetExists}`);
      continue;
    }

    console.log(`${table}: public=${result.sourceCount} english_before=${result.targetBefore} copied=${result.copied} english_after=${result.targetAfter}`);
  }

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to copy data.");
  }
} finally {
  await prisma.$disconnect();
}
