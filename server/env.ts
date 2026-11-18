import { config } from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load env vars for local development. On Vercel these files don't exist and the
// values come from Project Settings > Environment Variables instead.
const serverDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(serverDir, '.env') });
config(); // also allow a .env in the project root

function splitKeys(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

/** All configured Gemini keys (GEMINI_API_KEY first, then GEMINI_API_KEYS). */
export function getGeminiApiKeys(): string[] {
  return Array.from(
    new Set([
      ...splitKeys(process.env.GEMINI_API_KEY),
      ...splitKeys(process.env.GEMINI_API_KEYS),
      ...splitKeys(process.env.EXPO_PUBLIC_GEMINI_API_KEY),
      ...splitKeys(process.env.EXPO_PUBLIC_GEMINI_API_KEYS)
    ])
  );
}

export function getGeminiApiKey(): string | undefined {
  return getGeminiApiKeys()[0];
}

/** Gemini model used by the classic endpoints. gemini-1.5-* models have been retired by Google. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/**
 * Gemini 2.5 Flash "thinks" before answering by default, which adds many seconds of
 * latency (and the thinking tokens eat into maxOutputTokens, which can truncate the JSON
 * we ask for). None of our prompts need it, so turn thinking off for Flash models.
 * 2.5 Pro cannot disable thinking, so leave it alone there.
 */
export function withFastThinking<T extends Record<string, unknown>>(config: T, model: string = GEMINI_MODEL): T {
  const m = model.toLowerCase();
  if (m.includes('2.5') && m.includes('flash')) {
    return { ...config, thinkingConfig: { thinkingBudget: 0 } } as T;
  }
  return config;
}

/** Upper bound for one Gemini request, so a slow or stuck call can't hang a request. */
export const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 7000;

/** Remove anything that looks like an API key from a string before logging or returning it. */
export function redactSecrets(text: string): string {
  return text.replace(/AIza[0-9A-Za-z_\-]{20,}/g, '[redacted]').replace(/sk-[0-9A-Za-z_\-]{16,}/g, '[redacted]');
}

/** Last Gemini outcome, exposed (without secrets) by GET /api/health for debugging. */
export const geminiStatus: { lastOk: string | null; lastError: string | null; lastErrorAt: string | null } = {
  lastOk: null,
  lastError: null,
  lastErrorAt: null
};

export function recordGeminiResult(error?: unknown): void {
  if (!error) {
    geminiStatus.lastOk = new Date().toISOString();
    return;
  }
  const msg = error instanceof Error ? error.message : String(error);
  geminiStatus.lastError = redactSecrets(msg).slice(0, 300);
  geminiStatus.lastErrorAt = new Date().toISOString();
}
