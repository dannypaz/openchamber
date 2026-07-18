export type ClipboardCopyResult =
  | { ok: true; method: 'clipboard' | 'execCommand' }
  | { ok: false; error: string };

export async function copyTextToClipboard(text: string): Promise<ClipboardCopyResult> {
  let clipboardError: string | null = null;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: 'clipboard' };
    } catch (error) {
      clipboardError = error instanceof Error ? error.message : String(error);
    }
  }

  if (typeof document !== 'undefined' && document.body) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    textarea.style.zIndex = '-1';

    // macOS Safari/WebKit requires the element to be visible and focusable
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';

    document.body.appendChild(textarea);

    // Focus the textarea before selecting to ensure macOS compatibility
    textarea.focus();
    textarea.select();

    // Use setSelectionRange for better cross-browser support
    try {
      textarea.setSelectionRange(0, textarea.value.length);
    } catch {
      // Ignore selection range errors
    }

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      // Ignore execCommand errors
    }

    // Clean up immediately
    document.body.removeChild(textarea);

    if (copied) {
      return { ok: true, method: 'execCommand' };
    }
  }

  return {
    ok: false,
    error: clipboardError ?? 'Clipboard access denied in current context',
  };
}
