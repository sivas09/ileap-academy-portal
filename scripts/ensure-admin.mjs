import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const firstName = process.env.ADMIN_FIRST_NAME?.trim() || "Admin";
const lastName = process.env.ADMIN_LAST_NAME?.trim() || "User";

if (!email || !password) {
  console.error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  process.exit(1);
}

if (password.length < 8) {
  console.error("ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      firstName,
      lastName,
      role: "ADMIN",
      status: "ACTIVE"
    },
    create: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: "ADMIN",
      status: "ACTIVE"
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true
    }
  });

  console.log(`Admin ready: ${user.email} (${user.role}, ${user.status})`);
} finally {
  await prisma.$disconnect();
}
