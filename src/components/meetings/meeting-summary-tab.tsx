"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  Check,
  FileText,
  ListChecks,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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

interface MeetingSummaryTabProps {
  projectId: string;
  meetingId: string;
  summary: string | null;
  meetingPoints: MeetingPoint[];
  nextSteps: NextStep[];
  members: ProjectMember[];
  onMeetingChange: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function MeetingSummaryTab({
  projectId,
  meetingId,
  summary,
  meetingPoints,
  nextSteps,
  members,
  onMeetingChange,
}: MeetingSummaryTabProps) {
  // Summary
  const [summaryValue, setSummaryValue] = useState(summary ?? "");
  const [editingSummary, setEditingSummary] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);

  // Meeting Points
  const [points, setPoints] = useState<MeetingPoint[]>(meetingPoints);
  const [addingPoint, setAddingPoint] = useState(false);
  const [newPointTitle, setNewPointTitle] = useState("");
  const [newPointDescription, setNewPointDescription] = useState("");
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [editPointTitle, setEditPointTitle] = useState("");
  const [editPointDescription, setEditPointDescription] = useState("");

  // Next Steps
  const [steps, setSteps] = useState<NextStep[]>(nextSteps);
  const [addingStep, setAddingStep] = useState(false);
  const [newStepDescription, setNewStepDescription] = useState("");
  const [newStepAssigneeId, setNewStepAssigneeId] = useState<string>("");
  const [newStepDueDate, setNewStepDueDate] = useState("");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editStepDescription, setEditStepDescription] = useState("");
  const [editStepAssigneeId, setEditStepAssigneeId] = useState<string>("");
  const [editStepDueDate, setEditStepDueDate] = useState("");

  // Sync when props change
  useEffect(() => {
    setSummaryValue(summary ?? "");
  }, [summary]);

  useEffect(() => {
    setPoints(meetingPoints);
  }, [meetingPoints]);

  useEffect(() => {
    setSteps(nextSteps);
  }, [nextSteps]);

  // Save summary
  const saveSummary = useCallback(async () => {
    setSavingSummary(true);
    try {
      await fetch(`/api/projects/${projectId}/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: summaryValue || null }),
      });
      setEditingSummary(false);
      onMeetingChange();
    } catch (error) {
      console.error("Error saving summary:", error);
    } finally {
      setSavingSummary(false);
    }
  }, [projectId, meetingId, summaryValue]);

  // Meeting Points CRUD
  const addPoint = async () => {
    if (!newPointTitle.trim()) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/meetings/${meetingId}/points`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newPointTitle.trim(),
            description: newPointDescription.trim() || null,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to add point");
      const point = await res.json();
      setPoints((prev) => [...prev, point]);
      setNewPointTitle("");
      setNewPointDescription("");
      setAddingPoint(false);
      onMeetingChange();
    } catch (error) {
      console.error("Error adding point:", error);
    }
  };

  const updatePoint = async (pointId: string) => {
    if (!editPointTitle.trim()) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/meetings/${meetingId}/points/${pointId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editPointTitle.trim(),
            description: editPointDescription.trim() || null,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to update point");
      const updated = await res.json();
      setPoints((prev) => prev.map((p) => (p.id === pointId ? updated : p)));
      setEditingPointId(null);
      onMeetingChange();
    } catch (error) {
      console.error("Error updating point:", error);
    }
  };

  const deletePoint = async (pointId: string) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/meetings/${meetingId}/points/${pointId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete point");
      setPoints((prev) => prev.filter((p) => p.id !== pointId));
      onMeetingChange();
    } catch (error) {
      console.error("Error deleting point:", error);
    }
  };

  const startEditingPoint = (point: MeetingPoint) => {
    setEditingPointId(point.id);
    setEditPointTitle(point.title);
    setEditPointDescription(point.description ?? "");
  };

  // Next Steps CRUD
  const addStep = async () => {
    if (!newStepDescription.trim()) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/meetings/${meetingId}/next-steps`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: newStepDescription.trim(),
            assigneeId: newStepAssigneeId || null,
            dueDate: newStepDueDate || null,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to add step");
      const step = await res.json();
      setSteps((prev) => [...prev, step]);
      setNewStepDescription("");
      setNewStepAssigneeId("");
      setNewStepDueDate("");
      setAddingStep(false);
      onMeetingChange();
    } catch (error) {
      console.error("Error adding step:", error);
    }
  };

  const startEditingStep = (step: NextStep) => {
    setEditingStepId(step.id);
    setEditStepDescription(step.description);
    setEditStepAssigneeId(step.assigneeId ?? "");
    setEditStepDueDate(
      step.dueDate ? step.dueDate.split("T")[0] : ""
    );
  };

  const updateStep = async (stepId: string) => {
    if (!editStepDescription.trim()) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/meetings/${meetingId}/next-steps/${stepId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: editStepDescription.trim(),
            assigneeId: editStepAssigneeId || null,
            dueDate: editStepDueDate || null,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to update step");
      const updated = await res.json();
      setSteps((prev) => prev.map((s) => (s.id === stepId ? updated : s)));
      setEditingStepId(null);
      onMeetingChange();
    } catch (error) {
      console.error("Error updating step:", error);
    }
  };

  const toggleStepCompleted = async (step: NextStep) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/meetings/${meetingId}/next-steps/${step.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: !step.completed }),
        }
      );
      if (!res.ok) throw new Error("Failed to toggle step");
      const updated = await res.json();
      setSteps((prev) => prev.map((s) => (s.id === step.id ? updated : s)));
      onMeetingChange();
    } catch (error) {
      console.error("Error toggling step:", error);
    }
  };

  const deleteStep = async (stepId: string) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/meetings/${meetingId}/next-steps/${stepId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete step");
      setSteps((prev) => prev.filter((s) => s.id !== stepId));
      onMeetingChange();
    } catch (error) {
      console.error("Error deleting step:", error);
    }
  };

  const hasSummary = summary !== null && summary.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Summary Section */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FileText className="size-4" />
            Summary
            {savingSummary && (
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
            )}
          </h3>
          {hasSummary && !editingSummary && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingSummary(true)}
            >
              <Pencil className="size-3.5" />
              <span className="text-xs">Edit</span>
            </Button>
          )}
        </div>

        {!hasSummary && !editingSummary ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-input py-10 text-center">
            <Sparkles className="mb-3 size-8 text-muted-foreground/50" />
            <h4 className="text-sm font-medium">No summary yet</h4>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Generate one from the transcript in the Transcript tab, or write
              one manually.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setEditingSummary(true)}
            >
              <Pencil className="size-3.5" />
              <span className="text-xs">Write Summary</span>
            </Button>
          </div>
        ) : editingSummary ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={summaryValue}
              onChange={(e) => setSummaryValue(e.target.value)}
              placeholder="Write a meeting summary..."
              rows={6}
              className="resize-y"
              autoFocus
            />
            <div className="flex gap-1">
              <Button
                variant="default"
                size="sm"
                onClick={saveSummary}
                disabled={savingSummary}
              >
                {savingSummary && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                <span className="text-xs">Save</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingSummary(false);
                  setSummaryValue(summary ?? "");
                }}
              >
                <span className="text-xs">Cancel</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap rounded-lg border border-input p-4 text-sm leading-relaxed text-foreground">
            {summary}
          </div>
        )}
      </section>

      <Separator />

      {/* Meeting Points */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4" />
            <h3 className="text-sm font-medium text-foreground">
              Meeting Points
            </h3>
            <span className="text-sm text-muted-foreground">
              ({points.length})
            </span>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setAddingPoint(true)}
          >
            <Plus data-icon="inline-start" />
            Add Point
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {points.length === 0 && !addingPoint && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No meeting points yet. Add your first point.
            </p>
          )}

          {points
            .sort((a, b) => a.order - b.order)
            .map((point, index) => (
              <div
                key={point.id}
                className="group/point flex gap-3 rounded-lg border border-input p-3"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {index + 1}
                </span>

                {editingPointId === point.id ? (
                  <div className="flex flex-1 flex-col gap-2">
                    <Input
                      value={editPointTitle}
                      onChange={(e) => setEditPointTitle(e.target.value)}
                      placeholder="Point title"
                      autoFocus
                    />
                    <Input
                      value={editPointDescription}
                      onChange={(e) => setEditPointDescription(e.target.value)}
                      placeholder="Description (optional)"
                    />
                    <div className="flex gap-1">
                      <Button
                        variant="default"
                        size="xs"
                        onClick={() => updatePoint(point.id)}
                      >
                        <Check className="size-3" />
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setEditingPointId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 items-start justify-between gap-2">
                    <div
                      className="flex flex-1 cursor-pointer flex-col gap-0.5"
                      onClick={() => startEditingPoint(point)}
                    >
                      <span className="text-sm font-medium">
                        {point.title}
                      </span>
                      {point.description && (
                        <span className="text-sm text-muted-foreground">
                          {point.description}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover/point:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => startEditingPoint(point)}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-xs"
                        onClick={() => deletePoint(point.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

          {/* Add Point Form */}
          {addingPoint && (
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-input p-3">
              <Input
                value={newPointTitle}
                onChange={(e) => setNewPointTitle(e.target.value)}
                placeholder="Point title"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPoint();
                  }
                }}
              />
              <Input
                value={newPointDescription}
                onChange={(e) => setNewPointDescription(e.target.value)}
                placeholder="Description (optional)"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPoint();
                  }
                }}
              />
              <div className="flex gap-1">
                <Button variant="default" size="xs" onClick={addPoint}>
                  <Plus className="size-3" />
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setAddingPoint(false);
                    setNewPointTitle("");
                    setNewPointDescription("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <Separator />

      {/* Next Steps */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="size-4" />
            <h3 className="text-sm font-medium text-foreground">Next Steps</h3>
            <span className="text-sm text-muted-foreground">
              ({steps.length})
            </span>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setAddingStep(true)}
          >
            <Plus data-icon="inline-start" />
            Add Next Step
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {steps.length === 0 && !addingStep && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No next steps yet. Add your first action item.
            </p>
          )}

          {steps
            .sort((a, b) => a.order - b.order)
            .map((step) =>
              editingStepId === step.id ? (
                <div
                  key={step.id}
                  className="flex flex-col gap-3 rounded-lg border border-input p-3"
                >
                  <Input
                    value={editStepDescription}
                    onChange={(e) => setEditStepDescription(e.target.value)}
                    placeholder="Description"
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-muted-foreground">
                        Assignee
                      </label>
                      <select
                        value={editStepAssigneeId}
                        onChange={(e) => setEditStepAssigneeId(e.target.value)}
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      >
                        <option value="">Unassigned</option>
                        {members.map((member) => (
                          <option key={member.userId} value={member.userId}>
                            {member.user.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-muted-foreground">
                        Due Date
                      </label>
                      <Input
                        type="date"
                        value={editStepDueDate}
                        onChange={(e) => setEditStepDueDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="default"
                      size="xs"
                      onClick={() => updateStep(step.id)}
                    >
                      <Check className="size-3" />
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setEditingStepId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={step.id}
                  className="group/step flex items-start gap-3 rounded-lg border border-input p-3"
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleStepCompleted(step)}
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                      step.completed
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input hover:border-primary"
                    )}
                  >
                    {step.completed && (
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
                  </button>

                  <div
                    className="flex flex-1 cursor-pointer flex-col gap-1.5"
                    onClick={() => startEditingStep(step)}
                  >
                    <span
                      className={cn(
                        "text-sm",
                        step.completed &&
                          "text-muted-foreground line-through"
                      )}
                    >
                      {step.description}
                    </span>
                    <div className="flex items-center gap-3">
                      {step.assignee ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Avatar size="sm">
                            {step.assignee.avatar && (
                              <AvatarImage
                                src={step.assignee.avatar}
                                alt={step.assignee.name}
                              />
                            )}
                            <AvatarFallback>
                              {getInitials(step.assignee.name)}
                            </AvatarFallback>
                          </Avatar>
                          {step.assignee.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="size-3" />
                          Unassigned
                        </span>
                      )}

                      {step.dueDate && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarDays className="size-3" />
                          {format(parseISO(step.dueDate), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover/step:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => startEditingStep(step)}
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon-xs"
                      onClick={() => deleteStep(step.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              )
            )}

          {/* Add Step Form */}
          {addingStep && (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-input p-3">
              <Input
                value={newStepDescription}
                onChange={(e) => setNewStepDescription(e.target.value)}
                placeholder="Description of next step"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">
                    Assignee
                  </label>
                  <select
                    value={newStepAssigneeId}
                    onChange={(e) => setNewStepAssigneeId(e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  >
                    <option value="">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">
                    Due Date
                  </label>
                  <Input
                    type="date"
                    value={newStepDueDate}
                    onChange={(e) => setNewStepDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="default" size="xs" onClick={addStep}>
                  <Plus className="size-3" />
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setAddingStep(false);
                    setNewStepDescription("");
                    setNewStepAssigneeId("");
                    setNewStepDueDate("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
