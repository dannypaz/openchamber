# Danny List

Feature log tracking what shipped in each merged PR.

## PR #6 — Add default app selection for opening projects on desktop

- New "Open In" section in Defaults Settings to pick a default app for opening projects (desktop-only, requires local origin access). Localized across all supported languages.

## PR #5 — Add branch selection and creation UI to draft picker

- Draft picker's branch selector is now a searchable dropdown (desktop) / overlay panel (mobile) instead of a plain select, with smart search ranking.
- Supports creating a worktree for an existing local branch or a new user-named branch, alongside the existing auto-generated flow. Localized across all supported languages.

## PR #4 — Move GitHub account control from header to sidebar footer

- Relocated the GitHub avatar/account-switcher from the desktop header to the session sidebar footer, alongside settings/shortcuts/about. Same behavior, shared across web, desktop, VS Code, and mobile.

## PR #3 — docs: add feature log (DANNY_LIST.md)

- Added this file as a changelog tracking shipped features per merged PR.

## PR #2 — feat: add Auto Router model mode with configurable cheap/frontier tiers

- Cost-aware "Auto" entry in the model picker (mirrors Cursor's Auto mode): routes simple asks to a cheap model and hard asks to a frontier model automatically.
- New model-router server module and resolve endpoint; classification failures always fail open to the frontier tier, never to cheap.
- Fixed a bug where the Auto selection could get silently evicted on provider-list refresh.
- New cheap/frontier override settings under Session Defaults → Auto Router, localized across all supported locales.

## PR #1 — feat: GitHub device-code UX, Linux polish, and draft starters toggle

- GitHub device flow: copy-to-clipboard button and pre-filled code in the verification URL.
- Usage settings now hide providers with no usage/quota data.
- Linux: fixed titlebar/sidebar overlap, and swapped the Finder reference for Files (Nautilus) in "Open in App".
- Added a "Show Draft Starters" setting to hide starter-prompt chips on the new-chat screen.
- Swapped the Auto-discover project icon from search to radar to avoid confusion with session search.
- Documented the `zlib1g-dev` requirement for AppImage extraction/verify.
