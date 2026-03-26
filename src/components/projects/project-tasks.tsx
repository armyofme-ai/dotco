"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  PlusIcon,
  AlertCircleIcon,
  ClipboardListIcon,
  FilterIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { TaskDialog } from "@/components/projects/task-dialog";
import {
  getTaskStatusColor,
  getTaskStatusLabel,
  isOverdue,
  TASK_STATUS_OPTIONS,
} from "@/lib/task-utils";
import type {
  Task,
  ProjectMember,
} from "@/components/projects/project-detail";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface ProjectTasksProps {
  projectId: string;
  tasks: Task[];
  members: ProjectMember[];
  onTasksChanged: () => Promise<void>;
}

const MAX_VISIBLE_AVATARS = 3;

export function ProjectTasks({
  projectId,
  tasks,
  members,
  onTasksChanged,
}: ProjectTasksProps) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter !== "ALL" && task.status !== statusFilter) return false;
      if (
        assigneeFilter !== "ALL" &&
        !task.assignees.some((a) => a.user.id === assigneeFilter)
      )
        return false;
      return true;
    });
  }, [tasks, statusFilter, assigneeFilter]);

  const handleOpenCreate = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingTask(null);
  };

  return (
    <div className="space-y-4 pt-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <FilterIcon className="size-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
            <SelectTrigger className="w-36" size="sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {TASK_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={assigneeFilter} onValueChange={(v) => v && setAssigneeFilter(v)}>
            <SelectTrigger className="w-40" size="sm">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Assignees</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button size="sm" onClick={handleOpenCreate}>
          <PlusIcon className="size-3.5" />
          Add Task
        </Button>
      </div>

      {/* Tasks table */}
      {filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <ClipboardListIcon className="mb-3 size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {tasks.length === 0
              ? "No tasks yet"
              : "No tasks match the current filters"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tasks.length === 0
              ? "Create your first task to get started."
              : "Try adjusting the filters above."}
          </p>
          {tasks.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={handleOpenCreate}
            >
              <PlusIcon className="size-3.5" />
              Create Task
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Assignees</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => {
                const overdue = isOverdue(task);
                const visibleAssignees = task.assignees.slice(
                  0,
                  MAX_VISIBLE_AVATARS
                );
                const extraCount =
                  task.assignees.length - MAX_VISIBLE_AVATARS;

                return (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer"
                    onClick={() => handleOpenEdit(task)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{task.title}</span>
                        {overdue && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            title="Overdue"
                          >
                            <AlertCircleIcon className="size-3" />
                            Overdue
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${getTaskStatusColor(
                          task.status
                        )}`}
                      >
                        {getTaskStatusLabel(task.status)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(task.startDate), "MMM d")}
                        {" - "}
                        {format(new Date(task.endDate), "MMM d, yyyy")}
                      </span>
                    </TableCell>
                    <TableCell>
                      {task.assignees.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Unassigned
                        </span>
                      ) : (
                        <AvatarGroup>
                          {visibleAssignees.map((a) => (
                            <Avatar key={a.id} size="sm">
                              {a.user.avatar && (
                                <AvatarImage
                                  src={a.user.avatar}
                                  alt={a.user.name}
                                />
                              )}
                              <AvatarFallback>
                                {getInitials(a.user.name)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {extraCount > 0 && (
                            <AvatarGroupCount>
                              +{extraCount}
                            </AvatarGroupCount>
                          )}
                        </AvatarGroup>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Task Dialog */}
      <TaskDialog
        projectId={projectId}
        members={members}
        task={editingTask}
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) handleDialogClose();
        }}
        onSaved={async () => {
          handleDialogClose();
          await onTasksChanged();
        }}
      />
    </div>
  );
}
