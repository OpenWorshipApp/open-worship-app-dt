import { describe, expect, test, vi } from 'vitest';

// The real catalog, drawn as the rows of the export and import trees. `tran`
// brackets what it was given, so an untranslated title shows.
vi.mock('../../lang/langHelpers', () => ({
    tran: (key: string) => `[${key}]`,
}));

import { genSettingTreeChoices } from './settingArchiveChoiceHelpers';
import {
    OTHER_LEAF_ID,
    SETTING_SECTION_LIST,
    THEME_LEAF_ID,
} from './settingArchiveCatalog';

const CONNECTIONS_NOTE = '[Lets other devices connect to this computer]';

describe('the settings tree', () => {
    test('each section is a parent of its leaves, counted and translated', () => {
        const choices = genSettingTreeChoices(
            new Map([
                ['general.language', 1],
                [THEME_LEAF_ID, 2],
                ['connections.mirror', 4],
            ]),
            () => ({}),
        );
        // One row per section; "Other Settings" is drawn as its one leaf.
        expect(choices.map((choice) => choice.key)).toEqual(
            SETTING_SECTION_LIST.map((section) => {
                return section.id === 'other' ? OTHER_LEAF_ID : section.id;
            }),
        );
        const [general, bible] = choices;
        expect(general).toMatchObject({
            key: 'general',
            title: '[General]',
            iconClassName: 'bi-gear',
            detail: '[Settings]: 3',
        });
        expect(general.children!.slice(0, 3)).toEqual([
            {
                key: 'general.language',
                title: '[Language]',
                iconClassName: 'bi-translate',
                detail: '[Settings]: 1',
            },
            {
                key: THEME_LEAF_ID,
                title: '[Theme]',
                iconClassName: 'bi-circle-half',
                detail: '[Settings]: 2',
            },
            {
                key: 'general.font',
                title: '[Font]',
                iconClassName: 'bi-fonts',
                detail: '[All default]',
            },
        ]);
        expect(bible.detail).toBe('[All default]');
        // One leaf under another name is still drawn under its section.
        expect(choices.find((choice) => choice.key === 'connections')).toEqual({
            key: 'connections',
            title: '[Connections]',
            iconClassName: 'bi-broadcast',
            detail: '[Settings]: 4',
            children: [
                {
                    key: 'connections.mirror',
                    title: '[Screen Mirror & Virtual Displays]',
                    iconClassName: 'bi-broadcast',
                    detail: `${CONNECTIONS_NOTE} · [Settings]: 4`,
                },
            ],
        });
        expect(choices.at(-1)).toEqual({
            key: OTHER_LEAF_ID,
            title: '[Other Settings]',
            iconClassName: 'bi-three-dots',
            detail: '[All default]',
        });
    });

    test('a leaf can be refused, start unticked, or print no count', () => {
        const choices = genSettingTreeChoices(
            new Map([['secrets.aiKeys', 2]]),
            (leaf) => {
                if (leaf.id === 'secrets.aiKeys') {
                    return {
                        invalidMessage: 'This computer cannot keep them safely',
                        isDefaultUnchecked: true,
                    };
                }
                return leaf.id === 'secrets.songSelect'
                    ? { isCountHidden: true }
                    : {};
            },
        );
        const secrets = choices.find((choice) => choice.key === 'secrets')!;
        expect(secrets.detail).toBe('[Settings]: 2');
        expect(secrets.children).toEqual([
            {
                key: 'secrets.aiKeys',
                title: '[AI Keys]',
                iconClassName: 'bi-stars',
                detail: '[Settings]: 2',
                invalidMessage: '[This computer cannot keep them safely]',
                isDefaultUnchecked: true,
            },
            {
                key: 'secrets.songSelect',
                title: '[SongSelect]',
                iconClassName: 'bi-music-note',
                detail: undefined,
            },
            {
                key: 'secrets.connectionCodes',
                title: '[Connection Codes]',
                iconClassName: 'bi-shield-lock',
                detail: '[All default]',
            },
        ]);
    });

    test('a section none of whose settings is counted prints no count', () => {
        const choices = genSettingTreeChoices(new Map(), (leaf) => {
            return leaf.id === 'connections.mirror'
                ? { isCountHidden: true }
                : {};
        });
        const connections = choices.find((choice) => {
            return choice.key === 'connections';
        })!;
        expect(connections.detail).toBeUndefined();
        // Its note stays; only the count goes.
        expect(connections.children![0].detail).toBe(CONNECTIONS_NOTE);
    });

    test('a hidden leaf is left out, and a section left empty is not drawn', () => {
        const shownLeafIds = new Set([THEME_LEAF_ID, OTHER_LEAF_ID]);
        const choices = genSettingTreeChoices(
            new Map([
                [THEME_LEAF_ID, 1],
                // Not counted into its section once hidden.
                ['general.language', 5],
                ['bible.lookup', 3],
            ]),
            (leaf) => ({ isHidden: !shownLeafIds.has(leaf.id) }),
        );
        expect(choices).toEqual([
            {
                key: 'general',
                title: '[General]',
                iconClassName: 'bi-gear',
                detail: '[Settings]: 1',
                children: [
                    {
                        key: THEME_LEAF_ID,
                        title: '[Theme]',
                        iconClassName: 'bi-circle-half',
                        detail: '[Settings]: 1',
                    },
                ],
            },
            {
                key: OTHER_LEAF_ID,
                title: '[Other Settings]',
                iconClassName: 'bi-three-dots',
                detail: '[All default]',
            },
        ]);
    });
});
