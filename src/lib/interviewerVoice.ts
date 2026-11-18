/**
 * Makes the browser's built-in speech synthesis sound as human as it can:
 * - picks the most natural female English voice the browser offers
 *   (Edge "Natural" voices, Apple Premium/Enhanced voices, Google voices, Samantha...)
 * - waits for the voice list to load (voiceschanged) so that choice actually sticks
 * - speaks sentence by sentence with short pauses, at a calm conversational rate
 *
 * To force a specific voice for a demo, run in the browser console:
 *   localStorage.setItem('convolyzer.voice', 'Samantha')   // any part of the voice name
 */

const VOICE_OVERRIDE_KEY = 'convolyzer.voice';

export const VOICE_RATE = 0.95;
export const VOICE_PITCH = 1.0;
const SENTENCE_PAUSE_MS = 280;
const CLAUSE_PAUSE_MS = 120;

// Female voices that sound natural, best first. Matched against voice.name (case-insensitive).
const NATURAL_FEMALE_NAMES = [
  // Microsoft Edge online neural voices
  'aria', 'jenny', 'ava', 'emma', 'michelle', 'sonia', 'libby', 'natasha', 'clara', 'neerja',
  // Apple voices (best when "Premium"/"Enhanced" versions are downloaded)
  'zoe', 'samantha', 'allison', 'susan', 'serena', 'kate', 'karen', 'moira', 'tessa', 'veena', 'victoria', 'fiona',
  // Google Chrome voices ("Google US English" is a female voice)
  'google uk english female', 'google us english',
  // Windows desktop
  'zira', 'hazel', 'heera'
];

const MALE_HINTS = ['male', 'daniel', 'alex', 'fred', 'tom', 'aaron', 'arthur', 'oliver', 'rishi', 'david', 'mark', 'guy', 'ryan', 'george', 'james', 'gordon', 'evan', 'nathan', 'reed', 'rocko', 'eddy', 'grandpa', 'ralph', 'junior', 'albert'];

// macOS novelty / old "Eloquence" voices that sound robotic.
const ROBOTIC_NAMES = [
  'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'good news', 'jester', 'organ', 'superstar',
  'trinoids', 'whisper', 'wobble', 'zarvox', 'grandma', 'grandpa', 'shelley', 'sandy', 'flo', 'kathy', 'princess',
  'deranged', 'hysterical', 'pipe organ'
];

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const lang = (voice.lang || '').toLowerCase().replace('_', '-');
  if (!lang.startsWith('en')) return -1;
  if (ROBOTIC_NAMES.some((n) => name.includes(n))) return -1;

  const femaleIdx = NATURAL_FEMALE_NAMES.findIndex((n) => name.includes(n));
  const looksMale = !name.includes('female') && MALE_HINTS.some((n) => new RegExp(`\\b${n}\\b`).test(name));
  if (looksMale && femaleIdx === -1) return -1;

  let score = 0;
  if (femaleIdx !== -1) score += 100 - femaleIdx; // known natural female voice
  else if (name.includes('female')) score += 40;
  else score += 5; // unknown English voice: last resort

  if (name.includes('natural') || name.includes('neural') || name.includes('online')) score += 200;
  if (name.includes('premium')) score += 160;
  if (name.includes('enhanced')) score += 140;
  if (name.startsWith('google')) score += 60;

  if (lang === 'en-us' || lang === 'en-gb') score += 10;
  else if (lang === 'en-in' || lang === 'en-au' || lang === 'en-ie') score += 5;
  return score;
}

export function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  let override: string | null = null;
  try {
    override = window.localStorage.getItem(VOICE_OVERRIDE_KEY);
  } catch {
    // localStorage unavailable (private mode etc.)
  }
  if (override) {
    const forced = voices.find((v) => v.name.toLowerCase().includes(override!.toLowerCase()));
    if (forced) return forced;
  }

  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const s = scoreVoice(v);
    if (s > bestScore) {
      best = v;
      bestScore = s;
    }
  }
  return bestScore >= 0 ? best : null;
}

/** Resolves with the voice list, waiting (briefly) for voiceschanged if it isn't loaded yet. */
export function loadVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  if (!synth) return Promise.resolve([]);
  const now = synth.getVoices();
  if (now.length > 0) return Promise.resolve(now);

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synth.removeEventListener?.('voiceschanged', onChange);
      resolve(synth.getVoices());
    };
    const onChange = () => {
      if (synth.getVoices().length > 0) finish();
    };
    synth.addEventListener?.('voiceschanged', onChange);
    window.setTimeout(finish, timeoutMs);
  });
}

/** Light clean-up so the voice reads the text the way a person would say it. */
function humanizeText(text: string): string {
  return text
    .replace(/[`*_#>]+/g, '')
    .replace(/\be\.g\.,?/gi, 'for example,')
    .replace(/\bi\.e\.,?/gi, 'that is,')
    .replace(/\betc\./gi, 'etcetera')
    .replace(/\bvs\.?(?=\s)/gi, 'versus')
    .replace(/^\s*(deeper\s+)?follow-up:\s*/i, (_m, deeper) => (deeper ? 'Let me dig a little deeper. ' : 'Quick follow-up. '))
    .replace(/\b([a-z]{2,})\/([a-z]{2,})\b/g, '$1 or $2')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Chunk {
  text: string;
  pauseAfterMs: number;
}

/** Splits into sentences; very long sentences are further split at commas/semicolons. */
export function toChunks(text: string): Chunk[] {
  const sentences = humanizeText(text).match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [];
  const chunks: Chunk[] = [];
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (sentence.length > 160) {
      // Break long sentences at commas, but keep pieces reasonably long so lists don't sound choppy.
      const pieces = sentence.replace(/([,;:])\s+/g, '$1\n').split('\n');
      const parts: string[] = [];
      let current = '';
      for (const piece of pieces) {
        current = current ? `${current} ${piece}` : piece;
        if (current.length >= 70) {
          parts.push(current);
          current = '';
        }
      }
      if (current) {
        if (parts.length && current.length < 30) parts[parts.length - 1] += ` ${current}`;
        else parts.push(current);
      }
      parts.forEach((p, i) => {
        chunks.push({ text: p.trim(), pauseAfterMs: i === parts.length - 1 ? SENTENCE_PAUSE_MS : CLAUSE_PAUSE_MS });
      });
    } else {
      chunks.push({ text: sentence, pauseAfterMs: SENTENCE_PAUSE_MS });
    }
  }
  return chunks;
}

export interface SpeakHandlers {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
}

/**
 * Speaks text sentence by sentence. Returns a cancel function.
 * Cancelling never fires onEnd (Chrome fires onend/onerror for cancelled utterances,
 * so every callback checks that this run is still current).
 */
export function speakNaturally(text: string, voice: SpeechSynthesisVoice | null, handlers: SpeakHandlers = {}): () => void {
  const synth = window.speechSynthesis;
  const chunks = toChunks(text);
  let cancelled = false;
  let started = false;
  let pauseTimer: number | undefined;
  let activeVoice = voice;

  const cancel = () => {
    cancelled = true;
    if (pauseTimer !== undefined) window.clearTimeout(pauseTimer);
    synth.cancel();
  };

  if (!synth || chunks.length === 0) {
    handlers.onEnd?.();
    return cancel;
  }

  const speakChunk = (i: number) => {
    if (cancelled) return;
    if (i >= chunks.length) {
      handlers.onEnd?.();
      return;
    }
    const u = new SpeechSynthesisUtterance(chunks[i].text);
    if (activeVoice) {
      u.voice = activeVoice;
      u.lang = activeVoice.lang;
    } else {
      u.lang = 'en-US';
    }
    u.rate = VOICE_RATE;
    u.pitch = VOICE_PITCH;
    u.volume = 1;
    u.onstart = () => {
      if (cancelled || started) return;
      started = true;
      handlers.onStart?.();
    };
    u.onend = () => {
      if (cancelled) return;
      pauseTimer = window.setTimeout(() => speakChunk(i + 1), chunks[i].pauseAfterMs);
    };
    u.onerror = (event) => {
      if (cancelled) return;
      const err = (event as SpeechSynthesisErrorEvent).error;
      if (err === 'interrupted' || err === 'canceled') return;
      // Online voices (Google / Edge Natural) fail without network: retry this sentence on-device.
      if (activeVoice && !activeVoice.localService) {
        activeVoice = pickBestVoice(synth.getVoices().filter((v) => v.localService));
        console.warn('Online voice failed; falling back to', activeVoice?.name || 'default voice');
        speakChunk(i);
        return;
      }
      handlers.onError?.(event);
    };
    synth.speak(u);
  };

  synth.cancel();
  // Small delay after cancel(): Safari/Chrome sometimes drop an utterance queued immediately after.
  pauseTimer = window.setTimeout(() => speakChunk(0), 60);
  return cancel;
}
