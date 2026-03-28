import { Resend } from "resend";
import {
  generateMeetingIcs,
  generateMeetingCancelIcs,
  generateTaskIcs,
} from "@/lib/ics";

const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.AUTH_URL ||
  "http://localhost:3001";

interface EmailAttachment {
  filename: string;
  content: Buffer;
  content_type?: string;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: EmailAttachment[]
) {
  if (!process.env.RESEND_API_KEY) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Dotco <onboarding@resend.dev>",
    to,
    subject,
    html,
    attachments,
  });
}

export async function notifyAddedToProject(
  userEmail: string,
  userName: string,
  projectName: string,
  projectId: string,
  addedByName: string
) {
  const url = `${baseUrl}/projects/${projectId}`;
  await sendEmail(
    userEmail,
    `You've been added to ${projectName}`,
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
  <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 8px;">Added to ${projectName}</h2>
  <p style="color: #666; font-size: 14px; line-height: 1.6;">
    Hi ${userName}, ${addedByName} added you to the project <strong>${projectName}</strong>.
  </p>
  <a href="${url}" style="display: inline-block; margin: 24px 0; padding: 10px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">View Project</a>
</div>`
  );
}

export async function notifyTaskAssigned(
  userEmail: string,
  userName: string,
  taskTitle: string,
  projectName: string,
  projectId: string,
  assignedByName: string,
  dueDate?: string,
  taskId?: string
) {
  const url = `${baseUrl}/projects/${projectId}`;
  const dueLine = dueDate
    ? ` It's due on <strong>${dueDate}</strong>.`
    : "";

  const attachments: EmailAttachment[] = [];
  if (taskId && dueDate) {
    const icsString = generateTaskIcs({
      uid: `task-${taskId}@dotco`,
      title: taskTitle,
      description: `Task in ${projectName}: ${taskTitle}`,
      dueDate,
      url,
    });
    attachments.push({
      filename: "task.ics",
      content: Buffer.from(icsString, "utf-8"),
      content_type: "application/ics",
    });
  }

  await sendEmail(
    userEmail,
    `Task assigned: ${taskTitle}`,
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
  <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 8px;">New Task Assigned</h2>
  <p style="color: #666; font-size: 14px; line-height: 1.6;">
    Hi ${userName}, ${assignedByName} assigned you a task in <strong>${projectName}</strong>: <strong>${taskTitle}</strong>.${dueLine}
  </p>
  <a href="${url}" style="display: inline-block; margin: 24px 0; padding: 10px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">View Project</a>
</div>`,
    attachments.length > 0 ? attachments : undefined
  );
}

export async function notifyMeetingInvite(
  userEmail: string,
  userName: string,
  meetingName: string,
  projectName: string,
  projectId: string,
  meetingId: string,
  date: string,
  startTime: string,
  endTime: string,
  invitedByName: string,
  organizerEmail?: string,
  organizerName?: string,
  attendees?: { name: string; email: string }[]
) {
  const url = `${baseUrl}/projects/${projectId}/meetings/${meetingId}`;

  const attachments: EmailAttachment[] = [];
  if (organizerEmail && organizerName && attendees) {
    const icsString = generateMeetingIcs({
      uid: `meeting-${meetingId}@dotco`,
      title: meetingName,
      description: `Meeting in ${projectName}: ${meetingName}`,
      startDate: date,
      startTime,
      endTime,
      organizer: { name: organizerName, email: organizerEmail },
      attendees,
      url,
    });
    attachments.push({
      filename: "invite.ics",
      content: Buffer.from(icsString, "utf-8"),
      content_type: "application/ics",
    });
  }

  await sendEmail(
    userEmail,
    `Meeting invite: ${meetingName}`,
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
  <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 8px;">Meeting Invitation</h2>
  <p style="color: #666; font-size: 14px; line-height: 1.6;">
    Hi ${userName}, ${invitedByName} invited you to <strong>${meetingName}</strong> in <strong>${projectName}</strong> on <strong>${date}</strong> from <strong>${startTime}</strong> to <strong>${endTime}</strong>.
  </p>
  <a href="${url}" style="display: inline-block; margin: 24px 0; padding: 10px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">View Meeting</a>
</div>`,
    attachments.length > 0 ? attachments : undefined
  );
}

export async function notifyMeetingTranscriptReady(
  userEmail: string,
  userName: string,
  meetingName: string,
  projectName: string,
  projectId: string,
  meetingId: string
) {
  const url = `${baseUrl}/projects/${projectId}/meetings/${meetingId}`;
  await sendEmail(
    userEmail,
    `Transcript ready: ${meetingName}`,
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
  <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 8px;">Transcript Ready</h2>
  <p style="color: #666; font-size: 14px; line-height: 1.6;">
    Hi ${userName}, the transcript and summary for <strong>${meetingName}</strong> in <strong>${projectName}</strong> are ready for review.
  </p>
  <a href="${url}" style="display: inline-block; margin: 24px 0; padding: 10px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">View Transcript</a>
</div>`
  );
}

export async function notifyMeetingCancelled(
  userEmail: string,
  userName: string,
  meetingName: string,
  projectName: string,
  meetingId: string,
  meetingDate: string,
  meetingStartTime: string,
  meetingEndTime: string,
  organizerEmail: string,
  organizerName: string
) {
  const icsString = generateMeetingCancelIcs({
    uid: `meeting-${meetingId}@dotco`,
    title: meetingName,
    startDate: meetingDate,
    startTime: meetingStartTime,
    endTime: meetingEndTime,
    organizer: { name: organizerName, email: organizerEmail },
    attendees: [{ name: userName, email: userEmail }],
  });

  await sendEmail(
    userEmail,
    `Cancelled: ${meetingName}`,
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
  <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 8px;">Meeting Cancelled</h2>
  <p style="color: #666; font-size: 14px; line-height: 1.6;">
    Hi ${userName}, ${organizerName} has cancelled <strong>${meetingName}</strong> in <strong>${projectName}</strong>.
  </p>
</div>`,
    [{ filename: "cancel.ics", content: Buffer.from(icsString, "utf-8"), content_type: "application/ics" }]
  );
}
