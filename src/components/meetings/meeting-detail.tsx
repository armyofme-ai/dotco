"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

import { MeetingDetailsTab } from "@/components/meetings/meeting-details-tab";
import { MeetingMediaTab } from "@/components/meetings/meeting-media-tab";
import { MeetingTranscriptTab } from "@/components/meetings/meeting-transcript-tab";
import { MeetingSummaryTab } from "@/components/meetings/meeting-summary-tab";
import { EditMeetingDialog } from "@/components/meetings/edit-meeting-dialog";

interface Attendee {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    avatar: string | null;
  };
}

interface MediaItem {
  id: string;
  filename: string;
  url: string;
  type: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

interface MeetingPoint {
  id: string;
  title: string;
  description: string | null;
  order: number;
}

interface NextStepAssignee {
  id: string;
  name: string;
  avatar: string | null;
}

interface NextStep {
  id: string;
  description: string;
  dueDate: string | null;
  completed: boolean;
  order: number;
  assigneeId: string | null;
  assignee: NextStepAssignee | null;
}

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

interface MeetingData {
  id: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  agenda: string | null;
  transcription: string | null;
  summary: string | null;
  transcriptSegments: TranscriptSegment[] | null;
  speakerMap: Record<string, string> | null;
  transcribedMediaId: string | null;
  attendees: Attendee[];
  media: MediaItem[];
  meetingPoints: MeetingPoint[];
  nextSteps: NextStep[];
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

interface MeetingDetailProps {
  projectId: string;
  meetingId: string;
}

type TabValue = "details" | "media" | "transcript" | "summary";

export function MeetingDetail({ projectId, meetingId }: MeetingDetailProps) {
  const router = useRouter();
  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("details");

  const fetchMeeting = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/meetings/${meetingId}`
      );
      if (!res.ok) throw new Error("Failed to fetch meeting");
      const data = await res.json();
      setMeeting(data);
    } catch (error) {
      console.error("Error fetching meeting:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId, meetingId]);

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
    fetchMeeting();
    fetchMembers();
  }, [fetchMeeting, fetchMembers]);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const res = await fetch(
        `/api/projects/${projectId}/meetings/${meetingId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete meeting");
      router.push(`/projects/${projectId}`);
    } catch (error) {
      console.error("Error deleting meeting:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    setEditOpen(false);
    fetchMeeting();
  };

  const handleTranscribeComplete = () => {
    fetchMeeting();
    setActiveTab("transcript");
  };

  const handleSummarizeComplete = () => {
    fetchMeeting();
    setActiveTab("summary");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h3 className="font-heading text-base font-medium">
          Meeting not found
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The meeting you are looking for does not exist or has been deleted.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          <ArrowLeft data-icon="inline-start" />
          Back to Project
        </Button>
      </div>
    );
  }

  const meetingDate = parseISO(meeting.date);

  return (
    <div className="flex flex-col gap-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => router.push(`/projects/${projectId}`)}
      >
        <ArrowLeft data-icon="inline-start" />
        Back to Project
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {meeting.name}
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {format(meetingDate, "EEEE, MMMM d, yyyy")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" />
              {meeting.startTime} - {meeting.endTime}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
          >
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
      >
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="media">Recording & Photos</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="summary">Summary & Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <MeetingDetailsTab
            date={meeting.date}
            startTime={meeting.startTime}
            endTime={meeting.endTime}
            attendees={meeting.attendees}
            agenda={meeting.agenda}
          />
        </TabsContent>

        <TabsContent value="media">
          <MeetingMediaTab
            projectId={projectId}
            meetingId={meetingId}
            media={meeting.media}
            transcriptSegments={meeting.transcriptSegments}
            onMediaChange={fetchMeeting}
            onTranscribeComplete={handleTranscribeComplete}
          />
        </TabsContent>

        <TabsContent value="transcript">
          <MeetingTranscriptTab
            projectId={projectId}
            meetingId={meetingId}
            transcriptSegments={meeting.transcriptSegments}
            speakerMap={meeting.speakerMap}
            transcriptionError={meeting.transcription?.startsWith("__FAILED__") ? meeting.transcription.replace("__FAILED__", "") : null}
            audioUrl={
              (meeting.transcribedMediaId
                ? meeting.media.find((m) => m.id === meeting.transcribedMediaId)?.url
                : meeting.media.find((m) => m.type === "audio")?.url) ?? null
            }
            onMeetingChange={fetchMeeting}
            onSummarizeComplete={handleSummarizeComplete}
          />
        </TabsContent>

        <TabsContent value="summary">
          <MeetingSummaryTab
            projectId={projectId}
            meetingId={meetingId}
            summary={meeting.summary}
            meetingPoints={meeting.meetingPoints}
            nextSteps={meeting.nextSteps}
            members={members}
            onMeetingChange={fetchMeeting}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      {meeting && (
        <EditMeetingDialog
          projectId={projectId}
          meeting={meeting}
          members={members}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Meeting</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this meeting? This action cannot
              be undone. All meeting data including media, points, and next steps
              will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
