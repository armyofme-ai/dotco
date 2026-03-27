"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Loader2,
  Mic,
  Pause,
  Pencil,
  Play,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

interface MeetingTranscriptTabProps {
  projectId: string;
  meetingId: string;
  transcriptSegments: TranscriptSegment[] | null;
  speakerMap: Record<string, string> | null;
  audioUrl: string | null;
  transcriptionError?: string | null;
  onMeetingChange: () => void;
  onSummarizeComplete?: () => void;
}

const SPEAKER_COLORS = [
  { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
  { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
];

function getSpeakerColor(speakerIndex: number) {
  return SPEAKER_COLORS[speakerIndex % SPEAKER_COLORS.length];
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function toApiUrl(url: string): string {
  return url.startsWith("/uploads/") ? `/api${url}` : url;
}

interface GroupedSegment {
  speaker: string;
  startTime: number;
  endTime: number;
  texts: string[];
}

function groupConsecutiveSegments(
  segments: TranscriptSegment[]
): GroupedSegment[] {
  if (segments.length === 0) return [];

  const groups: GroupedSegment[] = [];
  let current: GroupedSegment = {
    speaker: segments[0].speaker,
    startTime: segments[0].startTime,
    endTime: segments[0].endTime,
    texts: [segments[0].text],
  };

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.speaker === current.speaker) {
      current.endTime = seg.endTime;
      current.texts.push(seg.text);
    } else {
      groups.push(current);
      current = {
        speaker: seg.speaker,
        startTime: seg.startTime,
        endTime: seg.endTime,
        texts: [seg.text],
      };
    }
  }
  groups.push(current);
  return groups;
}

export function MeetingTranscriptTab({
  projectId,
  meetingId,
  transcriptSegments,
  speakerMap,
  audioUrl,
  transcriptionError,
  onMeetingChange,
  onSummarizeComplete,
}: MeetingTranscriptTabProps) {
  const [localSpeakerMap, setLocalSpeakerMap] = useState<
    Record<string, string>
  >(speakerMap ?? {});
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [summarizing, setSummarizing] = useState(false);

  // Audio player state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(
    null
  );

  useEffect(() => {
    setLocalSpeakerMap(speakerMap ?? {});
  }, [speakerMap]);

  const hasTranscript =
    transcriptSegments !== null && transcriptSegments.length > 0;

  // Collect unique speakers
  const uniqueSpeakers = hasTranscript
    ? Array.from(new Set(transcriptSegments!.map((s) => s.speaker)))
    : [];

  const speakerIndexMap: Record<string, number> = {};
  uniqueSpeakers.forEach((speaker, index) => {
    speakerIndexMap[speaker] = index;
  });

  const getSpeakerName = useCallback(
    (speakerId: string) => {
      return localSpeakerMap[speakerId] || speakerId;
    },
    [localSpeakerMap]
  );

  const saveSpeakerMap = useCallback(
    async (newMap: Record<string, string>) => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/meetings/${meetingId}/speakers`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ speakerMap: newMap }),
          }
        );
        if (!res.ok) throw new Error("Failed to save speaker names");
        onMeetingChange();
      } catch (error) {
        console.error("Error saving speaker names:", error);
      }
    },
    [projectId, meetingId, onMeetingChange]
  );

  const handleSpeakerClick = (speakerId: string) => {
    setEditingSpeaker(speakerId);
    setEditValue(localSpeakerMap[speakerId] || speakerId);
  };

  const handleSpeakerEditDone = () => {
    if (editingSpeaker === null) return;

    const trimmed = editValue.trim();
    const newMap = { ...localSpeakerMap };

    if (trimmed && trimmed !== editingSpeaker) {
      newMap[editingSpeaker] = trimmed;
    } else if (!trimmed || trimmed === editingSpeaker) {
      // If cleared or same as original ID, remove override
      delete newMap[editingSpeaker];
    }

    setLocalSpeakerMap(newMap);
    setEditingSpeaker(null);
    setEditValue("");
    saveSpeakerMap(newMap);
  };

  const handleSpeakerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSpeakerEditDone();
    } else if (e.key === "Escape") {
      setEditingSpeaker(null);
      setEditValue("");
    }
  };

  const handleSummarize = async () => {
    try {
      setSummarizing(true);
      const res = await fetch(
        `/api/projects/${projectId}/meetings/${meetingId}/summarize`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to generate summary");
      onMeetingChange();
      onSummarizeComplete?.();
    } catch (error) {
      console.error("Error generating summary:", error);
    } finally {
      setSummarizing(false);
    }
  };

  // Audio player handlers
  const handleSegmentClick = (startTime: number) => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    audio.currentTime = startTime;
    audio.play().catch(() => {});
    setIsPlaying(true);
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    audio.currentTime = fraction * duration;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);
    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
    };
  }, [audioUrl]);

  if (!hasTranscript) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Mic className="mb-3 size-10 text-muted-foreground/50" />
        <h3 className="font-heading text-base font-medium">
          {transcriptionError ? "Transcription failed" : "No transcript yet"}
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {transcriptionError
            ? transcriptionError
            : "Upload and transcribe an audio recording from the Recording & Photos tab to generate a transcript."}
        </p>
      </div>
    );
  }

  const grouped = groupConsecutiveSegments(transcriptSegments!);
  const resolvedAudioUrl = audioUrl ? toApiUrl(audioUrl) : null;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header with Generate Summary button */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileText className="size-4" />
          Transcript
        </h3>
        <Button
          variant="default"
          size="sm"
          onClick={handleSummarize}
          disabled={summarizing}
        >
          {summarizing ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span className="text-xs">Generating summary...</span>
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" />
              <span className="text-xs">Generate Summary</span>
            </>
          )}
        </Button>
      </div>

      {/* Audio player bar */}
      {resolvedAudioUrl && (
        <>
          <audio ref={audioRef} src={resolvedAudioUrl} preload="metadata" />
          <div className="flex items-center gap-3 rounded-lg border border-input bg-muted/30 px-4 py-2.5">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={togglePlayPause}
              className="shrink-0"
            >
              {isPlaying ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
            </Button>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatTimestamp(currentTime)}
            </span>
            <div
              className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-muted"
              onClick={handleProgressClick}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-100"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatTimestamp(duration)}
            </span>
          </div>
        </>
      )}

      {/* Diarized Transcript */}
      <section className="flex flex-col gap-1">
        {grouped.map((group, index) => {
          const color = getSpeakerColor(
            speakerIndexMap[group.speaker] ?? 0
          );
          const displayName = getSpeakerName(group.speaker);
          const isEditing = editingSpeaker === group.speaker;
          const isHovered = hoveredSegmentIndex === index;

          return (
            <div
              key={`${group.speaker}-${group.startTime}-${index}`}
              className="group/segment relative flex gap-3 rounded-md py-2 transition-colors hover:bg-muted/40"
              onMouseEnter={() => setHoveredSegmentIndex(index)}
              onMouseLeave={() => setHoveredSegmentIndex(null)}
            >
              {/* Timestamp */}
              <div className="flex w-12 shrink-0 pt-0.5">
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(group.startTime)}
                </span>
              </div>

              {/* Speaker + text */}
              <div className="flex flex-1 flex-col gap-1">
                {isEditing && index === grouped.findIndex((g) => g.speaker === group.speaker) ? (
                  <div
                    onClickCapture={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => {
                        // Delay to allow click events to process
                        setTimeout(handleSpeakerEditDone, 150);
                      }}
                      onKeyDown={handleSpeakerKeyDown}
                      className={`h-6 w-44 rounded-md border border-input bg-background px-2 py-0 text-xs font-medium outline-none focus:border-ring focus:ring-2 focus:ring-ring/50 ${color.text}`}
                    />
                  </div>
                ) : (
                  <span
                    role="button"
                    tabIndex={0}
                    onClickCapture={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSpeakerClick(group.speaker);
                    }}
                    className={`inline-flex w-fit cursor-text items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${color.bg} ${color.text}`}
                    title="Click to rename speaker"
                  >
                    {isEditing ? editValue || displayName : displayName}
                    <Pencil className="size-2.5 opacity-0 transition-opacity group-hover/segment:opacity-60" />
                  </span>
                )}
                <p
                  className={`text-sm leading-relaxed text-foreground ${resolvedAudioUrl ? "cursor-pointer" : ""}`}
                  onClick={() => handleSegmentClick(group.startTime)}
                >
                  {group.texts.join(" ")}
                </p>
              </div>

              {/* Play indicator on hover */}
              {resolvedAudioUrl && isHovered && (
                <div className="absolute right-2 top-2">
                  <Play className="size-3.5 text-muted-foreground/60" />
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
