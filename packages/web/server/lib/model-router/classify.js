import { generateSmallModelText } from '../small-model/index.js';

const CLASSIFY_TIMEOUT_MS = 2_500;
const CLASSIFY_MAX_OUTPUT_TOKENS = 8;

const CLASSIFY_SYSTEM_PROMPT = [
  'You are a routing classifier for a coding assistant.',
  "Read the user's next message and decide how much reasoning it needs.",
  'Reply with exactly one word: SIMPLE or COMPLEX.',
  'SIMPLE: greetings, small talk, trivial one-line questions, simple lookups, short factual asks.',
  'COMPLEX: anything involving code changes, debugging, multi-step reasoning, architecture, or ambiguity.',
  'Reply with exactly one word and nothing else.',
].join(' ');

const parseTier = (rawText) => {
  if (typeof rawText !== 'string') return null;
  const normalized = rawText.trim().toUpperCase();
  if (!normalized) return null;
  // Checked in this order because a hedging reply ("not COMPLEX, this is
  // SIMPLE") should still resolve — COMPLEX is the more consequential
  // misparse, so only treat it as COMPLEX when SIMPLE isn't also present.
  if (normalized.includes('SIMPLE')) return 'simple';
  if (normalized.includes('COMPLEX')) return 'complex';
  return null;
};

const withTimeout = (promise, ms) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Auto Router classification timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

/**
 * Classifies a message as SIMPLE or COMPLEX using the resolved small model as
 * the classifier — the classifier's own resolved provider/model doubles as
 * the cheap-tier candidate, so callers never need a second resolution.
 *
 * Never throws: timeout, resolution failure, and unparseable output all
 * return null. Callers must treat null as "classification unavailable" and
 * fail open toward the frontier tier, never toward cheap.
 */
export async function classifyMessageTier({ text, directory, preferredProviderID, preferredModelID }) {
  if (typeof text !== 'string' || !text.trim()) {
    return null;
  }

  try {
    const result = await withTimeout(
      generateSmallModelText({
        prompt: text,
        system: CLASSIFY_SYSTEM_PROMPT,
        maxOutputTokens: CLASSIFY_MAX_OUTPUT_TOKENS,
        directory,
        preferredProviderID,
        preferredModelID,
      }),
      CLASSIFY_TIMEOUT_MS,
    );

    const tier = parseTier(result?.text);
    if (!tier) return null;

    return { tier, providerID: result.providerID, modelID: result.modelID };
  } catch {
    return null;
  }
}
