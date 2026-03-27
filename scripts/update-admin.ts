import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  const hash = await bcrypt.hash("pernilo", 12);
  await prisma.user.update({
    where: { email: "admin@armyofme.com" },
    data: { email: "m@armyofme.ai", name: "Marcos", username: "marcos", passwordHash: hash },
  });
  console.log("Updated: m@armyofme.ai / pernilo");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
