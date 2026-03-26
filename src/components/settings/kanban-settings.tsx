"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  GripVertical,
  Loader2,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STATUS_OPTIONS, getStatusDotColor } from "@/lib/project-utils";
import type { ProjectStatus } from "@/generated/prisma/client";

const ALL_STATUSES = STATUS_OPTIONS.map((o) => o.value);
const DEFAULT_COLUMNS = ALL_STATUSES;

export function KanbanSettings() {
  const [columns, setColumns] = useState<ProjectStatus[]>(DEFAULT_COLUMNS);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.kanbanColumns && Array.isArray(data.kanbanColumns)) {
        setColumns(data.kanbanColumns as ProjectStatus[]);
      }
      if (data.kanbanLabels && typeof data.kanbanLabels === "object") {
        setLabels(data.kanbanLabels as Record<string, string>);
      }
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kanbanColumns: columns, kanbanLabels: labels }),
      });
      if (!res.ok) throw new Error();
      toast.success("Kanban columns saved");
      setDirty(false);
    } catch {
      toast.error("Failed to save kanban columns");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setColumns([...DEFAULT_COLUMNS]);
    setLabels({});
    setDirty(true);
  };

  const toggleColumn = (status: ProjectStatus) => {
    setColumns((prev) => {
      if (prev.includes(status)) {
        if (prev.length <= 1) return prev; // keep at least 1
        return prev.filter((s) => s !== status);
      }
      return [...prev, status];
    });
    setDirty(true);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setColumns((prev) => {
      const newCols = [...prev];
      const [moved] = newCols.splice(dragIndex, 1);
      newCols.splice(index, 0, moved);
      return newCols;
    });
    setDragIndex(index);
    setDirty(true);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  // All statuses: visible ones in order, then hidden ones
  const hiddenStatuses = ALL_STATUSES.filter((s) => !columns.includes(s));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Kanban Columns</CardTitle>
            <CardDescription>
              Choose which status columns appear in the Kanban board and drag to
              reorder them.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="size-3.5" />
              <span className="text-sm">Reset</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              <span className="text-sm">Save</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Visible columns (draggable) */}
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Visible columns (drag to reorder)
            </h4>
            <div className="flex flex-col gap-1.5">
              {columns.map((status, index) => {
                const option = STATUS_OPTIONS.find((o) => o.value === status);
                return (
                  <div
                    key={status}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors",
                      dragIndex === index && "opacity-50"
                    )}
                  >
                    <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground/50 active:cursor-grabbing" />
                    <span
                      className={cn(
                        "size-2.5 shrink-0 rounded-full",
                        getStatusDotColor(status)
                      )}
                    />
                    <input
                      type="text"
                      value={labels[status] ?? option?.label ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLabels((prev) => {
                          const next = { ...prev };
                          if (val && val !== (option?.label ?? "")) {
                            next[status] = val;
                          } else {
                            delete next[status];
                          }
                          return next;
                        });
                        setDirty(true);
                      }}
                      placeholder={option?.label ?? status}
                      className="flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium outline-none hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/50"
                    />
                    <button
                      type="button"
                      onClick={() => toggleColumn(status)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Hide column"
                    >
                      <Eye className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hidden columns */}
          {hiddenStatuses.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Hidden columns
              </h4>
              <div className="flex flex-col gap-1.5">
                {hiddenStatuses.map((status) => {
                  const option = STATUS_OPTIONS.find(
                    (o) => o.value === status
                  );
                  return (
                    <div
                      key={status}
                      className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5 opacity-60"
                    >
                      <div className="size-4 shrink-0" />
                      <span
                        className={cn(
                          "size-2.5 shrink-0 rounded-full",
                          getStatusDotColor(status)
                        )}
                      />
                      <span className="flex-1 text-sm font-medium">
                        {labels[status] ?? option?.label ?? status}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleColumn(status)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Show column"
                      >
                        <EyeOff className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
