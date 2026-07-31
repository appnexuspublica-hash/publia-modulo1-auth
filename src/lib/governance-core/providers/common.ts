import { normalizeRecoveryText } from "@/lib/governance/recovery/normalize";

export function tokenSet(value: string) {
  return new Set(normalizeRecoveryText(value).split(/\s+/).filter((term) => term.length >= 3));
}

export function lexicalScore(question: string, title: string, content: string) {
  const q = tokenSet(question);
  const titleTokens = tokenSet(title);
  const contentTokens = tokenSet(content);
  let score = 0;
  for (const term of q) {
    if (titleTokens.has(term)) score += 8;
    if (contentTokens.has(term)) score += 2;
  }
  return score;
}

export function containsAll(text: string, required: string[]) {
  const normalized = normalizeRecoveryText(text);
  return required.length === 0 || required.every((term) => normalized.includes(term));
}

export async function createStableSourceUrl(client: any, bucket: string, path: string | null | undefined, fallback?: string | null) {
  if (!path) return String(fallback ?? "").trim() || null;
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return !error && data?.signedUrl ? String(data.signedUrl) : String(fallback ?? "").trim() || null;
}
