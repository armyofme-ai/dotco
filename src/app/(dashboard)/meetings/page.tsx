import { MyMeetingsView } from "@/components/meetings/my-meetings-view";

export const metadata = {
  title: "Meetings",
};

export default function MeetingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <MyMeetingsView />
    </div>
  );
}
