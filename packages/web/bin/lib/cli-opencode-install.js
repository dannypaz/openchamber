import { resolveExplicitBinary, searchPathFor } from './cli-executables.js';
import { getDataDir, readOpenCodeManagedInstallDeclinedAt, writeOpenCodeManagedInstallDeclined } from './cli-paths.js';
import {
  confirm as clackConfirm,
  cancel as clackCancel,
  isCancel as clackIsCancel,
  canPrompt,
  createSpinner,
} from '../cli-output.js';
import { createManagedOpenCodeInstallRuntime } from '../../server/lib/opencode/managed-install-runtime.js';

const DECLINE_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

function isDeclineCooldownActive() {
  const declinedAt = readOpenCodeManagedInstallDeclinedAt();
  return Number.isFinite(declinedAt) && Date.now() - declinedAt < DECLINE_COOLDOWN_MS;
}

function notFoundError() {
  return new Error(
    `Unable to locate the opencode CLI on PATH (${process.env.PATH || '<empty>'}). ` +
    'Ensure the CLI is installed and reachable, or set OPENCODE_BINARY to its full path.'
  );
}

async function installManagedOpenCodeCli(runtime, onNotice, options) {
  const version = runtime.resolvePinnedOpenCodeVersion();
  const spin = createSpinner(options);
  if (spin) {
    spin.start(`Downloading OpenCode CLI v${version}...`);
  } else if (typeof onNotice === 'function') {
    onNotice({ level: 'info', code: 'OPENCODE_MANAGED_INSTALL_START', message: `Downloading OpenCode CLI v${version}...` });
  }

  try {
    const result = await runtime.installManagedOpenCode({ version });
    if (spin) {
      spin.stop(`OpenCode CLI installed (v${result.version})`);
    } else if (typeof onNotice === 'function') {
      onNotice({
        level: 'info',
        code: 'OPENCODE_MANAGED_INSTALL',
        message: `Installed OpenCode CLI v${result.version} (managed by OpenChamber)`,
      });
    }
    return result.binaryPath;
  } catch (error) {
    if (spin) {
      spin.stop('Failed to install OpenCode CLI');
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to install OpenCode CLI automatically: ${reason}. ` +
      'Install it manually and ensure it is on PATH, or set OPENCODE_BINARY.'
    );
  }
}

async function checkOpenCodeCLI(onNotice, options) {
  if (process.env.OPENCODE_BINARY) {
    const override = resolveExplicitBinary(process.env.OPENCODE_BINARY);
    if (override) {
      process.env.OPENCODE_BINARY = override;
      return override;
    }
    const message = `OPENCODE_BINARY="${process.env.OPENCODE_BINARY}" is not an executable file. Falling back to PATH lookup.`;
    if (typeof onNotice === 'function') {
      onNotice({ level: 'warning', code: 'OPENCODE_BINARY_INVALID', message });
    } else {
      console.warn(`Warning: ${message}`);
    }
  }

  const resolvedFromPath = searchPathFor('opencode');
  if (resolvedFromPath) {
    process.env.OPENCODE_BINARY = resolvedFromPath;
    return resolvedFromPath;
  }

  const managedInstallRuntime = createManagedOpenCodeInstallRuntime({ openchamberDataDir: getDataDir() });
  const existingManaged = managedInstallRuntime.resolveManagedOpenCodeCliPath();
  if (existingManaged) {
    process.env.OPENCODE_BINARY = existingManaged;
    return existingManaged;
  }

  if (isDeclineCooldownActive()) {
    throw notFoundError();
  }

  if (canPrompt(options)) {
    const shouldInstall = await clackConfirm({
      message: 'OpenCode CLI was not found on this machine. Download and install it now? '
        + '(~40-80MB, stored in ~/.config/openchamber/opencode-cli)',
      initialValue: true,
    });
    if (clackIsCancel(shouldInstall)) {
      clackCancel('OpenCode install skipped.');
      writeOpenCodeManagedInstallDeclined();
      throw notFoundError();
    }
    if (!shouldInstall) {
      writeOpenCodeManagedInstallDeclined();
      throw notFoundError();
    }
  }

  const binaryPath = await installManagedOpenCodeCli(managedInstallRuntime, onNotice, options);
  process.env.OPENCODE_BINARY = binaryPath;
  return binaryPath;
}

export { checkOpenCodeCLI };
