"use client";

import { useCallback, useState } from "react";
import {
  CheckCircle2Icon,
  ClipboardListIcon,
  CalendarIcon,
  PlusIcon,
  XIcon,
  Loader2Icon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { AddMemberDialog } from "@/components/projects/add-member-dialog";
import type { Project } from "@/components/projects/project-detail";

const PROJECT_STATUS_OPTIONS = [
  { value: "BACKLOG", label: "Backlog" },
  { value: "PLANNING", label: "Planning" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ARCHIVED", label: "Archived" },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface ProjectOverviewProps {
  project: Project;
  totalTasks: number;
  completedTasks: number;
  onProjectUpdated: () => Promise<void>;
  onMembersChanged: () => Promise<void>;
}

export function ProjectOverview({
  project,
  totalTasks,
  completedTasks,
  onProjectUpdated,
  onMembersChanged,
}: ProjectOverviewProps) {
  const [description, setDescription] = useState(project.description ?? "");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  const handleSaveDescription = useCallback(async () => {
    setSavingDesc(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success("Description updated");
      setIsEditingDesc(false);
      await onProjectUpdated();
    } catch {
      toast.error("Failed to update description");
    } finally {
      setSavingDesc(false);
    }
  }, [project.id, description, onProjectUpdated]);

  const handleStatusChange = useCallback(
    async (value: string | null) => {
      if (!value) return;
      setSavingStatus(true);
      try {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: value }),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast.success("Status updated");
        await onProjectUpdated();
      } catch {
        toast.error("Failed to update status");
      } finally {
        setSavingStatus(false);
      }
    },
    [project.id, onProjectUpdated]
  );

  const handleRemoveMember = useCallback(
    async (memberId: string) => {
      setRemovingMember(memberId);
      try {
        const res = await fetch(
          `/api/projects/${project.id}/members/${memberId}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Failed to remove");
        toast.success("Member removed");
        await onMembersChanged();
      } catch {
        toast.error("Failed to remove member");
      } finally {
        setRemovingMember(null);
      }
    },
    [project.id, onMembersChanged]
  );

  return (
    <div className="space-y-6 pt-4">
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Total Tasks</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ClipboardListIcon className="size-5 text-muted-foreground" />
              {totalTasks}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Completed</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CheckCircle2Icon className="size-5 text-green-600" />
              {completedTasks}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Meetings</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CalendarIcon className="size-5 text-muted-foreground" />
              {project._count.meetings}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Project details */}
      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={project.status}
              onValueChange={handleStatusChange}
              disabled={savingStatus}
            >
              <SelectTrigger className="w-48">
                <SelectValue>
                  {PROJECT_STATUS_OPTIONS.find((o) => o.value === project.status)?.label ?? project.status}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Description</Label>
              {!isEditingDesc && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setDescription(project.description ?? "");
                    setIsEditingDesc(true);
                  }}
                >
                  Edit
                </Button>
              )}
            </div>
            {isEditingDesc ? (
              <div className="space-y-2">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a project description..."
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveDescription}
                    disabled={savingDesc}
                  >
                    {savingDesc && (
                      <Loader2Icon className="size-3 animate-spin" />
                    )}
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingDesc(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {project.description || "No description provided."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Participants */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Participants</CardTitle>
              <span className="text-sm text-muted-foreground">
                ({project.members.length})
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddMemberOpen(true)}
            >
              <PlusIcon className="size-3.5" />
              Add Member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {project.members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <UsersIcon className="mb-2 size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No members yet. Add team members to this project.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {project.members.map((member) => (
                <div
                  key={member.id}
                  className="group relative flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <Avatar size="default">
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.user.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{member.user.username}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={removingMember === member.id}
                  >
                    {removingMember === member.id ? (
                      <Loader2Icon className="size-3 animate-spin" />
                    ) : (
                      <XIcon className="size-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <AddMemberDialog
        projectId={project.id}
        existingMemberIds={project.members.map((m) => m.user.id)}
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        onMemberAdded={onMembersChanged}
      />
    </div>
  );
}
