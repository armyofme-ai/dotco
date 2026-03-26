import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ProfileView } from "@/components/profile/profile-view";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <PageHeader
        title="Profile"
        description="Manage your personal information and account settings."
      />
      <ProfileView
        userId={session.user.id}
        userEmail={session.user.email ?? ""}
        userRole={session.user.role}
      />
    </>
  );
}
