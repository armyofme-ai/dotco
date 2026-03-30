export type SpeakerEntry = string | { name: string; userId?: string; status?: "suggested" | "confirmed" };
export type SpeakerMap = Record<string, SpeakerEntry>;

export function resolveSpeakerName(entry: SpeakerEntry): string {
  if (typeof entry === "string") return entry;
  return entry.name;
}

export function resolveSpeakerUserId(entry: SpeakerEntry): string | null {
  if (typeof entry === "string") return null;
  return entry.userId ?? null;
}

export function parseSpeakerMap(raw: unknown): SpeakerMap {
  if (!raw || typeof raw !== "object") return {};
  return raw as SpeakerMap;
}
