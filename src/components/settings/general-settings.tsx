"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Mexico_City",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

const PROJECT_STATUSES = [
  { value: "backlog", label: "Backlog" },
  { value: "planning", label: "Planning" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "in_review", label: "In Review" },
];

interface OrgSettings {
  id: string;
  name: string;
  logo: string | null;
  timezone: string;
  sessionTimeout: number;
  invitationExpiry: number;
  defaultProjectStatus: string;
}

export function GeneralSettings() {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [invitationExpiry, setInvitationExpiry] = useState(7);
  const [defaultProjectStatus, setDefaultProjectStatus] = useState("backlog");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data: OrgSettings = await res.json();
      setSettings(data);
      setName(data.name);
      setTimezone(data.timezone);
      setSessionTimeout(data.sessionTimeout);
      setInvitationExpiry(data.invitationExpiry);
      setDefaultProjectStatus(data.defaultProjectStatus);
    } catch {
      toast.error("Failed to load organization settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Organization name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          timezone,
          sessionTimeout,
          invitationExpiry,
          defaultProjectStatus,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      const updated: OrgSettings = await res.json();
      setSettings(updated);
      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  }

  const hasChanges =
    settings &&
    (name !== settings.name ||
      timezone !== settings.timezone ||
      sessionTimeout !== settings.sessionTimeout ||
      invitationExpiry !== settings.invitationExpiry ||
      defaultProjectStatus !== settings.defaultProjectStatus);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            Basic information about your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="org-name">Organization name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your organization name"
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              This is the name displayed across your workspace.
            </p>
          </div>

          <Separator />

          <div className="grid gap-2">
            <Label htmlFor="timezone">Default timezone</Label>
            <Select value={timezone} onValueChange={(v) => v && setTimezone(v)}>
              <SelectTrigger id="timezone" className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used as the default timezone for scheduling and display.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security & Defaults</CardTitle>
          <CardDescription>
            Configure session behavior, invitation policies, and project
            defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="session-timeout">Session timeout (minutes)</Label>
            <Input
              id="session-timeout"
              type="number"
              min={5}
              max={1440}
              value={sessionTimeout}
              onChange={(e) => setSessionTimeout(Number(e.target.value))}
              className="max-w-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              How long before an inactive session expires. Between 5 and 1440
              minutes.
            </p>
          </div>

          <Separator />

          <div className="grid gap-2">
            <Label htmlFor="invitation-expiry">
              Invitation expiry (days)
            </Label>
            <Input
              id="invitation-expiry"
              type="number"
              min={1}
              max={90}
              value={invitationExpiry}
              onChange={(e) => setInvitationExpiry(Number(e.target.value))}
              className="max-w-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              How many days before a pending invitation link expires. Between 1
              and 90 days.
            </p>
          </div>

          <Separator />

          <div className="grid gap-2">
            <Label htmlFor="default-status">Default project status</Label>
            <Select
              value={defaultProjectStatus}
              onValueChange={(v) => v && setDefaultProjectStatus(v)}
            >
              <SelectTrigger id="default-status" className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The initial status assigned to newly created projects.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving && <Loader2 className="animate-spin" />}
          {saving ? "Saving..." : "Save changes"}
        </Button>
        {hasChanges && (
          <p className="text-xs text-muted-foreground">
            You have unsaved changes.
          </p>
        )}
      </div>
    </div>
  );
}
