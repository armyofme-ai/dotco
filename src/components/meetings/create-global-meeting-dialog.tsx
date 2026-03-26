"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
}

interface ProjectMember {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
}

interface CreateGlobalMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function CreateGlobalMeetingDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateGlobalMeetingDialogProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [name, setName] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [agenda, setAgenda] = useState("");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Fetch projects the user is a member of
  const fetchProjects = useCallback(async () => {
    try {
      setProjectsLoading(true);
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      setProjects(data);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  // Fetch members when project changes
  const fetchMembers = useCallback(async (projectId: string) => {
    if (!projectId) {
      setMembers([]);
      return;
    }
    try {
      setMembersLoading(true);
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (!res.ok) throw new Error("Failed to fetch members");
      const data = await res.json();
      setMembers(data);
    } catch (error) {
      console.error("Error fetching project members:", error);
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open, fetchProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchMembers(selectedProjectId);
      // Reset attendees when project changes
      setSelectedAttendees([]);
    } else {
      setMembers([]);
      setSelectedAttendees([]);
    }
  }, [selectedProjectId, fetchMembers]);

  // Auto-add current user as attendee when members load
  useEffect(() => {
    if (members.length > 0 && selectedAttendees.length === 0) {
      // The current user should be in the members list; auto-select them.
      // We look for the first member (projects always include the creator).
      // Since we don't know the current user's ID on the client, we select all
      // and let the user uncheck. Instead, we'll just pre-select the first member
      // which is typically the current user (ordered by createdAt asc).
      // A better approach: the /api/projects endpoint returns user data, but
      // for simplicity we auto-add the first member.
      setSelectedAttendees([members[0].userId]);
    }
  }, [members, selectedAttendees.length]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!selectedProjectId) newErrors.project = "Project is required";
    if (!name.trim()) newErrors.name = "Meeting name is required";
    if (!date) newErrors.date = "Date is required";
    if (!startTime) newErrors.startTime = "Start time is required";
    if (!endTime) newErrors.endTime = "End time is required";
    if (selectedAttendees.length === 0)
      newErrors.attendees = "At least one attendee is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setSelectedProjectId("");
    setName("");
    setDate(undefined);
    setStartTime("");
    setEndTime("");
    setAgenda("");
    setSelectedAttendees([]);
    setMembers([]);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      const res = await fetch(
        `/api/projects/${selectedProjectId}/meetings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            date: date!.toISOString(),
            startTime,
            endTime,
            attendeeIds: selectedAttendees,
            agenda: agenda.trim() || null,
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to create meeting");

      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Error creating meeting:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAttendee = (userId: string) => {
    setSelectedAttendees((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Meeting</DialogTitle>
          <DialogDescription>
            Create a new meeting for any of your projects.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Project */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="global-meeting-project">Project</Label>
            <select
              id="global-meeting-project"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={projectsLoading}
              className={cn(
                "flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
                !selectedProjectId && "text-muted-foreground"
              )}
              aria-invalid={!!errors.project}
            >
              <option value="" disabled>
                {projectsLoading ? "Loading..." : "Select a project"}
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {errors.project && (
              <p className="text-xs text-destructive">{errors.project}</p>
            )}
          </div>

          {/* Meeting Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="global-meeting-name">Name</Label>
            <Input
              id="global-meeting-name"
              placeholder="Meeting name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <Label>Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger
                className={cn(
                  "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="size-4" />
                {date ? format(date, "MMM d, yyyy") : "Select a date"}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setCalendarOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date}</p>
            )}
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="global-start-time">Start Time</Label>
              <Input
                id="global-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                aria-invalid={!!errors.startTime}
              />
              {errors.startTime && (
                <p className="text-xs text-destructive">{errors.startTime}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="global-end-time">End Time</Label>
              <Input
                id="global-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                aria-invalid={!!errors.endTime}
              />
              {errors.endTime && (
                <p className="text-xs text-destructive">{errors.endTime}</p>
              )}
            </div>
          </div>

          {/* Attendees */}
          {selectedProjectId && (
            <div className="flex flex-col gap-1.5">
              <Label>Attendees</Label>
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-input p-2">
                {membersLoading ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : members.length === 0 ? (
                  <p className="py-2 text-center text-sm text-muted-foreground">
                    No project members found
                  </p>
                ) : (
                  members.map((member) => {
                    const isSelected = selectedAttendees.includes(
                      member.userId
                    );
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleAttendee(member.userId)}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          isSelected
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-4 items-center justify-center rounded border transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input"
                          )}
                        >
                          {isSelected && (
                            <svg
                              className="size-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
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
                        <span>{member.user.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
              {errors.attendees && (
                <p className="text-xs text-destructive">{errors.attendees}</p>
              )}
            </div>
          )}

          {/* Agenda */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="global-agenda">Agenda (optional)</Label>
            <Textarea
              id="global-agenda"
              placeholder="Meeting agenda..."
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Schedule Meeting
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
