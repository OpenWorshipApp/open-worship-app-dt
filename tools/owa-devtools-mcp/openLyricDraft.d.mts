// Only what a TypeScript caller reads off the drafter: the refusal a site's
// bot check earns, so the renderer's prefix test can be pinned to the real
// sentence, and the check itself. Everything else in the module is the
// server's business.

export declare const BROWSER_CHECK_TEXT: string;

export declare function checkIsBrowserCheckPage(text: string): boolean;
