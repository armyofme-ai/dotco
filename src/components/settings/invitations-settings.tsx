"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Clock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Invitation {
  id: string;
  email: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: {
    id: string;
    name: string;
    email: string;
  };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isExpired(dateStr: string): boolean {
  return new Date(dateStr) < new Date();
}

function getTimeRemaining(dateStr: string): string {
  const now = new Date();
  const expires = new Date(dateStr);
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs <= 0) return "Expired";

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );

  if (diffDays > 0) return `${diffDays}d ${diffHours}h remaining`;
  if (diffHours > 0) return `${diffHours}h remaining`;
  return "Less than 1h remaining";
}

export function InvitationsSettings() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sending, setSending] = useState(false);

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<Invitation | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await fetch("/api/invitations");
      if (!res.ok) throw new Error("Failed to fetch invitations");
      const data: Invitation[] = await res.json();
      setInvitations(data);
    } catch {
      toast.error("Failed to load invitations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();

    const email = inviteEmail.trim();
    if (!email) {
      toast.error("Please enter an email address");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invitation");
      }

      const invitation: Invitation = await res.json();
      setInvitations((prev) => [invitation, ...prev]);
      setInviteEmail("");
      setInviteOpen(false);
      toast.success(`Invitation sent to ${email}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send invitation"
      );
    } finally {
      setSending(false);
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/invitations/${cancelTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel invitation");
      }
      setInvitations((prev) =>
        prev.filter((inv) => inv.id !== cancelTarget.id)
      );
      toast.success("Invitation cancelled");
      setCancelTarget(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to cancel invitation"
      );
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Invitations</CardTitle>
              <CardDescription>
                Invite new members to your organization. Pending invitations will
                expire based on your invitation expiry setting.
              </CardDescription>
            </div>
            <Button onClick={() => setInviteOpen(true)} className="shrink-0">
              <Plus className="size-4" />
              Invite User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <Mail className="mb-3 size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                No pending invitations
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Click &ldquo;Invite User&rdquo; to send an invitation.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Invited by</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => {
                  const expired = isExpired(inv.expiresAt);
                  return (
                    <TableRow
                      key={inv.id}
                      className={expired ? "opacity-50" : ""}
                    >
                      <TableCell className="font-medium">
                        {inv.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {inv.invitedBy.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(inv.createdAt)}
                      </TableCell>
                      <TableCell>
                        {expired ? (
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="size-3" />
                            Expired
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <Clock className="size-3" />
                            {getTimeRemaining(inv.expiresAt)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!expired && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setCancelTarget(inv)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">
                              Cancel invitation for {inv.email}
                            </span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <form onSubmit={handleInvite}>
            <DialogHeader>
              <DialogTitle>Invite a new member</DialogTitle>
              <DialogDescription>
                Send an invitation link to a new team member. They will receive
                an email with instructions to join your organization.
              </DialogDescription>
            </DialogHeader>
            <div className="my-4 grid gap-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={sending || !inviteEmail.trim()}>
                {sending && <Loader2 className="animate-spin" />}
                {sending ? "Sending..." : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel invitation</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the invitation for{" "}
              <span className="font-medium text-foreground">
                {cancelTarget?.email}
              </span>
              ? The invitation link will no longer be valid.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
              disabled={cancelling}
            >
              Keep invitation
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling && <Loader2 className="animate-spin" />}
              {cancelling ? "Cancelling..." : "Cancel invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
