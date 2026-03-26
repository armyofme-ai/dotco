"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2Icon, SearchIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface OrgUser {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string | null;
  role: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface AddMemberDialogProps {
  projectId: string;
  existingMemberIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberAdded: () => Promise<void>;
}

export function AddMemberDialog({
  projectId,
  existingMemberIds,
  open,
  onOpenChange,
  onMemberAdded,
}: AddMemberDialogProps) {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  // Fetch org users when dialog opens
  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }

    async function fetchUsers() {
      setLoading(true);
      try {
        const res = await fetch("/api/users");
        if (!res.ok) throw new Error("Failed to load users");
        const data = await res.json();
        setUsers(data);
      } catch {
        toast.error("Failed to load users");
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, [open]);

  const availableUsers = useMemo(() => {
    const filtered = users.filter(
      (u) => !existingMemberIds.includes(u.id)
    );
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, existingMemberIds, search]);

  const handleAdd = useCallback(
    async (userId: string) => {
      setAddingUserId(userId);
      try {
        const res = await fetch(`/api/projects/${projectId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to add member");
        }
        toast.success("Member added to project");
        await onMemberAdded();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to add member"
        );
      } finally {
        setAddingUserId(null);
      }
    },
    [projectId, onMemberAdded]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
          <DialogDescription>
            Select a team member to add to this project.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, username, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* User list */}
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : availableUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <UsersIcon className="mb-2 size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {search.trim()
                  ? "No matching users found."
                  : "All team members are already in this project."}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {availableUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                >
                  <Avatar size="default">
                    {user.avatar && (
                      <AvatarImage src={user.avatar} alt={user.name} />
                    )}
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{user.username}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleAdd(user.id)}
                    disabled={addingUserId === user.id}
                  >
                    {addingUserId === user.id ? (
                      <Loader2Icon className="size-3 animate-spin" />
                    ) : (
                      <UserPlusIcon className="size-3" />
                    )}
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
