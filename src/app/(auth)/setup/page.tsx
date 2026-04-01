import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured } from "@/lib/storage";
import { SetupForm } from "./setup-form";

export default async function SetupPage() {
  const userCount = await prisma.user.count();
  if (userCount > 0) redirect("/login");

  return <SetupForm storageConfigured={isStorageConfigured()} />;
}
