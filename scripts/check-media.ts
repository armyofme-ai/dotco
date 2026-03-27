import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  const media = await prisma.media.findMany({ where: { meetingId: "cmn8qoply000004ldx344mebv" } });
  console.log("Media records:", media.length);
  console.log(JSON.stringify(media, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
