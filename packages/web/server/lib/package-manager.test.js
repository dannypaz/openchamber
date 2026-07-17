import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock child_process to prevent real spawnSync calls that would hang in tests
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  spawnSync: vi.fn(() => ({ status: 0, stdout: '/usr/local/bin', stderr: '' })),
}));

const {
  checkForUpdates,
  detectPackageManager,
  executeUpdate,
  getCurrentVersion,
} = await import('./package-manager.js');

/** Helper: create a fetch mock that routes by URL pattern */
function createFetchMock() {
  const handlers = new Map();

  const mock = vi.fn((url, options) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    for (const [pattern, response] of handlers) {
      if (urlStr.includes(pattern)) {
        return Promise.resolve(response);
      }
    }

    return Promise.reject(new Error(`Unexpected fetch call: ${urlStr}`));
  });

  mock.when = (pattern, response) => {
    handlers.set(pattern, response);
    return mock;
  };

  return mock;
}

describe('checkForUpdates', () => {
  let fetchMock;
  let originalFetch;

  beforeEach(() => {
    fetchMock = createFetchMock();
    originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('never calls the OpenChamber hosted update-check API', async () => {
    fetchMock.when('registry.npmjs.org', {
      ok: true,
      json: async () => ({ 'dist-tags': { latest: '1.9.10' } }),
    });

    await checkForUpdates({ currentVersion: '1.9.10' });

    for (const call of fetchMock.mock.calls) {
      const urlStr = typeof call[0] === 'string' ? call[0] : call[0].toString();
      expect(urlStr).not.toContain('openchamber.dev');
    }
  });

  it('returns available=true when npm has a newer version, sourcing release info from dannypaz/openchamber', async () => {
    fetchMock
      .when('registry.npmjs.org', {
        ok: true,
        json: async () => ({ 'dist-tags': { latest: '1.10.0' } }),
      })
      .when('raw.githubusercontent.com', {
        ok: true,
        text: async () => '## [1.10.0] - 2026-05-01\n\n- Great new feature',
      });

    const result = await checkForUpdates({ currentVersion: '1.9.10' });

    expect(result.available).toBe(true);
    expect(result.version).toBe('1.10.0');
    expect(result.currentVersion).toBe('1.9.10');
    expect(result.releaseUrl).toBe('https://github.com/dannypaz/openchamber/releases/tag/v1.10.0');
  });

  it('returns available=false when npm has the same version', async () => {
    fetchMock.when('registry.npmjs.org', {
      ok: true,
      json: async () => ({ 'dist-tags': { latest: '1.9.10' } }),
    });

    const result = await checkForUpdates({ currentVersion: '1.9.10' });

    expect(result.available).toBe(false);
  });

  it('returns available=false when npm only has a prerelease of the current version', async () => {
    fetchMock.when('registry.npmjs.org', {
      ok: true,
      json: async () => ({ 'dist-tags': { latest: '1.10.0-beta.1' } }),
    });

    const result = await checkForUpdates({ currentVersion: '1.10.0' });

    expect(result.available).toBe(false);
  });

  it('resolves an Android APK asset from the dannypaz/openchamber GitHub release', async () => {
    fetchMock
      .when('registry.npmjs.org', {
        ok: true,
        json: async () => ({ 'dist-tags': { latest: '1.10.0' } }),
      })
      .when('raw.githubusercontent.com', { ok: true, text: async () => '' })
      .when('api.github.com/repos/dannypaz/openchamber/releases/tags/v1.10.0', {
        ok: true,
        json: async () => ({
          assets: [
            {
              name: 'app-release.apk',
              browser_download_url: 'https://downloads.example/app-release.apk',
            },
            {
              name: 'OpenChamber-1.10.0-42-android.apk',
              browser_download_url: 'https://downloads.example/OpenChamber-1.10.0-42-android.apk',
            },
          ],
        }),
      });

    const result = await checkForUpdates({
      appType: 'mobile-capacitor',
      platform: 'android',
      currentVersion: '1.9.10',
    });

    expect(result.available).toBe(true);
    expect(result.downloadUrl).toBe('https://downloads.example/OpenChamber-1.10.0-42-android.apk');
  });

  it('returns available=false when npm is unreachable', async () => {
    fetchMock.when('registry.npmjs.org', Promise.reject(new Error('Registry unreachable')));

    const result = await checkForUpdates({ currentVersion: '1.9.10' });

    expect(result.available).toBe(false);
  });
});

describe('getCurrentVersion', () => {
  it('is exported for the CLI update command', () => {
    expect(typeof getCurrentVersion).toBe('function');
    expect(getCurrentVersion()).toMatch(/^\d+\.\d+\.\d+|unknown$/);
  });
});

describe('CLI update exports', () => {
  it('exports package-manager helpers used by the update command', () => {
    expect(typeof detectPackageManager).toBe('function');
    expect(typeof executeUpdate).toBe('function');
  });
});
