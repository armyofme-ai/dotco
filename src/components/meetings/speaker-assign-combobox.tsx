"use client";

import { useState, useMemo } from "react";
import { UserPlus } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { SpeakerEntry } from "@/lib/speaker-utils";

interface SpeakerAssignComboboxProps {
  currentName: string;
  speakerId: string;
  projectMembers: { id: string; user: { id: string; name: string; avatar: string | null } }[];
  meetingAttendees: { userId: string; user: { id: string; name: string; avatar: string | null } }[];
  onAssign: (entry: SpeakerEntry) => void;
  onCancel: () => void;
  speakerColor: { bg: string; text: string; border: string };
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function SpeakerAssignCombobox({
  currentName,
  speakerId,
  projectMembers,
  meetingAttendees,
  onAssign,
  onCancel,
  speakerColor,
}: SpeakerAssignComboboxProps) {
  const [search, setSearch] = useState("");

  const attendeeUserIds = useMemo(
    () => new Set(meetingAttendees.map((a) => a.userId)),
    [meetingAttendees]
  );

  const nonAttendeeMembers = useMemo(
    () => projectMembers.filter((m) => !attendeeUserIds.has(m.user.id)),
    [projectMembers, attendeeUserIds]
  );

  const trimmed = search.trim();

  const handleSelectMember = (userId: string, name: string) => {
    onAssign({ name, userId, status: "confirmed" });
  };

  const handleSelectFreeText = () => {
    if (trimmed) {
      onAssign(trimmed);
    }
  };

  return (
    <Popover defaultOpen onOpenChange={(open) => { if (!open) onCancel(); }}>
      <PopoverTrigger
        className={`inline-flex w-fit cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${speakerColor.bg} ${speakerColor.text}`}
      >
        {currentName}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command
          shouldFilter={true}
          className="rounded-lg"
        >
          <CommandInput
            placeholder="Search people..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              No matches found.
            </CommandEmpty>

            {meetingAttendees.length > 0 && (
              <CommandGroup heading="Attendees">
                {meetingAttendees.map((attendee) => (
                  <CommandItem
                    key={attendee.userId}
                    value={attendee.user.name}
                    onSelect={() =>
                      handleSelectMember(attendee.user.id, attendee.user.name)
                    }
                    className="gap-2 text-xs"
                  >
                    <Avatar size="sm">
                      {attendee.user.avatar && (
                        <AvatarImage src={attendee.user.avatar} alt={attendee.user.name} />
                      )}
                      <AvatarFallback>{getInitials(attendee.user.name)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{attendee.user.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {nonAttendeeMembers.length > 0 && (
              <CommandGroup heading="Members">
                {nonAttendeeMembers.map((member) => (
                  <CommandItem
                    key={member.user.id}
                    value={member.user.name}
                    onSelect={() =>
                      handleSelectMember(member.user.id, member.user.name)
                    }
                    className="gap-2 text-xs"
                  >
                    <Avatar size="sm">
                      {member.user.avatar && (
                        <AvatarImage src={member.user.avatar} alt={member.user.name} />
                      )}
                      <AvatarFallback>{getInitials(member.user.name)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{member.user.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {trimmed && (
              <CommandGroup heading="">
                <CommandItem
                  value={`assign-custom-${trimmed}`}
                  onSelect={handleSelectFreeText}
                  className="gap-2 text-xs"
                >
                  <UserPlus className="size-3.5 text-muted-foreground" />
                  <span className="truncate">
                    Assign as &ldquo;{trimmed}&rdquo;
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
