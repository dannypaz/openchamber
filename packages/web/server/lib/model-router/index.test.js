import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Point OPENCHAMBER_DATA_DIR at a throwaway directory with no settings.json,
// so readModelRouterSettingsOverrides() always misses regardless of what the
// host running the suite has in its real config dir — these tests cover
// resolveAutoModel's classify/resolve orchestration, not settings I/O.
process.env.OPENCHAMBER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'model-router-test-'));

vi.mock('./classify.js', () => ({
  classifyMessageTier: vi.fn(),
}));

const { resolveAutoModel } = await import('./index.js');
const { classifyMessageTier } = await import('./classify.js');

describe('resolveAutoModel', () => {
  beforeEach(() => {
    classifyMessageTier.mockReset();
  });

  it('resolves to the classifier-selected small model when the tier is simple', async () => {
    classifyMessageTier.mockResolvedValue({ tier: 'simple', providerID: 'google', modelID: 'gemini-2.5-flash' });

    const result = await resolveAutoModel({ text: 'hi', defaultAgentModel: 'openai/gpt-5.4' });

    expect(result).toEqual({
      available: true,
      tier: 'simple',
      providerID: 'google',
      modelID: 'gemini-2.5-flash',
      source: 'fallback',
    });
  });

  it('forces the complex tier and falls back to the client default when classification fails', async () => {
    classifyMessageTier.mockResolvedValue(null);

    const result = await resolveAutoModel({ text: 'refactor this', defaultAgentModel: 'openai/gpt-5.4' });

    expect(result).toEqual({
      available: true,
      tier: 'complex',
      providerID: 'openai',
      modelID: 'gpt-5.4',
      source: 'fallback',
    });
  });

  it('reuses the classifier resolution as the cheap-tier candidate instead of resolving twice', async () => {
    classifyMessageTier.mockResolvedValue({ tier: 'simple', providerID: 'anthropic', modelID: 'claude-haiku-4-5' });

    await resolveAutoModel({ text: 'hi' });

    // classifyMessageTier is the only resolution call the module makes —
    // nothing else in this module talks to the small-model resolver again.
    expect(classifyMessageTier).toHaveBeenCalledTimes(1);
  });

  it('is unavailable when classification fails and there is no client default to fall back to', async () => {
    classifyMessageTier.mockResolvedValue(null);

    const result = await resolveAutoModel({ text: 'refactor this' });

    expect(result).toEqual({ available: false });
  });

  it('forces complex even when the classifier itself reports a complex verdict, reusing its model as context only', async () => {
    classifyMessageTier.mockResolvedValue({ tier: 'complex', providerID: 'google', modelID: 'gemini-2.5-flash' });

    const result = await resolveAutoModel({ text: 'refactor this', defaultAgentModel: 'openai/gpt-5.4' });

    expect(result).toEqual({
      available: true,
      tier: 'complex',
      providerID: 'openai',
      modelID: 'gpt-5.4',
      source: 'fallback',
    });
  });
});
