import { MyTasksView } from "@/components/tasks/my-tasks-view";

export const metadata = {
  title: "Tasks",
};

export default function TasksPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <MyTasksView />
    </div>
  );
}
