"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarDays, Clock, Loader2, MessageSquare, Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CreateMeetingDialog } from "@/components/meetings/create-meeting-dialog";

interface Attendee {
  id: string;
  user: {
    id: string;
    name: string;
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
  attendees: Attendee[];
  _count?: {
    meetingPoints: number;
  };
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

interface ProjectMeetingsProps {
  projectId: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ProjectMeetings({ projectId }: ProjectMeetingsProps) {
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/meetings`);
      if (!res.ok) throw new Error("Failed to fetch meetings");
      const data = await res.json();
      setMeetings(data);
    } catch (error) {
      console.error("Error fetching meetings:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (!res.ok) throw new Error("Failed to fetch members");
      const data = await res.json();
      setMembers(data);
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMeetings();
    fetchMembers();
  }, [fetchMeetings, fetchMembers]);

  const handleMeetingCreated = () => {
    setDialogOpen(false);
    fetchMeetings();
  };

  const sortedMeetings = [...meetings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Meetings
        </h2>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus data-icon="inline-start" />
          Schedule Meeting
        </Button>
      </div>

      {sortedMeetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <CalendarDays className="mb-3 size-10 text-muted-foreground/50" />
          <h3 className="font-heading text-base font-medium">
            No meetings yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule your first meeting to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedMeetings.map((meeting) => {
            const meetingDate = parseISO(meeting.date);
            const maxAvatars = 3;
            const visibleAttendees = meeting.attendees.slice(0, maxAvatars);
            const remainingCount = meeting.attendees.length - maxAvatars;
            const pointCount = meeting._count?.meetingPoints ?? 0;

            return (
              <Link
                key={meeting.id}
                href={`/projects/${projectId}/meetings/${meeting.id}`}
                className="group/link rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full transition-shadow duration-200 group-hover/link:shadow-md">
                  <CardHeader>
                    <CardTitle className="line-clamp-1">
                      {meeting.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" />
                        {format(meetingDate, "MMM d, yyyy")}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        {meeting.startTime} - {meeting.endTime}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      {meeting.attendees.length > 0 ? (
                        <AvatarGroup>
                          {visibleAttendees.map((attendee) => (
                            <Avatar key={attendee.id} size="sm">
                              {attendee.user.avatar && (
                                <AvatarImage
                                  src={attendee.user.avatar}
                                  alt={attendee.user.name}
                                />
                              )}
                              <AvatarFallback>
                                {getInitials(attendee.user.name)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {remainingCount > 0 && (
                            <AvatarGroupCount>
                              +{remainingCount}
                            </AvatarGroupCount>
                          )}
                        </AvatarGroup>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="size-3.5" />
                          No attendees
                        </span>
                      )}

                      {pointCount > 0 && (
                        <Badge variant="secondary">
                          <MessageSquare className="size-3" />
                          {pointCount} {pointCount === 1 ? "point" : "points"}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <CreateMeetingDialog
        projectId={projectId}
        members={members}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleMeetingCreated}
      />
    </>
  );
}
