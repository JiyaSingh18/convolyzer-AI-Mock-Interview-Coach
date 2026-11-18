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
