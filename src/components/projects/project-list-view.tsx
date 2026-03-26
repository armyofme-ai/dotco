"use client";

import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { format } from "date-fns";

import { getStatusDotColor, getStatusLabel } from "@/lib/project-utils";
import { cn } from "@/lib/utils";
import type { ProjectData } from "@/components/projects/projects-view";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-cyan-600",
  "bg-fuchsia-600",
  "bg-lime-600",
  "bg-indigo-600",
  "bg-orange-600",
];

function hashToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface ProjectListViewProps {
  projects: ProjectData[];
}

export function ProjectListView({ projects }: ProjectListViewProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-20 text-center">
        <FolderOpen className="mb-3 size-10 text-gray-300" />
        <h3 className="text-sm font-medium text-gray-800">No projects yet</h3>
        <p className="mt-1 text-xs text-gray-400">
          Create your first project to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => {
        const initials = getInitials(project.name);
        const avatarColor = hashToColor(project.id);
        const dateStr = format(new Date(project.updatedAt), "MMM d");

        return (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="group/link rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="h-full rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all group-hover/link:shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
              {/* Title + dot */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 text-sm font-medium leading-snug text-gray-900">
                  {project.name}
                </h3>
                <span
                  className={cn(
                    "mt-1 size-2.5 shrink-0 rounded-full",
                    getStatusDotColor(project.status)
                  )}
                />
              </div>

              {/* Description */}
              {project.description ? (
                <p className="mt-1.5 line-clamp-2 text-xs text-gray-400">
                  {project.description}
                </p>
              ) : (
                <p className="mt-1.5 text-xs italic text-gray-300">
                  No description
                </p>
              )}

              {/* Status label */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {getStatusLabel(project.status)}
                </span>
                {(project._count?.tasks ?? 0) > 0 && (
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {project._count?.tasks} tasks
                  </span>
                )}
              </div>

              {/* Footer: avatar + date */}
              <div className="mt-3 flex items-center justify-between">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-[10px] font-semibold text-white",
                    avatarColor
                  )}
                >
                  {initials}
                </div>
                <span className="text-xs text-gray-400">{dateStr}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
