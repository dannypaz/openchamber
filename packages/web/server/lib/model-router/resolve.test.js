import { describe, it, expect } from 'bun:test';
import { resolveTierModel } from './resolve.js';

describe('resolveTierModel — simple tier', () => {
  it('prefers the cheap-tier override over the fallback', () => {
    const result = resolveTierModel({
      tier: 'simple',
      cheapOverrideRef: 'anthropic/claude-haiku-4-5',
      cheapFallback: { providerID: 'google', modelID: 'gemini-2.5-flash' },
    });
    expect(result).toEqual({ providerID: 'anthropic', modelID: 'claude-haiku-4-5', source: 'override' });
  });

  it('falls back to the classifier-resolved model when no override is set', () => {
    const result = resolveTierModel({
      tier: 'simple',
      cheapOverrideRef: null,
      cheapFallback: { providerID: 'google', modelID: 'gemini-2.5-flash' },
    });
    expect(result).toEqual({ providerID: 'google', modelID: 'gemini-2.5-flash', source: 'fallback' });
  });

  it('returns null when neither an override nor a fallback resolves', () => {
    expect(resolveTierModel({ tier: 'simple', cheapOverrideRef: null, cheapFallback: null })).toBeNull();
  });

  it('ignores a malformed override string and falls through to the fallback', () => {
    const result = resolveTierModel({
      tier: 'simple',
      cheapOverrideRef: 'not-a-valid-ref',
      cheapFallback: { providerID: 'google', modelID: 'gemini-2.5-flash' },
    });
    expect(result).toEqual({ providerID: 'google', modelID: 'gemini-2.5-flash', source: 'fallback' });
  });
});

describe('resolveTierModel — complex tier', () => {
  it('prefers the frontier-tier override over the fallback', () => {
    const result = resolveTierModel({
      tier: 'complex',
      frontierOverrideRef: 'anthropic/claude-opus-4',
      frontierFallback: { providerID: 'openai', modelID: 'gpt-5.4' },
    });
    expect(result).toEqual({ providerID: 'anthropic', modelID: 'claude-opus-4', source: 'override' });
  });

  it('falls back to the client-provided default agent model when no override is set', () => {
    const result = resolveTierModel({
      tier: 'complex',
      frontierOverrideRef: null,
      frontierFallback: { providerID: 'openai', modelID: 'gpt-5.4' },
    });
    expect(result).toEqual({ providerID: 'openai', modelID: 'gpt-5.4', source: 'fallback' });
  });

  it('returns null when neither an override nor a fallback resolves', () => {
    expect(resolveTierModel({ tier: 'complex', frontierOverrideRef: null, frontierFallback: null })).toBeNull();
  });

  it('never considers the cheap-tier fallback for the complex tier', () => {
    const result = resolveTierModel({
      tier: 'complex',
      frontierOverrideRef: null,
      frontierFallback: null,
      cheapFallback: { providerID: 'google', modelID: 'gemini-2.5-flash' },
    });
    expect(result).toBeNull();
  });
});
