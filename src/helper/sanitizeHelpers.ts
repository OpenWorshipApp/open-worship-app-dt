export function sanitizeHtml(dirty: string): string {
    // TODO: Implement a proper HTML sanitizer. For now, this is a placeholder
    // that simply returns the input string.
    return dirty;
}

export function sanitizeCssValue(value: string): string {
    // Remove characters that could break out of CSS context
    return value.replaceAll(/[;{}'"\\<>]/g, '');
}
