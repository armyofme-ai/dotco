"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { format } from "date-fns";

import {
  getStatusLabel,
  getStatusDotColor,
  STATUS_OPTIONS,
} from "@/lib/project-utils";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/generated/prisma/client";
import type { ProjectData } from "@/components/projects/projects-view";

// ── Helpers ──────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-cyan-600",
  "bg-fuchsia-600",
  "bg-lime-600",
  "bg-indigo-600",
  "bg-orange-600",
];

function hashToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Kanban Card (matches list view shape) ────────────────────

interface KanbanCardProps {
  project: ProjectData;
  overlay?: boolean;
}

function KanbanCard({ project, overlay }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const initials = getInitials(project.name);
  const avatarColor = hashToColor(project.id);
  const dateStr = format(new Date(project.updatedAt), "MMM d");

  return (
    <div
      ref={setNodeRef}
      style={overlay ? undefined : style}
      className={cn(
        "group/card cursor-grab rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all active:cursor-grabbing",
        isDragging && "z-50 opacity-40",
        overlay && "rotate-1 shadow-lg",
        !isDragging && !overlay && "hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
      )}
      {...attributes}
      {...listeners}
    >
      {/* Title + status dot */}
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/projects/${project.id}`}
          className="min-w-0 flex-1"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="line-clamp-2 text-sm font-medium leading-snug text-gray-900 hover:underline">
            {project.name}
          </span>
        </Link>
        <span
          className={cn(
            "mt-1 size-2.5 shrink-0 rounded-full",
            getStatusDotColor(project.status)
          )}
        />
      </div>

      {/* Description */}
      {project.description ? (
        <p className="mt-1.5 line-clamp-2 text-xs text-gray-400">
          {project.description}
        </p>
      ) : (
        <p className="mt-1.5 text-xs italic text-gray-300">No description</p>
      )}

      {/* Status + task tags */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {getStatusLabel(project.status)}
        </span>
        {(project._count?.tasks ?? 0) > 0 && (
          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {project._count?.tasks} tasks
          </span>
        )}
      </div>

      {/* Footer: avatar + date */}
      <div className="mt-3 flex items-center justify-between">
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-[10px] font-semibold text-white",
            avatarColor
          )}
        >
          {initials}
        </div>
        <span className="text-xs text-gray-400">{dateStr}</span>
      </div>
    </div>
  );
}

// ── Kanban Column ────────────────────────────────────────────

interface KanbanColumnProps {
  status: ProjectStatus;
  projects: ProjectData[];
  label?: string;
}

function KanbanColumn({ status, projects, label }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const projectIds = useMemo(
    () => projects.map((p) => p.id),
    [projects]
  );

  return (
    <div
      className={cn(
        "flex h-full w-72 shrink-0 flex-col rounded-xl transition-colors",
        isOver && "bg-gray-100/80"
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2.5 px-1 pb-3">
        <span
          className={cn(
            "size-2.5 rounded-full",
            getStatusDotColor(status)
          )}
        />
        <span className="text-sm font-semibold text-gray-800">
          {label ?? getStatusLabel(status)}
        </span>
        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-gray-500">
          {projects.length}
        </span>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex flex-1 flex-col gap-2.5 overflow-y-auto"
      >
        <SortableContext
          items={projectIds}
          strategy={verticalListSortingStrategy}
        >
          {projects.map((project) => (
            <KanbanCard key={project.id} project={project} />
          ))}
        </SortableContext>

        {projects.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 py-8 text-xs text-gray-400">
            No projects
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Board ───────────────────────────────────────────────

interface ProjectKanbanViewProps {
  projects: ProjectData[];
  onProjectUpdated: () => void;
  visibleColumns?: ProjectStatus[] | null;
  columnLabels?: Record<string, string> | null;
}

export function ProjectKanbanView({
  projects,
  onProjectUpdated,
  visibleColumns,
  columnLabels,
}: ProjectKanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // Local optimistic copy of projects to avoid scroll reset on re-fetch
  const [localProjects, setLocalProjects] = useState<ProjectData[]>(projects);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync from parent only when not dragging and projects actually changed
  const prevProjectsRef = useRef(projects);
  if (projects !== prevProjectsRef.current && activeId === null) {
    prevProjectsRef.current = projects;
    setLocalProjects(projects);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Use org config or fall back to all statuses
  const columnsToShow = useMemo(() => {
    if (visibleColumns && visibleColumns.length > 0) return visibleColumns;
    return STATUS_OPTIONS.map((o) => o.value);
  }, [visibleColumns]);

  const projectsByStatus = useMemo(() => {
    const grouped: Partial<Record<ProjectStatus, ProjectData[]>> = {};
    for (const col of columnsToShow) {
      grouped[col] = [];
    }
    for (const project of localProjects) {
      if (grouped[project.status]) {
        grouped[project.status]!.push(project);
      }
    }
    return grouped;
  }, [localProjects, columnsToShow]);

  const activeProject = useMemo(
    () => localProjects.find((p) => p.id === activeId) ?? null,
    [localProjects, activeId]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);

      const { active, over } = event;
      if (!over) return;

      const projectId = String(active.id);
      const project = localProjects.find((p) => p.id === projectId);
      if (!project) return;

      let targetStatus: ProjectStatus | undefined;

      const overId = String(over.id);
      const statusValues = STATUS_OPTIONS.map((o) => o.value) as string[];
      if (statusValues.includes(overId)) {
        targetStatus = overId as ProjectStatus;
      } else {
        const overProject = localProjects.find((p) => p.id === overId);
        if (overProject) {
          targetStatus = overProject.status;
        }
      }

      if (!targetStatus || targetStatus === project.status) return;

      // Optimistic update — move the card locally without re-fetching
      setLocalProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, status: targetStatus! } : p
        )
      );

      // Persist to server in background
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        });
        if (!res.ok) {
          // Revert on failure
          setLocalProjects((prev) =>
            prev.map((p) =>
              p.id === projectId ? { ...p, status: project.status } : p
            )
          );
        }
      } catch {
        // Revert on error
        setLocalProjects((prev) =>
          prev.map((p) =>
            p.id === projectId ? { ...p, status: project.status } : p
          )
        );
      }
    },
    [localProjects, onProjectUpdated]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div ref={scrollRef} className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-6 md:px-6">
        <div className="flex gap-5 pt-1">
          {columnsToShow.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              projects={projectsByStatus[status] ?? []}
              label={columnLabels?.[status]}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeProject ? (
          <div className="w-72">
            <KanbanCard project={activeProject} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
