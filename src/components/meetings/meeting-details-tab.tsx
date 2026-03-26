"use client";

import { format, parseISO } from "date-fns";
import { CalendarDays, Clock, Users } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

interface Attendee {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    avatar: string | null;
  };
}

interface MeetingDetailsTabProps {
  date: string;
  startTime: string;
  endTime: string;
  attendees: Attendee[];
  agenda: string | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function MeetingDetailsTab({
  date,
  startTime,
  endTime,
  attendees,
  agenda,
}: MeetingDetailsTabProps) {
  const meetingDate = parseISO(date);

  return (
    <div className="flex flex-col gap-6">
      {/* Meeting Info */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <CalendarDays className="size-4" />
          Meeting Info
        </h3>
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-input p-4 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Date</span>
            <span className="text-sm font-medium">
              {format(meetingDate, "EEEE, MMMM d, yyyy")}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Start Time</span>
            <span className="text-sm font-medium">{startTime}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">End Time</span>
            <span className="text-sm font-medium">{endTime}</span>
          </div>
        </div>
      </section>

      <Separator />

      {/* Attendees */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Users className="size-4" />
          Attendees
          <span className="text-muted-foreground">({attendees.length})</span>
        </h3>
        {attendees.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No attendees added to this meeting.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {attendees.map((attendee) => (
              <div
                key={attendee.id}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5"
              >
                <Avatar size="sm">
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
                <span className="text-sm">{attendee.user.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Agenda */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Clock className="size-4" />
          Agenda
        </h3>
        {agenda ? (
          <div className="whitespace-pre-wrap rounded-lg border border-input p-4 text-sm leading-relaxed text-foreground">
            {agenda}
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            No agenda set for this meeting.
          </p>
        )}
      </section>
    </div>
  );
}
