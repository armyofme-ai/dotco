"use client";

import { useCallback, useRef, useState } from "react";
import {
  Camera,
  Loader2,
  Mic,
  Trash2,
  Upload,
  X,
  Image as ImageIcon,
  AudioLines,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function toApiUrl(url: string): string {
  return url.startsWith("/uploads/")
    ? `/api${url}`
    : url;
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

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

interface MeetingMediaTabProps {
  projectId: string;
  meetingId: string;
  media: MediaItem[];
  transcriptSegments: TranscriptSegment[] | null;
  onMediaChange: () => void;
  onTranscribeComplete?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MeetingMediaTab({
  projectId,
  meetingId,
  media,
  transcriptSegments,
  onMediaChange,
  onTranscribeComplete,
}: MeetingMediaTabProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const photos = media.filter((m) => m.type === "photo");
  const audioFiles = media.filter((m) => m.type === "audio");

  const hasTranscript =
    transcriptSegments !== null && transcriptSegments.length > 0;

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      setUploading(true);
      setUploadProgress(0);

      try {
        for (let i = 0; i < fileArray.length; i++) {
          const file = fileArray[i];
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch(
            `/api/projects/${projectId}/meetings/${meetingId}/media`,
            {
              method: "POST",
              body: formData,
            }
          );

          if (!res.ok) {
            console.error(`Failed to upload ${file.name}`);
          }

          setUploadProgress(Math.round(((i + 1) / fileArray.length) * 100));
        }
        onMediaChange();
      } catch (error) {
        console.error("Error uploading files:", error);
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [projectId, meetingId, onMediaChange]
  );

  const handleDelete = async (mediaId: string) => {
    try {
      setDeletingId(mediaId);
      const res = await fetch(
        `/api/projects/${projectId}/meetings/${meetingId}/media/${mediaId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete media");
      onMediaChange();
    } catch (error) {
      console.error("Error deleting media:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleTranscribe = async (mediaId: string) => {
    try {
      setTranscribingId(mediaId);
      const res = await fetch(
        `/api/projects/${projectId}/meetings/${meetingId}/transcribe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaId }),
        }
      );
      if (!res.ok) throw new Error("Failed to transcribe audio");
      onMediaChange();
      onTranscribeComplete?.();
    } catch (error) {
      console.error("Error transcribing audio:", error);
    } finally {
      setTranscribingId(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50"
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <div className="flex flex-col items-center gap-1">
              <p className="text-sm font-medium">Uploading...</p>
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {uploadProgress}% complete
              </p>
            </div>
          </>
        ) : (
          <>
            <Upload className="size-8 text-muted-foreground/60" />
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-sm font-medium">
                Drop files or click to upload
              </p>
              <p className="text-xs text-muted-foreground">
                Images and audio files accepted
              </p>
            </div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,audio/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Photo Gallery */}
      {photos.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <Camera className="size-4" />
            Photos
            <span className="text-muted-foreground">({photos.length})</span>
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group/photo relative aspect-square overflow-hidden rounded-lg"
              >
                <img
                  src={toApiUrl(photo.url)}
                  alt={photo.filename}
                  className="size-full cursor-pointer object-cover transition-transform duration-200 group-hover/photo:scale-105"
                  onClick={() => setLightboxImage(toApiUrl(photo.url))}
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover/photo:opacity-100">
                  <div className="flex w-full items-center justify-between p-2">
                    <span className="line-clamp-1 text-xs text-white">
                      {photo.filename}
                    </span>
                    <Button
                      variant="destructive"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(photo.id);
                      }}
                      disabled={deletingId === photo.id}
                    >
                      {deletingId === photo.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Trash2 className="size-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Audio Recordings */}
      {audioFiles.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <Mic className="size-4" />
            Audio Recordings
            <span className="text-muted-foreground">
              ({audioFiles.length})
            </span>
          </h3>
          <div className="flex flex-col gap-3">
            {audioFiles.map((audio) => (
              <div
                key={audio.id}
                className="flex flex-col gap-3 rounded-lg border border-input p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <AudioLines className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="line-clamp-1 text-sm font-medium">
                        {audio.filename}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(audio.size)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasTranscript && (
                      <Badge variant="secondary">
                        <CheckCircle2 className="size-3" />
                        Transcribed
                      </Badge>
                    )}
                    {transcribingId === audio.id ? (
                      <Button variant="outline" size="sm" disabled>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span className="text-xs">Transcribing audio...</span>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTranscribe(audio.id)}
                        disabled={transcribingId !== null}
                      >
                        <Mic className="size-3.5" />
                        <span className="text-xs">Transcribe</span>
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="icon-xs"
                      onClick={() => handleDelete(audio.id)}
                      disabled={deletingId === audio.id}
                    >
                      {deletingId === audio.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Trash2 className="size-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <audio
                  controls
                  className="h-8 w-full"
                  preload="metadata"
                >
                  <source src={toApiUrl(audio.url)} type={audio.mimeType} />
                  Your browser does not support the audio element.
                </audio>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {photos.length === 0 && audioFiles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <ImageIcon className="mb-3 size-10 text-muted-foreground/50" />
          <h3 className="font-heading text-base font-medium">
            No media yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload photos or audio recordings from your meeting.
          </p>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setLightboxImage(null)}
          >
            <X className="size-5" />
          </Button>
          <img
            src={lightboxImage}
            alt="Full size preview"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
