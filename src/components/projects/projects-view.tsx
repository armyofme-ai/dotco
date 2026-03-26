"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, Columns3, Plus, Loader2 } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectListView } from "@/components/projects/project-list-view";
import { ProjectKanbanView } from "@/components/projects/project-kanban-view";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import type { ProjectStatus } from "@/generated/prisma/client";

export interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  _count?: {
    members: number;
    tasks: number;
    meetings: number;
  };
}

export function ProjectsView() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [kanbanColumns, setKanbanColumns] = useState<string[] | null>(null);
  const [kanbanLabels, setKanbanLabels] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      setProjects(data);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.kanbanColumns && Array.isArray(data.kanbanColumns)) {
          setKanbanColumns(data.kanbanColumns);
        }
        if (data.kanbanLabels && typeof data.kanbanLabels === "object") {
          setKanbanLabels(data.kanbanLabels);
        }
      }
    } catch {
      // use defaults
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchSettings();
  }, [fetchProjects, fetchSettings]);

  const handleProjectCreated = () => {
    setDialogOpen(false);
    fetchProjects();
  };

  const handleProjectUpdated = () => {
    fetchProjects();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Projects
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage and track your team&apos;s projects
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          <Plus className="size-3.5" />
          New Project
        </button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">
            <LayoutGrid className="size-3.5" />
            <span className="text-sm">List</span>
          </TabsTrigger>
          <TabsTrigger value="kanban">
            <Columns3 className="size-3.5" />
            <span className="text-sm">Kanban</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ProjectListView projects={projects} />
          )}
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ProjectKanbanView
              projects={projects}
              onProjectUpdated={handleProjectUpdated}
              visibleColumns={kanbanColumns as ProjectStatus[] | null}
              columnLabels={kanbanLabels}
            />
          )}
        </TabsContent>
      </Tabs>

      <CreateProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleProjectCreated}
      />
    </div>
  );
}
