import { ProjectsView } from "@/components/projects/projects-view";

export const metadata = {
  title: "Projects",
};

export default function ProjectsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <ProjectsView />
    </div>
  );
}
