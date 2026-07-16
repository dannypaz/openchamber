import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../small-model/index.js', () => ({
  generateSmallModelText: vi.fn(),
}));

const { classifyMessageTier } = await import('./classify.js');
const { generateSmallModelText } = await import('../small-model/index.js');

describe('classifyMessageTier', () => {
  beforeEach(() => {
    generateSmallModelText.mockReset();
  });

  it('returns null for empty/whitespace text without calling the small model', async () => {
    expect(await classifyMessageTier({ text: '' })).toBeNull();
    expect(await classifyMessageTier({ text: '   ' })).toBeNull();
    expect(await classifyMessageTier({ text: undefined })).toBeNull();
    expect(generateSmallModelText).not.toHaveBeenCalled();
  });

  it('parses a SIMPLE verdict, tolerating case and whitespace', async () => {
    generateSmallModelText.mockResolvedValue({
      text: '  simple  ',
      providerID: 'google',
      modelID: 'gemini-2.5-flash',
      source: 'family-scan',
    });
    const result = await classifyMessageTier({ text: 'hi there' });
    expect(result).toEqual({ tier: 'simple', providerID: 'google', modelID: 'gemini-2.5-flash' });
  });

  it('parses a COMPLEX verdict', async () => {
    generateSmallModelText.mockResolvedValue({
      text: 'COMPLEX',
      providerID: 'google',
      modelID: 'gemini-2.5-flash',
      source: 'family-scan',
    });
    const result = await classifyMessageTier({ text: 'refactor the auth module' });
    expect(result).toEqual({ tier: 'complex', providerID: 'google', modelID: 'gemini-2.5-flash' });
  });

  it('returns null for empty or unparseable model output', async () => {
    generateSmallModelText.mockResolvedValue({ text: '', providerID: 'google', modelID: 'gemini-2.5-flash' });
    expect(await classifyMessageTier({ text: 'hi' })).toBeNull();

    generateSmallModelText.mockResolvedValue({ text: 'uh, not sure?', providerID: 'google', modelID: 'gemini-2.5-flash' });
    expect(await classifyMessageTier({ text: 'hi' })).toBeNull();
  });

  it('returns null instead of throwing when small-model resolution fails', async () => {
    generateSmallModelText.mockRejectedValue(Object.assign(new Error('no small model available'), { statusCode: 404 }));
    await expect(classifyMessageTier({ text: 'hi' })).resolves.toBeNull();
  });

  it('fails open to null when the small model call outlasts the classify timeout', async () => {
    generateSmallModelText.mockImplementation(() => new Promise(() => {}));

    const result = await classifyMessageTier({ text: 'hi' });

    expect(result).toBeNull();
  }, 5_000);

  it('passes preferredProviderID/preferredModelID through to generateSmallModelText', async () => {
    generateSmallModelText.mockResolvedValue({ text: 'SIMPLE', providerID: 'anthropic', modelID: 'claude-haiku-4-5' });
    await classifyMessageTier({
      text: 'hi',
      directory: '/repo',
      preferredProviderID: 'anthropic',
      preferredModelID: 'claude-sonnet-4-5',
    });
    expect(generateSmallModelText).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'hi',
      directory: '/repo',
      preferredProviderID: 'anthropic',
      preferredModelID: 'claude-sonnet-4-5',
      maxOutputTokens: 8,
    }));
  });
});
