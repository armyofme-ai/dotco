import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter });

  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: "Army of Me",
      timezone: "America/New_York",
    },
  });

  console.log("Created organization:", org.name);

  // Create owner user
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const owner = await prisma.user.create({
    data: {
      name: "Admin",
      username: "admin",
      email: "admin@armyofme.com",
      passwordHash,
      role: "OWNER",
      organizationId: org.id,
    },
  });

  console.log("Created owner user:", owner.email);
  console.log("");
  console.log("=== Login Credentials ===");
  console.log("Email:    admin@armyofme.com");
  console.log("Password: Password123!");
  console.log("=========================");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
