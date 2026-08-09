import { describe, expect, test } from 'vitest';

// No mocks: this module imports nothing but a `bible-note` TYPE, which is
// erased. That is deliberate — the panel renders before the dataset has loaded,
// so nothing here may pull that package in.
import {
    ALL_TYPES,
    LOCATION_ICON_CLASS,
    NAME_TYPE_LABEL,
    PAGE_SIZE,
    getNameTypeIconClass,
    getPlainReferenceText,
} from './lookupPresentationHelpers';

describe('name-type presentation', () => {
    test('maps every known type to its own icon', () => {
        const types = Object.keys(NAME_TYPE_LABEL);
        const iconClasses = types.map(getNameTypeIconClass);
        for (const iconClass of iconClasses) {
            expect(iconClass.startsWith('bi bi-')).toBe(true);
        }
        // A shared icon would make two filters look like the same thing. Only
        // `place` legitimately reuses the location icon.
        const distinctIconClasses = new Set(iconClasses);
        expect(distinctIconClasses.size).toBe(types.length);
    });

    test('is case and whitespace insensitive', () => {
        expect(getNameTypeIconClass('  DEITY ')).toBe(
            getNameTypeIconClass('deity'),
        );
    });

    // Mirrors `bible-note`'s own `normalizeMentionNameType`. If that fallback
    // ever changes, the panel silently starts labelling records wrongly.
    test('falls back to `person` for an unrecognized, empty or missing type', () => {
        const personIconClass = getNameTypeIconClass('person');
        expect(getNameTypeIconClass('pharaoh')).toBe(personIconClass);
        expect(getNameTypeIconClass('')).toBe(personIconClass);
        expect(getNameTypeIconClass(null)).toBe(personIconClass);
        expect(getNameTypeIconClass(undefined)).toBe(personIconClass);
    });

    test('`place` shares the location icon', () => {
        expect(getNameTypeIconClass('place')).toBe(LOCATION_ICON_CLASS);
    });

    // `tran` runs on these at the call site, and a key with no Khmer entry
    // THROWS and blanks the page. Bare English literals are what makes the
    // dictionary check possible at all.
    test('labels are plain English literals, not pre-translated', () => {
        for (const label of Object.values(NAME_TYPE_LABEL)) {
            expect(label).toMatch(/^[A-Z][A-Za-z ]*$/);
        }
    });

    test('the "all types" sentinel cannot collide with a real type', () => {
        expect(Object.keys(NAME_TYPE_LABEL)).not.toContain(ALL_TYPES);
    });

    test('a page holds a sane number of records', () => {
        expect(PAGE_SIZE).toBeGreaterThan(0);
    });
});

describe('stripping inline reference tokens for a one-line summary', () => {
    test('keeps the readable label and drops the markup', () => {
        expect(getPlainReferenceText('Son of [Amram](name-id://n-123)')).toBe(
            'Son of Amram',
        );
    });

    test('handles every scheme', () => {
        expect(
            getPlainReferenceText(
                '[Moses](name-id://a) went to [Egypt](location-id://b) ' +
                    'in [Exodus 1:1](verse-key://EXO 1:1)',
            ),
        ).toBe('Moses went to Egypt in Exodus 1:1');
    });

    test('replaces every token, not just the first', () => {
        expect(
            getPlainReferenceText('[A](name-id://1) and [B](name-id://2)'),
        ).toBe('A and B');
    });

    // The regex is module-level and global; `String.replace` must not carry
    // `lastIndex` between calls or the second call would start mid-string.
    test('does not leak regex state between calls', () => {
        const value = '[A](name-id://1) and [B](name-id://2)';
        expect(getPlainReferenceText(value)).toBe(getPlainReferenceText(value));
    });

    test('leaves text with no tokens untouched', () => {
        expect(getPlainReferenceText('Just a plain title')).toBe(
            'Just a plain title',
        );
        expect(getPlainReferenceText('')).toBe('');
    });

    // A markdown link to a real URL is not a record reference and must survive.
    test('leaves non-reference links alone', () => {
        expect(getPlainReferenceText('[Wiki](https://example.com)')).toBe(
            '[Wiki](https://example.com)',
        );
    });
});
