export function sanitizeHtml(dirty: string): string {
    // TODO: Implement a proper HTML sanitizer. For now, this is a placeholder
    // that simply returns the input string.
    return dirty;
}

/**
 * Text the user controls -- a file or folder name -- on its way into a string
 * that is rendered as HTML (`showAppConfirm`'s body). `sanitizeHtml` above is
 * still a no-op, and a name on macOS or Linux may hold `<`, in a renderer with
 * node integration.
 */
export function escapeHtmlText(text: string): string {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

export function sanitizeCssValue(value: string): string {
    // Remove characters that could break out of CSS context
    return value.replaceAll(/[;{}'"\\<>]/g, '');
}
