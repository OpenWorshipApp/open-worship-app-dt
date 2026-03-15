import DOMPurify from 'dompurify';

export function sanitizeHtml(dirty: string): string {
    return DOMPurify.sanitize(dirty);
}

export function sanitizeCssValue(value: string): string {
    // Remove characters that could break out of CSS context
    return value.replaceAll(/[;{}'"\\<>]/g, '');
}
