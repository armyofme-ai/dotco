import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/sidebar";
import { MobileSidebar } from "@/components/mobile-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const org = await prisma.organization.findFirst({
    where: { id: session.user.organizationId },
    select: { name: true },
  });

  const user = {
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role ?? "",
    avatar: null as string | null,
  };

  const orgName = org?.name ?? "AoM";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar user={user} orgName={orgName} />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-12 items-center gap-3 px-4 md:hidden">
          <MobileSidebar user={user} orgName={orgName} />
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-foreground text-[10px] font-bold text-background">
              {orgName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-foreground">
              {orgName}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-6 py-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
