"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Copy, Check, AlertTriangle } from "lucide-react";
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

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export function ApiKeysSettings() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3001";
  const mcpUrl = `${appUrl}/api/mcp`;

  const claudeCodeConfig = JSON.stringify({
    mcpServers: {
      dotco: {
        type: "url",
        url: mcpUrl,
        headers: { Authorization: "Bearer YOUR_API_KEY" },
      },
    },
  }, null, 2);

  const claudeDesktopConfig = JSON.stringify({
    mcpServers: {
      dotco: {
        command: "npx",
        args: [
          "mcp-remote",
          mcpUrl,
          "--header",
          "Authorization: Bearer YOUR_API_KEY",
        ],
      },
    },
  }, null, 2);

  // Generate dialog state
  const [generateOpen, setGenerateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [generating, setGenerating] = useState(false);

  // Reveal dialog state (shows newly created key)
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchApiKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/api-keys");
      if (!res.ok) throw new Error("Failed to fetch API keys");
      const data: ApiKey[] = await res.json();
      setApiKeys(data);
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  async function handleGenerate() {
    if (!keyName.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate API key");
      }

      const data = await res.json();

      // Add the new key to the list (without the full key)
      const { key, ...apiKeyData } = data;
      setApiKeys((prev) => [apiKeyData, ...prev]);

      // Close generate dialog and open reveal dialog
      setGenerateOpen(false);
      setKeyName("");
      setRevealedKey(key);
      setRevealOpen(true);
      setCopied(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate API key"
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      toast.success("API key copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/api-keys/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete API key");
      }
      setApiKeys((prev) => prev.filter((k) => k.id !== deleteTarget.id));
      toast.success(`API key "${deleteTarget.name}" has been revoked`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete API key"
      );
    } finally {
      setDeleting(false);
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage API keys for programmatic access to your organization.
                Keys are used to authenticate MCP and other API integrations.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setGenerateOpen(true)}
              className="shrink-0"
            >
              <Plus className="size-4" />
              Generate API Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-20 text-center text-muted-foreground"
                  >
                    No API keys yet. Generate one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                apiKeys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell className="font-medium">
                      {apiKey.name}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {apiKey.keyPrefix}...
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {apiKey.createdBy.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeDate(apiKey.lastUsedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(apiKey.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(apiKey)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">
                          Delete {apiKey.name}
                        </span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Connect to Claude</CardTitle>
          <CardDescription>
            Connect your AI assistant to access your projects, meetings, transcripts, and tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Steps */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Quick setup</h4>
            <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>Generate an API key above</li>
              <li>Copy the configuration below</li>
              <li>Replace <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">YOUR_API_KEY</code> with your key</li>
              <li>Restart Claude</li>
            </ol>
          </div>

          {/* Claude Code */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Claude Code</h4>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(claudeCodeConfig);
                  toast.success("Copied to clipboard");
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Copy className="size-3" />
                Copy
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add to your project&apos;s <code className="rounded bg-muted px-1 py-0.5 font-mono">.mcp.json</code> or global Claude Code settings
            </p>
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
              {claudeCodeConfig}
            </pre>
          </div>

          {/* Claude Desktop */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Claude Desktop</h4>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(claudeDesktopConfig);
                  toast.success("Copied to clipboard");
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Copy className="size-3" />
                Copy
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add to <code className="rounded bg-muted px-1 py-0.5 font-mono">~/Library/Application Support/Claude/claude_desktop_config.json</code> (Mac) or <code className="rounded bg-muted px-1 py-0.5 font-mono">%APPDATA%\Claude\claude_desktop_config.json</code> (Windows). Requires <code className="rounded bg-muted px-1 py-0.5 font-mono">npx mcp-remote</code> (installed automatically on first run).
            </p>
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
              {claudeDesktopConfig}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Generate API Key dialog */}
      <Dialog
        open={generateOpen}
        onOpenChange={(open) => {
          if (!open) {
            setGenerateOpen(false);
            setKeyName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
            <DialogDescription>
              Give this key a descriptive name so you can identify it later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="key-name">Name</Label>
            <Input
              id="key-name"
              placeholder='e.g. "Claude Desktop", "CI/CD Pipeline"'
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && keyName.trim()) {
                  handleGenerate();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setGenerateOpen(false);
                setKeyName("");
              }}
              disabled={generating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !keyName.trim()}
            >
              {generating && <Loader2 className="animate-spin" />}
              {generating ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal key dialog */}
      <Dialog
        open={revealOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRevealOpen(false);
            setRevealedKey(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Generated</DialogTitle>
            <DialogDescription>
              Your new API key has been created. Make sure to copy it now.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={revealedKey ?? ""}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                <span className="sr-only">Copy API key</span>
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                Copy this key now. You won&apos;t be able to see it again.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setRevealOpen(false);
                setRevealedKey(null);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke the API key{" "}
              <span className="font-medium text-foreground">
                &quot;{deleteTarget?.name}&quot;
              </span>
              ? Any integrations using this key will immediately lose access.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="animate-spin" />}
              {deleting ? "Revoking..." : "Revoke key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
