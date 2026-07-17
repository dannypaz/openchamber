# Installing OpenChamber (macOS, this fork)

This fork's Desktop builds are self-signed, not notarized by Apple. macOS Gatekeeper will
warn you the first time you open the app. This is expected — follow the steps below once
per downloaded version to run it.

## 1. Download the latest release

Grab the latest `.dmg` for your Mac from the [Releases page](https://github.com/dannypaz/openchamber/releases/latest)
(Apple Silicon builds are `mac-arm64`).

## 2. Install

Open the `.dmg` and drag **OpenChamber** into **Applications**.

## 3. First launch — dismiss the initial warning

Open OpenChamber from Applications (or Spotlight). macOS will block it with:

> **"OpenChamber" Not Opened**
> Apple could not verify "OpenChamber" is free of malware that may harm your Mac or
> compromise your privacy.

Click **Done** (not "Move to Trash").

## 4. Allow it in Privacy & Security settings

Open **System Settings → Privacy & Security** and scroll down to the **Security** section.
You'll see:

> **"OpenChamber" was blocked to protect your Mac.**

Click **Open Anyway**.

## 5. Confirm

macOS will ask once more:

> **Open "OpenChamber"?**
> Apple is not able to verify that it is free from malware that could harm your Mac or
> your privacy. Don't open this unless you are certain it is from a trustworthy source.

Click **Open Anyway** again, then enter your password when prompted.

OpenChamber will now launch, and macOS remembers this approval for future launches of
the same build.

## 6. Install the OpenCode CLI

OpenChamber Desktop bundles a matching OpenCode CLI, but if you need it standalone (for
terminal/CLI use):

```bash
curl -fsSL https://opencode.ai/install | bash
```

See the main [README](./README.md) for CLI, VS Code, and web/PWA install options.
