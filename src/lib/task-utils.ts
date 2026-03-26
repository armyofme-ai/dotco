import type { TaskStatus } from "@/generated/prisma/client";

export const TASK_STATUS_OPTIONS: {
  value: TaskStatus;
  label: string;
  color: string;
}[] = [
  { value: "TODO", label: "To Do", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  { value: "IN_REVIEW", label: "In Review", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  { value: "DONE", label: "Done", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
];

export function getTaskStatusColor(status: TaskStatus): string {
  const option = TASK_STATUS_OPTIONS.find((o) => o.value === status);
  return option?.color ?? "bg-gray-100 text-gray-700";
}

export function getTaskStatusLabel(status: TaskStatus): string {
  const option = TASK_STATUS_OPTIONS.find((o) => o.value === status);
  return option?.label ?? status;
}

export function isOverdue(task: {
  endDate: string | Date;
  status: string;
}): boolean {
  if (task.status === "DONE") return false;
  const end = new Date(task.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return end < today;
}
