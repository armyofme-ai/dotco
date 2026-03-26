import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { Resend } from "resend";

// GET /api/invitations - List pending invitations for the organization
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: session.user.organizationId,
        expiresAt: { gt: new Date() },
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invitations);
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}

// POST /api/invitations - Create a new invitation (owner only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only owners can create invitations" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user already exists with this email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Check if there's already a pending invitation for this email
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email,
        organizationId: session.user.organizationId,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvitation) {
      return NextResponse.json(
        { error: "A pending invitation already exists for this email" },
        { status: 400 }
      );
    }

    // Get organization settings for invitation expiry
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
    });

    const expiryDays = organization?.invitationExpiry ?? 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const invitation = await prisma.invitation.create({
      data: {
        email,
        token: uuidv4(),
        expiresAt,
        invitedById: session.user.id,
        organizationId: session.user.organizationId,
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Send invitation email via Resend
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3001";
        const inviteUrl = `${baseUrl}/invite/${invitation.token}`;

        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "Dotco <onboarding@resend.dev>",
          to: email,
          subject: `You're invited to join ${organization?.name ?? "Dotco"}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
              <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 8px;">${organization?.name ?? "Dotco"}</h2>
              <p style="color: #666; font-size: 14px; line-height: 1.6;">
                ${session.user.name} has invited you to join <strong>${organization?.name ?? "the team"}</strong> on Dotco.
              </p>
              <a href="${inviteUrl}" style="display: inline-block; margin: 24px 0; padding: 10px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
                Accept Invitation
              </a>
              <p style="color: #999; font-size: 12px;">
                This invitation expires in ${expiryDays} days. If you didn't expect this, you can ignore this email.
              </p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
        // Don't fail the invitation creation if email fails
      }
    }

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    console.error("Error creating invitation:", error);
    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }
}
