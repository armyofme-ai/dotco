"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Camera, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface UserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string | null;
  role: string;
  createdAt: string;
}

interface ProfileViewProps {
  userId: string;
  userEmail: string;
  userRole: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ProfileView({ userId, userEmail, userRole }: ProfileViewProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile form state
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch profile");
      const data: UserProfile = await res.json();
      setProfile(data);
      setName(data.name);
      setUsername(data.username);
    } catch {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function handleSaveProfile() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (username.trim().includes(" ")) {
      toast.error("Username cannot contain spaces");
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update profile");
      }

      const updated: UserProfile = await res.json();
      setProfile(updated);
      toast.success("Profile updated successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update profile"
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (!currentPassword) {
      toast.error("Current password is required");
      return;
    }
    if (!newPassword) {
      toast.error("New password is required");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch(`/api/users/${userId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to change password");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to change password"
      );
    } finally {
      setSavingPassword(false);
    }
  }

  const profileHasChanges =
    profile &&
    (name !== profile.name || username !== profile.username);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your personal details and how others see you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar section */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="size-20">
                {profile?.avatar && (
                  <AvatarImage src={profile.avatar} alt={profile.name} />
                )}
                <AvatarFallback className="text-lg">
                  {getInitials(profile?.name ?? "")}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background transition-colors hover:bg-primary/90"
                onClick={() =>
                  toast.info("Avatar upload is not yet available")
                }
              >
                <Camera className="size-3.5" />
                <span className="sr-only">Change avatar</span>
              </button>
            </div>
            <div>
              <p className="text-sm font-medium">{profile?.name}</p>
              <p className="text-xs text-muted-foreground">
                Click the camera icon to update your photo
              </p>
            </div>
          </div>

          <Separator />

          {/* Editable fields */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="profile-name">Full name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profile-username">Username</Label>
              <Input
                id="profile-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your-username"
              />
              <p className="text-xs text-muted-foreground">
                Your unique identifier. No spaces allowed.
              </p>
            </div>
          </div>

          <Separator />

          {/* Read-only fields */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Email</Label>
              <Input value={userEmail} disabled />
              <p className="text-xs text-muted-foreground">
                Contact an administrator to change your email address.
              </p>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Role</Label>
              <div>
                <Badge
                  variant={userRole === "OWNER" ? "default" : "secondary"}
                >
                  {userRole === "OWNER" ? "Owner" : "Member"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSaveProfile}
              disabled={savingProfile || !profileHasChanges}
            >
              {savingProfile && <Loader2 className="animate-spin" />}
              {savingProfile ? "Saving..." : "Save changes"}
            </Button>
            {profileHasChanges && (
              <p className="text-xs text-muted-foreground">
                You have unsaved changes.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" />
            <div>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                autoComplete="current-password"
              />
            </div>

            <Separator />

            <div className="grid gap-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
              />
              {newPassword &&
                confirmPassword &&
                newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">
                    Passwords do not match.
                  </p>
                )}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={
                  savingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
              >
                {savingPassword && <Loader2 className="animate-spin" />}
                {savingPassword ? "Changing..." : "Change password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
