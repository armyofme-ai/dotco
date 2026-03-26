"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  CalendarIcon,
  Loader2Icon,
  Trash2Icon,
  CheckIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { TASK_STATUS_OPTIONS } from "@/lib/task-utils";
import type {
  Task,
  ProjectMember,
} from "@/components/projects/project-detail";

// ── Schema ─────────────────────────────────────────────────

const taskSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]),
    startDate: z.date({ error: "Start date is required" }),
    endDate: z.date({ error: "End date is required" }),
    assigneeIds: z.array(z.string()),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

type TaskFormData = z.infer<typeof taskSchema>;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Component ──────────────────────────────────────────────

interface TaskDialogProps {
  projectId: string;
  members: ProjectMember[];
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}

export function TaskDialog({
  projectId,
  members,
  task,
  open,
  onOpenChange,
  onSaved,
}: TaskDialogProps) {
  const isEditing = task !== null;
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "TODO",
      startDate: new Date(),
      endDate: new Date(),
      assigneeIds: [],
    },
  });

  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const assigneeIds = watch("assigneeIds");
  const status = watch("status");

  // Reset form when dialog opens/closes or task changes
  useEffect(() => {
    if (open) {
      if (task) {
        reset({
          title: task.title,
          description: task.description ?? "",
          status: task.status,
          startDate: new Date(task.startDate),
          endDate: new Date(task.endDate),
          assigneeIds: task.assignees.map((a) => a.user.id),
        });
      } else {
        reset({
          title: "",
          description: "",
          status: "TODO",
          startDate: new Date(),
          endDate: new Date(),
          assigneeIds: [],
        });
      }
    }
  }, [open, task, reset]);

  const toggleAssignee = useCallback(
    (userId: string) => {
      const current = assigneeIds;
      if (current.includes(userId)) {
        setValue(
          "assigneeIds",
          current.filter((id) => id !== userId)
        );
      } else {
        setValue("assigneeIds", [...current, userId]);
      }
    },
    [assigneeIds, setValue]
  );

  const onSubmit = useCallback(
    async (data: TaskFormData) => {
      setSubmitting(true);
      try {
        const payload = {
          title: data.title,
          description: data.description || null,
          status: data.status,
          startDate: data.startDate.toISOString(),
          endDate: data.endDate.toISOString(),
          assigneeIds: data.assigneeIds,
        };

        const url = isEditing
          ? `/api/projects/${projectId}/tasks/${task!.id}`
          : `/api/projects/${projectId}/tasks`;

        const res = await fetch(url, {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to save task");
        }

        toast.success(isEditing ? "Task updated" : "Task created");
        await onSaved();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save task"
        );
      } finally {
        setSubmitting(false);
      }
    },
    [isEditing, projectId, task, onSaved]
  );

  const handleDelete = useCallback(async () => {
    if (!task) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${task.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete task");
      toast.success("Task deleted");
      await onSaved();
    } catch {
      toast.error("Failed to delete task");
    } finally {
      setDeleting(false);
    }
  }, [projectId, task, onSaved]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Task" : "Create Task"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the task details below."
              : "Fill in the details to create a new task."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              placeholder="Task title"
              {...register("title")}
              aria-invalid={!!errors.title}
            />
            {errors.title && (
              <p className="text-xs text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              placeholder="Optional description..."
              {...register("description")}
              rows={2}
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) =>
                setValue("status", v as TaskFormData["status"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Popover open={startOpen} onOpenChange={setStartOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    />
                  }
                >
                  <CalendarIcon className="size-3.5 text-muted-foreground" />
                  {startDate ? (
                    format(startDate, "MMM d, yyyy")
                  ) : (
                    <span className="text-muted-foreground">Pick a date</span>
                  )}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        setValue("startDate", date);
                        setStartOpen(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
              {errors.startDate && (
                <p className="text-xs text-destructive">
                  {errors.startDate.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Popover open={endOpen} onOpenChange={setEndOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    />
                  }
                >
                  <CalendarIcon className="size-3.5 text-muted-foreground" />
                  {endDate ? (
                    format(endDate, "MMM d, yyyy")
                  ) : (
                    <span className="text-muted-foreground">Pick a date</span>
                  )}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date) {
                        setValue("endDate", date);
                        setEndOpen(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
              {errors.endDate && (
                <p className="text-xs text-destructive">
                  {errors.endDate.message}
                </p>
              )}
            </div>
          </div>

          {/* Assignees */}
          <div className="space-y-1.5">
            <Label>Assignees</Label>
            {members.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No project members available. Add members from the Overview tab.
              </p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {members.map((member) => {
                  const selected = assigneeIds.includes(member.user.id);
                  return (
                    <button
                      key={member.user.id}
                      type="button"
                      onClick={() => toggleAssignee(member.user.id)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 ${
                        selected ? "bg-muted" : ""
                      }`}
                    >
                      <Avatar size="sm">
                        {member.user.avatar && (
                          <AvatarImage
                            src={member.user.avatar}
                            alt={member.user.name}
                          />
                        )}
                        <AvatarFallback>
                          {getInitials(member.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">
                        {member.user.name}
                      </span>
                      {selected && (
                        <CheckIcon className="size-3.5 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {assigneeIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {assigneeIds.length} assignee
                {assigneeIds.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {/* Footer */}
          <DialogFooter>
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting || submitting}
                className="mr-auto"
              >
                {deleting ? (
                  <Loader2Icon className="size-3 animate-spin" />
                ) : (
                  <Trash2Icon className="size-3" />
                )}
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              <XIcon className="size-3" />
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting || deleting}>
              {submitting && (
                <Loader2Icon className="size-3 animate-spin" />
              )}
              {isEditing ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
