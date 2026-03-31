import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter });

  const orgName = process.env.ORG_NAME || "My Organization";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Password123!";

  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: orgName,
      timezone: "UTC",
    },
  });

  console.log("Created organization:", org.name);

  // Create owner user
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const owner = await prisma.user.create({
    data: {
      name: "Admin",
      username: "admin",
      email: adminEmail,
      passwordHash,
      role: "OWNER",
      organizationId: org.id,
    },
  });

  console.log("Created owner user:", owner.email);
  console.log("");
  console.log("=== Login Credentials ===");
  console.log(`Email:    ${adminEmail}`);
  console.log("Password: (the one you set in ADMIN_PASSWORD, or default: Password123!)");
  console.log("=========================");
  console.log("");
  console.log("Change your password after first login.");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
