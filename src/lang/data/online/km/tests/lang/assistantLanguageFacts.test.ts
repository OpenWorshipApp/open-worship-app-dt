import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

// The Khmer package's own half of `src/lang/assistantLanguageFacts.test.ts`.
const PACKAGE_DIR = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
);

describe('assistant.json beside the Khmer package', () => {
    // The package's own test of a Khmer word is the one the app trusts
    // everywhere else; the help window must agree with it.
    test('Khmer reads its script as the package does', () => {
        const facts = JSON.parse(
            readFileSync(path.join(PACKAGE_DIR, 'assistant.json'), 'utf-8'),
        );
        // The package's script, `script.json`, is what `checkIsThisLang`
        // tests a word with (`onlineLangPackage.ts`).
        const script = JSON.parse(
            readFileSync(path.join(PACKAGE_DIR, 'script.json'), 'utf-8'),
        );
        expect(facts.scriptPattern).toBe(script.scriptPattern);
        const pattern = new RegExp(facts.scriptPattern, 'u');
        for (const sample of ['ក', 'ព្រះគម្ពីរ', '៣', '៿']) {
            expect(pattern.test(sample), sample).toBe(true);
        }
        expect(pattern.test('Bible')).toBe(false);
    });
});
