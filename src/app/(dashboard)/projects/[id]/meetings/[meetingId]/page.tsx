import { MeetingDetail } from "@/components/meetings/meeting-detail";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string; meetingId: string }>;
}) {
  const { id, meetingId } = await params;

  return <MeetingDetail projectId={id} meetingId={meetingId} />;
}
