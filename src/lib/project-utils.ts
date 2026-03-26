import type { ProjectStatus } from "@/generated/prisma/client";

export const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "BACKLOG", label: "Backlog" },
  { value: "PLANNING", label: "Planning" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "IN_REVIEW", label: "Review" },
  { value: "COMPLETED", label: "Done" },
  { value: "ARCHIVED", label: "Archived" },
];

export function getStatusLabel(status: ProjectStatus): string {
  const option = STATUS_OPTIONS.find((o) => o.value === status);
  return option?.label ?? status;
}

export function getStatusColor(status: ProjectStatus): string {
  const colors: Record<ProjectStatus, string> = {
    BACKLOG: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    PLANNING: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    IN_PROGRESS:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    ON_HOLD:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    IN_REVIEW:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    COMPLETED:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    ARCHIVED:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
  return colors[status] ?? colors.BACKLOG;
}

export function getStatusDotColor(status: ProjectStatus): string {
  const colors: Record<ProjectStatus, string> = {
    BACKLOG: "bg-gray-400",
    PLANNING: "bg-blue-500",
    IN_PROGRESS: "bg-blue-500",
    ON_HOLD: "bg-orange-500",
    IN_REVIEW: "bg-amber-500",
    COMPLETED: "bg-green-500",
    ARCHIVED: "bg-slate-400",
  };
  return colors[status] ?? colors.BACKLOG;
}

export function getStatusBorderColor(status: ProjectStatus): string {
  const colors: Record<ProjectStatus, string> = {
    BACKLOG: "border-t-gray-400",
    PLANNING: "border-t-blue-500",
    IN_PROGRESS: "border-t-amber-500",
    ON_HOLD: "border-t-orange-500",
    IN_REVIEW: "border-t-purple-500",
    COMPLETED: "border-t-green-500",
    ARCHIVED: "border-t-slate-400",
  };
  return colors[status] ?? colors.BACKLOG;
}
