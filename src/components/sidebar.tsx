"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Calendar, CheckSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/user-menu";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const navItems: NavItem[] = [
  {
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    label: "Meetings",
    href: "/meetings",
    icon: Calendar,
  },
  {
    label: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

interface SidebarProps {
  user: {
    name: string;
    email: string;
    role: string;
    avatar?: string | null;
  };
  orgName: string;
}

export function Sidebar({ user, orgName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[220px] flex-col bg-sidebar">
      {/* Organization name */}
      <div className="flex h-14 items-center px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-foreground text-[11px] font-bold text-background">
            {orgName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-sidebar-foreground">
            {orgName}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-2.5 pt-1">
        {navItems
          .filter(
            (item) => !item.roles || item.roles.includes(user.role)
          )
          .map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="size-[15px] shrink-0" />
                {item.label}
              </Link>
            );
          })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border/60 p-2.5">
        <UserMenu user={user} />
      </div>
    </aside>
  );
}
