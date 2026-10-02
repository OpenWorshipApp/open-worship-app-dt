import { describe, expect, test } from 'vitest';

// No mocks: this module imports nothing but a `bible-note` TYPE, which is
// erased. That is deliberate — the panel renders before the dataset has loaded,
// so nothing here may pull that package in.
import {
    ALL_TYPES,
    GENDER_LABEL,
    LOCATION_ICON_CLASS,
    LOCATION_TYPE_LABEL,
    NAME_TYPE_LABEL,
    NAME_TYPE_SINGULAR_LABEL,
    PAGE_SIZE,
    getNameTypeIconClass,
    getNameTypeSingularLabel,
    getPlainReferenceText,
    getRecordDisplayName,
    getRecordKjvName,
    toRecordEnumLabel,
} from './lookupPresentationHelpers';

// Stands in for the lookup language's dictionary.
const toKhmer = (text: string) => `km:${text}`;

describe('record enum labels (gender, location type)', () => {
    // The datasets store these in English in every package, so a Khmer record
    // read `Male` and `Pool` beside a translated type chip.
    test('translates a known value through the lookup language', () => {
        expect(toRecordEnumLabel('male', GENDER_LABEL, toKhmer)).toBe(
            'km:Male',
        );
        expect(toRecordEnumLabel(' Pool ', LOCATION_TYPE_LABEL, toKhmer)).toBe(
            'km:Pool',
        );
        expect(
            toRecordEnumLabel('memorial place', LOCATION_TYPE_LABEL, toKhmer),
        ).toBe('km:Memorial place');
    });

    // Decided on the English value: a translated "unknown" could no longer be
    // recognized and dropped, and the record would grow a chip it does not have.
    test('drops unknown and empty values before translating', () => {
        for (const value of ['unknown', 'UNKNOWN', '', '  ', null, undefined]) {
            expect(toRecordEnumLabel(value, GENDER_LABEL, toKhmer)).toBe('');
        }
    });

    // A word a newer dataset adds is not a key of this dictionary, and handed
    // to `translate` it could match an unrelated app label instead.
    test('shows a value the list does not know as written, untranslated', () => {
        expect(
            toRecordEnumLabel('fortress', LOCATION_TYPE_LABEL, toKhmer),
        ).toBe('fortress');
        expect(
            toRecordEnumLabel('constructor', LOCATION_TYPE_LABEL, toKhmer),
        ).toBe('constructor');
    });

    // `height` is a hill. `Height` is already the app's word for a dimension.
    test('labels a height as a place, not as a measurement', () => {
        expect(LOCATION_TYPE_LABEL.height).toBe('Heights');
    });
});

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
        const everyLabel = [
            ...Object.values(NAME_TYPE_LABEL),
            ...Object.values(NAME_TYPE_SINGULAR_LABEL),
        ];
        for (const label of everyLabel) {
            expect(label).toMatch(/^[A-Z][A-Za-z ]*$/);
        }
    });

    test('every type has a singular label as well as a plural one', () => {
        expect(Object.keys(NAME_TYPE_SINGULAR_LABEL)).toStrictEqual(
            Object.keys(NAME_TYPE_LABEL),
        );
    });

    test('the "all types" sentinel cannot collide with a real type', () => {
        expect(Object.keys(NAME_TYPE_LABEL)).not.toContain(ALL_TYPES);
    });

    // The datasets keep `type` in English whatever language the record is in, so
    // it reaches the panel as a key. The unknown-type fallback has to match the
    // icon's, or a record would show one type and wear another's icon.
    test('resolves a raw dataset type to its singular label', () => {
        expect(getNameTypeSingularLabel('group')).toBe('Group');
        expect(getNameTypeSingularLabel('  DEITY ')).toBe('Deity');
        expect(getNameTypeSingularLabel('pharaoh')).toBe('Person');
    });

    // An absent type has nothing to label; inventing "Person" would put a fact
    // chip on a record the dataset never typed.
    test('leaves a missing type empty rather than guessing', () => {
        expect(getNameTypeSingularLabel('')).toBe('');
        expect(getNameTypeSingularLabel('   ')).toBe('');
        expect(getNameTypeSingularLabel(null)).toBe('');
        expect(getNameTypeSingularLabel(undefined)).toBe('');
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

    // The datasets grew these two after the first three; a stripper that does
    // not know a scheme leaves its whole `[label](scheme://key)` markup in the
    // summary line.
    test('handles the book and chapter schemes too', () => {
        expect(
            getPlainReferenceText(
                'remembered in [Acts](book-key://ACT) and ' +
                    '[2 Samuel 20](chapter-key://2SA 20)',
            ),
        ).toBe('remembered in Acts and 2 Samuel 20');
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

describe('the English name beside a translated one', () => {
    test('shows the KJV name of a translated record', () => {
        expect(
            getRecordKjvName({ name: 'លោកុប្បត្តិ', kjvName: 'Genesis' }),
        ).toBe('Genesis');
        expect(
            getRecordDisplayName({ name: 'លោកុប្បត្តិ', kjvName: 'Genesis' }),
        ).toBe('លោកុប្បត្តិ (Genesis)');
    });

    // The KJV dataset itself carries none: its `name` already IS the English
    // one, and a `Moses (Moses)` row says nothing twice over.
    test('adds nothing when the record carries no other name', () => {
        expect(getRecordKjvName({ name: 'Moses', kjvName: null })).toBe('');
        expect(getRecordKjvName({ name: 'Moses' })).toBe('');
        expect(getRecordKjvName({ name: 'Moses', kjvName: '  ' })).toBe('');
        expect(getRecordKjvName({ name: 'Moses', kjvName: ' Moses ' })).toBe(
            '',
        );
        expect(getRecordDisplayName({ name: 'Moses', kjvName: null })).toBe(
            'Moses',
        );
    });
});
