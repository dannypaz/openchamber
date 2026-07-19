function parseVersionForComparison(value) {
  const normalized = String(value || '').replace(/^v/, '').split('+')[0];
  const prereleaseIndex = normalized.indexOf('-');
  const core = prereleaseIndex >= 0 ? normalized.slice(0, prereleaseIndex) : normalized;
  const parts = core.split('.').map((part) => {
    const parsed = Number.parseInt(part || '0', 10);
    return Number.isFinite(parsed) ? parsed : 0;
  });
  return { parts, prerelease: prereleaseIndex >= 0 };
}

export function compareVersions(left, right) {
  const a = parseVersionForComparison(left);
  const b = parseVersionForComparison(right);
  const length = Math.max(a.parts.length, b.parts.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a.parts[index] || 0) - (b.parts[index] || 0);
    if (diff !== 0) return diff;
  }
  if (a.prerelease !== b.prerelease) return a.prerelease ? -1 : 1;
  return 0;
}

async function fetchLatestOpenCodeVersionFromGithub() {
  const response = await fetch('https://api.github.com/repos/anomalyco/opencode/releases/latest', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`OpenCode releases responded with ${response.status}`);
  }
  const payload = await response.json();
  const tag = typeof payload?.tag_name === 'string' ? payload.tag_name.trim() : '';
  return tag.replace(/^v/, '');
}

async function fetchLatestOpenCodeVersionFromNpm() {
  const response = await fetch('https://registry.npmjs.org/opencode-ai/latest', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`OpenCode npm registry responded with ${response.status}`);
  }
  const payload = await response.json();
  return typeof payload?.version === 'string' ? payload.version.trim().replace(/^v/, '') : '';
}

export async function fetchLatestOpenCodeVersion() {
  const results = await Promise.allSettled([
    fetchLatestOpenCodeVersionFromNpm(),
    fetchLatestOpenCodeVersionFromGithub(),
  ]);
  const versions = results
    .filter((result) => result.status === 'fulfilled' && result.value)
    .map((result) => result.value);
  if (versions.length === 0) {
    const failure = results.find((result) => result.status === 'rejected');
    throw failure?.reason instanceof Error ? failure.reason : new Error('Failed to resolve latest OpenCode version');
  }
  return versions.sort((left, right) => compareVersions(right, left))[0];
}
