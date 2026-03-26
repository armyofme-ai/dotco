"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface MeetingData {
  id: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  agenda: string | null;
  attendees: {
    id: string;
    userId: string;
    user: {
      id: string;
      name: string;
      avatar: string | null;
    };
  }[];
}

interface EditMeetingDialogProps {
  projectId: string;
  meeting: MeetingData;
  members: ProjectMember[];
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

export function EditMeetingDialog({
  projectId,
  meeting,
  members,
  open,
  onOpenChange,
  onSuccess,
}: EditMeetingDialogProps) {
  const [name, setName] = useState(meeting.name);
  const [date, setDate] = useState<Date | undefined>(new Date(meeting.date));
  const [startTime, setStartTime] = useState(meeting.startTime);
  const [endTime, setEndTime] = useState(meeting.endTime);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>(
    meeting.attendees.map((a) => a.userId)
  );
  const [agenda, setAgenda] = useState(meeting.agenda ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setName(meeting.name);
      setDate(new Date(meeting.date));
      setStartTime(meeting.startTime);
      setEndTime(meeting.endTime);
      setSelectedAttendees(meeting.attendees.map((a) => a.userId));
      setAgenda(meeting.agenda ?? "");
      setErrors({});
    }
  }, [open, meeting]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Meeting name is required";
    if (!date) newErrors.date = "Date is required";
    if (!startTime) newErrors.startTime = "Start time is required";
    if (!endTime) newErrors.endTime = "End time is required";
    if (selectedAttendees.length === 0)
      newErrors.attendees = "At least one attendee is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      const res = await fetch(
        `/api/projects/${projectId}/meetings/${meeting.id}`,
        {
          method: "PATCH",
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

      if (!res.ok) throw new Error("Failed to update meeting");

      onSuccess();
    } catch (error) {
      console.error("Error updating meeting:", error);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Meeting</DialogTitle>
          <DialogDescription>
            Update the meeting details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Meeting Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-meeting-name">Name</Label>
            <Input
              id="edit-meeting-name"
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
              <Label htmlFor="edit-start-time">Start Time</Label>
              <Input
                id="edit-start-time"
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
              <Label htmlFor="edit-end-time">End Time</Label>
              <Input
                id="edit-end-time"
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
          <div className="flex flex-col gap-1.5">
            <Label>Attendees</Label>
            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-input p-2">
              {members.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  No project members found
                </p>
              ) : (
                members.map((member) => {
                  const isSelected = selectedAttendees.includes(member.userId);
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

          {/* Agenda */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-agenda">Agenda (optional)</Label>
            <Textarea
              id="edit-agenda"
              placeholder="Meeting agenda..."
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
