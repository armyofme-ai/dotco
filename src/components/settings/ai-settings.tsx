"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
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

interface AIConfig {
  llmProvider: string;
  llmModel: string;
  llmApiKeySet: boolean;
  deepgramApiKeySet: boolean;
  resendApiKeySet: boolean;
  llmEnvKeySet: boolean;
  deepgramEnvKeySet: boolean;
  resendEnvKeySet: boolean;
}

function KeyStatus({
  configured,
  envFallback,
}: {
  configured: boolean;
  envFallback: boolean;
}) {
  if (configured) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <CheckCircle2 className="size-3.5" />
        Configured
      </span>
    );
  }
  if (envFallback) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <CheckCircle2 className="size-3.5" />
        Using environment variable
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
      <AlertCircle className="size-3.5" />
      Not configured
    </span>
  );
}

export function AISettings() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // LLM form state
  const [llmProvider, setLlmProvider] = useState("openai");
  const [llmModel, setLlmModel] = useState("");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [savingLlm, setSavingLlm] = useState(false);

  // Deepgram form state
  const [deepgramApiKey, setDeepgramApiKey] = useState("");
  const [savingDeepgram, setSavingDeepgram] = useState(false);

  // Resend form state
  const [resendApiKey, setResendApiKey] = useState("");
  const [savingResend, setSavingResend] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/ai");
      if (!res.ok) throw new Error("Failed to fetch AI config");
      const data: AIConfig = await res.json();
      setConfig(data);
      setLlmProvider(data.llmProvider);
      setLlmModel(data.llmModel === "gpt-4o" ? "" : data.llmModel);
    } catch {
      toast.error("Failed to load AI configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function handleSaveLlm() {
    setSavingLlm(true);
    try {
      const body: Record<string, string> = {
        llmProvider,
        llmModel: llmModel || "gpt-4o",
      };
      if (llmApiKey) body.llmApiKey = llmApiKey;

      const res = await fetch("/api/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const data: AIConfig = await res.json();
      setConfig(data);
      setLlmApiKey("");
      toast.success("LLM settings saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save LLM settings"
      );
    } finally {
      setSavingLlm(false);
    }
  }

  async function handleSaveDeepgram() {
    setSavingDeepgram(true);
    try {
      const res = await fetch("/api/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deepgramApiKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const data: AIConfig = await res.json();
      setConfig(data);
      setDeepgramApiKey("");
      toast.success("Deepgram settings saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save Deepgram settings"
      );
    } finally {
      setSavingDeepgram(false);
    }
  }

  async function handleSaveResend() {
    setSavingResend(true);
    try {
      const res = await fetch("/api/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resendApiKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const data: AIConfig = await res.json();
      setConfig(data);
      setResendApiKey("");
      toast.success("Resend settings saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save Resend settings"
      );
    } finally {
      setSavingResend(false);
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
    <div className="space-y-6">
      {/* Section 1: LLM */}
      <Card>
        <CardHeader>
          <CardTitle>LLM (Meeting Summarization)</CardTitle>
          <CardDescription>
            Configure the language model used for meeting summarization and
            analysis. Defaults to OpenAI gpt-4o if not set.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="llm-provider">Provider</Label>
              <Select value={llmProvider} onValueChange={(v) => v && setLlmProvider(v)}>
                <SelectTrigger id="llm-provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="llm-model">Model</Label>
              <Input
                id="llm-model"
                placeholder="gpt-4o"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="llm-api-key">API Key</Label>
              {config && (
                <KeyStatus
                  configured={config.llmApiKeySet}
                  envFallback={config.llmEnvKeySet}
                />
              )}
            </div>
            <Input
              id="llm-api-key"
              type="password"
              placeholder={
                config?.llmApiKeySet
                  ? "Enter new key to replace existing"
                  : "sk-..."
              }
              value={llmApiKey}
              onChange={(e) => setLlmApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {llmProvider === "openai"
                ? "Get your API key from platform.openai.com"
                : "Get your API key from console.anthropic.com"}
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveLlm} disabled={savingLlm}>
              {savingLlm && <Loader2 className="animate-spin" />}
              {savingLlm ? "Saving..." : "Save LLM Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Transcription (Deepgram) */}
      <Card>
        <CardHeader>
          <CardTitle>Transcription (Deepgram)</CardTitle>
          <CardDescription>
            Configure the Deepgram API key used for audio transcription and
            speaker diarization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="deepgram-api-key">API Key</Label>
              {config && (
                <KeyStatus
                  configured={config.deepgramApiKeySet}
                  envFallback={config.deepgramEnvKeySet}
                />
              )}
            </div>
            <Input
              id="deepgram-api-key"
              type="password"
              placeholder={
                config?.deepgramApiKeySet
                  ? "Enter new key to replace existing"
                  : "Enter your Deepgram API key"
              }
              value={deepgramApiKey}
              onChange={(e) => setDeepgramApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Get your API key from console.deepgram.com
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveDeepgram} disabled={savingDeepgram}>
              {savingDeepgram && <Loader2 className="animate-spin" />}
              {savingDeepgram ? "Saving..." : "Save Deepgram Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Email Notifications (Resend) */}
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications (Resend)</CardTitle>
          <CardDescription>
            Configure the Resend API key used for sending email notifications
            (meeting invites, task assignments, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="resend-api-key">API Key</Label>
              {config && (
                <KeyStatus
                  configured={config.resendApiKeySet}
                  envFallback={config.resendEnvKeySet}
                />
              )}
            </div>
            <Input
              id="resend-api-key"
              type="password"
              placeholder={
                config?.resendApiKeySet
                  ? "Enter new key to replace existing"
                  : "re_..."
              }
              value={resendApiKey}
              onChange={(e) => setResendApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Get your API key from resend.com/api-keys
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveResend} disabled={savingResend}>
              {savingResend && <Loader2 className="animate-spin" />}
              {savingResend ? "Saving..." : "Save Resend Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
