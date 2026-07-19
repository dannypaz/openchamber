import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { compareVersions } from './opencode-version-lookup.js';

const MANAGED_INSTALL_DIR_NAME = 'opencode-cli';
const CURRENT_VERSION_FILE_NAME = 'current-version';
const KEEP_VERSION_COUNT = 2;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const defaultWebPackageJsonPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', 'package.json'
);

export const createManagedOpenCodeInstallRuntime = (deps = {}) => {
  const openchamberDataDir = deps.openchamberDataDir;
  if (typeof openchamberDataDir !== 'string' || openchamberDataDir.trim().length === 0) {
    throw new Error('createManagedOpenCodeInstallRuntime requires an openchamberDataDir');
  }
  const runSpawnSync = typeof deps.spawnSync === 'function' ? deps.spawnSync : spawnSync;
  const fetchImpl = typeof deps.fetch === 'function' ? deps.fetch : fetch;
  const webPackageJsonPath = deps.webPackageJsonPath || defaultWebPackageJsonPath;

  const binaryName = () => (process.platform === 'win32' ? 'opencode.exe' : 'opencode');

  const getManagedOpenCodeInstallDir = () => path.join(openchamberDataDir, MANAGED_INSTALL_DIR_NAME);

  const isExecutableFile = (filePath) => {
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) return false;
      if (process.platform !== 'win32') {
        fs.accessSync(filePath, fs.constants.X_OK);
      }
      return true;
    } catch {
      return false;
    }
  };

  const readCurrentVersionPointer = () => {
    try {
      const raw = fs.readFileSync(path.join(getManagedOpenCodeInstallDir(), CURRENT_VERSION_FILE_NAME), 'utf8');
      const trimmed = raw.trim();
      return VERSION_PATTERN.test(trimmed) ? trimmed : null;
    } catch {
      return null;
    }
  };

  const resolveManagedOpenCodeCliPath = () => {
    const version = readCurrentVersionPointer();
    if (!version) return null;
    const binaryPath = path.join(getManagedOpenCodeInstallDir(), version, binaryName());
    return isExecutableFile(binaryPath) ? binaryPath : null;
  };

  const resolvePinnedOpenCodeVersion = () => {
    const pkg = JSON.parse(fs.readFileSync(webPackageJsonPath, 'utf8'));
    const version = pkg.dependencies?.['@opencode-ai/sdk'];
    if (typeof version !== 'string' || !VERSION_PATTERN.test(version.trim())) {
      throw new Error('Missing or non-exact @opencode-ai/sdk version in package.json');
    }
    return version.trim();
  };

  const artifactForHostPlatform = () => {
    const platform = process.platform;
    const arch = process.arch;
    if (platform === 'darwin') {
      if (arch === 'arm64') return { name: 'opencode-darwin-arm64.zip', binary: 'opencode' };
      if (arch === 'x64') return { name: 'opencode-darwin-x64-baseline.zip', binary: 'opencode' };
    }
    if (platform === 'win32') {
      if (arch === 'arm64') return { name: 'opencode-windows-arm64.zip', binary: 'opencode.exe' };
      if (arch === 'x64') return { name: 'opencode-windows-x64-baseline.zip', binary: 'opencode.exe' };
    }
    if (platform === 'linux') {
      if (arch === 'arm64') return { name: 'opencode-linux-arm64.tar.gz', binary: 'opencode' };
      if (arch === 'x64') return { name: 'opencode-linux-x64-baseline.tar.gz', binary: 'opencode' };
    }
    throw new Error(`No OpenCode CLI download is available for ${platform}/${arch}`);
  };

  const readBinaryVersion = (binaryPath) => {
    try {
      const result = runSpawnSync(binaryPath, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 15000,
        windowsHide: true,
      });
      if (result.status !== 0) return null;
      return (result.stdout || '').trim().split(/\s+/)[0] || null;
    } catch {
      return null;
    }
  };

  const findBinary = (root, name) => {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(root, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) {
        return fullPath;
      }
      if (entry.isDirectory()) {
        const found = findBinary(fullPath, name);
        if (found) return found;
      }
    }
    return null;
  };

  const extractArchive = (archivePath, destinationDir) => {
    if (archivePath.endsWith('.zip')) {
      new AdmZip(archivePath).extractAllTo(destinationDir, true);
      return;
    }
    if (archivePath.endsWith('.tar.gz')) {
      const result = runSpawnSync('tar', ['-xzf', archivePath, '-C', destinationDir], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      if (result.status !== 0) {
        throw new Error(`Failed to extract ${archivePath}: ${result.stderr || result.error?.message || 'unknown error'}`);
      }
      return;
    }
    throw new Error(`Unsupported OpenCode CLI archive format: ${archivePath}`);
  };

  const pruneOldVersions = (keepVersion) => {
    const dir = getManagedOpenCodeInstallDir();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const otherVersionDirs = entries
      .filter((entry) => entry.isDirectory() && VERSION_PATTERN.test(entry.name) && entry.name !== keepVersion)
      .map((entry) => entry.name)
      .sort((a, b) => compareVersions(b, a));
    for (const versionDir of otherVersionDirs.slice(KEEP_VERSION_COUNT - 1)) {
      try {
        fs.rmSync(path.join(dir, versionDir), { recursive: true, force: true });
      } catch {
        // best-effort prune; a leftover version directory is harmless
      }
    }
  };

  const installManagedOpenCode = async ({ version } = {}) => {
    if (typeof version !== 'string' || !VERSION_PATTERN.test(version.trim())) {
      throw new Error(`Invalid OpenCode CLI version: ${version}`);
    }
    const normalizedVersion = version.trim();
    const artifact = artifactForHostPlatform();
    const installDir = getManagedOpenCodeInstallDir();
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-cli-install-'));

    try {
      const downloadUrl = `https://github.com/anomalyco/opencode/releases/download/v${normalizedVersion}/${artifact.name}`;
      const response = await fetchImpl(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download OpenCode CLI ${normalizedVersion}: ${response.status} ${response.statusText}`);
      }
      const archivePath = path.join(tempRoot, artifact.name);
      fs.writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));

      const extractDir = path.join(tempRoot, 'extract');
      fs.mkdirSync(extractDir, { recursive: true });
      extractArchive(archivePath, extractDir);

      const extractedBinary = findBinary(extractDir, artifact.binary);
      if (!extractedBinary) {
        throw new Error(`Downloaded OpenCode CLI archive did not contain ${artifact.binary}`);
      }
      if (process.platform !== 'win32') {
        fs.chmodSync(extractedBinary, 0o755);
      }

      const installedVersion = readBinaryVersion(extractedBinary);
      if (installedVersion !== normalizedVersion) {
        throw new Error(
          `Downloaded OpenCode CLI version mismatch: expected ${normalizedVersion}, got ${installedVersion || 'unknown'}`
        );
      }

      const versionDir = path.join(installDir, normalizedVersion);
      const versionDirTemp = `${versionDir}.tmp-${process.pid}-${Date.now()}`;
      fs.rmSync(versionDirTemp, { recursive: true, force: true });
      fs.mkdirSync(versionDirTemp, { recursive: true });
      const stagedBinaryPath = path.join(versionDirTemp, artifact.binary);
      fs.copyFileSync(extractedBinary, stagedBinaryPath);
      if (process.platform !== 'win32') {
        fs.chmodSync(stagedBinaryPath, 0o755);
      }

      fs.rmSync(versionDir, { recursive: true, force: true });
      fs.renameSync(versionDirTemp, versionDir);

      const pointerPath = path.join(installDir, CURRENT_VERSION_FILE_NAME);
      const pointerTemp = `${pointerPath}.tmp-${process.pid}-${Date.now()}`;
      fs.mkdirSync(installDir, { recursive: true });
      fs.writeFileSync(pointerTemp, normalizedVersion, 'utf8');
      fs.renameSync(pointerTemp, pointerPath);

      pruneOldVersions(normalizedVersion);

      return { version: normalizedVersion, binaryPath: path.join(versionDir, artifact.binary) };
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  };

  return {
    getManagedOpenCodeInstallDir,
    resolveManagedOpenCodeCliPath,
    resolvePinnedOpenCodeVersion,
    artifactForHostPlatform,
    installManagedOpenCode,
  };
};
