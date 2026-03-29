import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { SettingsView } from "@/components/settings/settings-view";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your organization settings and integrations."
      />
      <SettingsView role={session.user.role} />
    </>
  );
}
