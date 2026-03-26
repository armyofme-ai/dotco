"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format, isToday, isPast, parseISO } from "date-fns";
import { CalendarDays, Loader2, Plus } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { CreateGlobalMeetingDialog } from "@/components/meetings/create-global-meeting-dialog";
import { cn } from "@/lib/utils";

interface Meeting {
  id: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  agenda: string | null;
  projectId: string;
  project: {
    id: string;
    name: string;
  };
  _count: {
    attendees: number;
    media: number;
  };
}

interface MonthGroup {
  label: string;
  days: DayGroup[];
}

interface DayGroup {
  date: Date;
  meetings: Meeting[];
}

function groupMeetingsByMonth(meetings: Meeting[]): MonthGroup[] {
  const monthMap = new Map<string, Map<string, Meeting[]>>();

  for (const meeting of meetings) {
    const date = parseISO(meeting.date);
    const monthKey = format(date, "yyyy-MM");
    const monthLabel = format(date, "MMMM yyyy");
    const dayKey = format(date, "yyyy-MM-dd");

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, new Map());
    }
    const dayMap = monthMap.get(monthKey)!;

    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, []);
    }
    dayMap.get(dayKey)!.push(meeting);
  }

  const months: MonthGroup[] = [];
  for (const [monthKey, dayMap] of monthMap) {
    const firstDate = parseISO(`${monthKey}-01`);
    const days: DayGroup[] = [];

    for (const [dayKey, dayMeetings] of dayMap) {
      days.push({
        date: parseISO(dayKey),
        meetings: dayMeetings,
      });
    }

    days.sort((a, b) => a.date.getTime() - b.date.getTime());

    months.push({
      label: format(firstDate, "MMMM yyyy"),
      days,
    });
  }

  return months;
}

export function MyMeetingsView() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/meetings");
      if (!res.ok) throw new Error("Failed to fetch meetings");
      const data = await res.json();
      setMeetings(data);
    } catch (error) {
      console.error("Error fetching meetings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const monthGroups = groupMeetingsByMonth(meetings);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Meetings
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your scheduled meetings across all projects
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          <Plus className="size-3.5" />
          New Meeting
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <CalendarDays className="size-10 opacity-40" />
          <p className="text-sm">No meetings scheduled</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {monthGroups.map((month) => (
            <div key={month.label}>
              {/* Month header */}
              <div className="mb-3 flex items-center gap-3">
                <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  {month.label}
                </span>
                <Separator className="flex-1" />
              </div>

              {/* Day groups */}
              <div className="flex flex-col gap-4">
                {month.days.map((day) => {
                  const dayIsToday = isToday(day.date);
                  const dayIsPast = isPast(day.date) && !dayIsToday;

                  return (
                    <div key={day.date.toISOString()} className="flex gap-4">
                      {/* Day indicator */}
                      <div
                        className={cn(
                          "flex w-12 shrink-0 flex-col items-center pt-1",
                          dayIsPast && "opacity-50"
                        )}
                      >
                        <span
                          className={cn(
                            "text-xl font-bold leading-none",
                            dayIsToday
                              ? "text-primary"
                              : "text-foreground"
                          )}
                        >
                          {format(day.date, "d")}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 text-xs text-muted-foreground",
                            dayIsToday && "text-primary/70"
                          )}
                        >
                          {format(day.date, "EEE")}
                        </span>
                      </div>

                      {/* Meeting rows */}
                      <div className="flex flex-1 flex-col gap-1">
                        {day.meetings.map((meeting) => {
                          const meetingDate = parseISO(meeting.date);
                          const meetingIsToday = isToday(meetingDate);
                          const meetingIsPast =
                            isPast(meetingDate) && !meetingIsToday;

                          return (
                            <div
                              key={meeting.id}
                              className={cn(
                                "group flex items-baseline gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/60",
                                meetingIsToday && "border-l-2 border-primary",
                                meetingIsPast && "opacity-50"
                              )}
                            >
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                                <Link
                                  href={`/projects/${meeting.projectId}/meetings/${meeting.id}`}
                                  className="truncate text-sm font-medium text-foreground hover:underline"
                                >
                                  {meeting.name}
                                </Link>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {meeting.startTime} &ndash; {meeting.endTime}
                                </span>
                              </div>
                              <Link
                                href={`/projects/${meeting.projectId}`}
                                className="hidden shrink-0 text-xs text-muted-foreground hover:text-foreground hover:underline sm:inline"
                              >
                                {meeting.project.name}
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateGlobalMeetingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setDialogOpen(false);
          fetchMeetings();
        }}
      />
    </div>
  );
}
