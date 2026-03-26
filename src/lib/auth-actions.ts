"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function registerFromInvitation(formData: FormData) {
  const token = formData.get("token") as string;
  const name = formData.get("name") as string;
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!token || !name || !username || !password || !confirmPassword) {
    return { error: "All fields are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  if (username.length < 3) {
    return { error: "Username must be at least 3 characters." };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return {
      error: "Username can only contain letters, numbers, hyphens, and underscores.",
    };
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    return { error: "Invalid invitation." };
  }

  if (new Date() > invitation.expiresAt) {
    return { error: "This invitation has expired." };
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: invitation.email }, { username }],
    },
  });

  if (existingUser) {
    if (existingUser.email === invitation.email) {
      return { error: "An account with this email already exists." };
    }
    return { error: "This username is already taken." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        name,
        username,
        email: invitation.email,
        passwordHash,
        organizationId: invitation.organizationId,
        role: "MEMBER",
      },
    });

    await tx.invitation.delete({
      where: { id: invitation.id },
    });
  });

  return { success: true };
}

export async function getCurrentUser() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return session.user;
}
