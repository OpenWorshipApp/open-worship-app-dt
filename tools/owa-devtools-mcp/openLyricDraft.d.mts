// Only what a TypeScript caller reads off the drafter: the refusal a site's
// bot check earns, so the renderer's prefix test can be pinned to the real
// sentence, and the check itself. Tests also draft real reports to verify
// their display translations; the renderer never imports the drafter.

export declare const BROWSER_CHECK_TEXT: string;

export declare function checkIsBrowserCheckPage(text: string): boolean;

export declare function draftOpenLyricText(
    text: string,
    known?: { title?: string; artist?: string; from?: string; to?: string },
): string;
