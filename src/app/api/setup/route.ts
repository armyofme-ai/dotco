import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const count = await prisma.user.count();
  return NextResponse.json({ needsSetup: count === 0 });
}

export async function POST(request: Request) {
  // Check if setup is already completed
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return NextResponse.json(
      { error: "Setup already completed." },
      { status: 409 }
    );
  }

  const body = await request.json();
  const { orgName, name, username, email, password } = body;

  // Validate required fields
  if (!orgName || !name || !username || !email || !password) {
    return NextResponse.json(
      { error: "All fields are required." },
      { status: 400 }
    );
  }

  // Validate username
  if (username.length < 3) {
    return NextResponse.json(
      { error: "Username must be at least 3 characters." },
      { status: 400 }
    );
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return NextResponse.json(
      { error: "Username can only contain letters, numbers, hyphens, and underscores." },
      { status: 400 }
    );
  }

  // Validate password
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  try {
    // Create organization
    const org = await prisma.organization.create({
      data: {
        name: orgName,
        timezone: "UTC",
      },
    });

    // Hash password and create owner user
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        name,
        username,
        email,
        passwordHash,
        role: "OWNER",
        organizationId: org.id,
      },
    });

    return NextResponse.json(
      { message: "Setup completed successfully." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Failed to complete setup. Please try again." },
      { status: 500 }
    );
  }
}
