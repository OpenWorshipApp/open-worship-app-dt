import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    getLookupNameAliasMap,
    listNameFormIds,
    toMainNameId,
} from './lookupNameAliasHelpers';

const NOAH_ID = 'efee19ca-1c94-40af-84ce-f452da778047';
const NOE_ID = '909854ad-75f5-47da-a210-0df93ddb1884';
const SEM_ID = 'ec62956f-b4dc-44ce-b56e-d75b6f25ea31';
const SHEM_ID = '5599b7b7-bcae-4cde-abd8-70c657daa39b';

// Read as text and searched, never parsed: three ~35MB datasets.
function readNamesDataset(langCode: string) {
    return fs.readFileSync(
        path.join(
            __dirname,
            '..',
            'lang',
            'data',
            langCode,
            'location-name-map-data',
            'namesMap.json',
        ),
        'utf8',
    );
}

describe('one person under several names', () => {
    it('reads an alias as the person it is, and a person as itself', () => {
        expect(toMainNameId(NOE_ID)).toBe(NOAH_ID);
        expect(toMainNameId(SEM_ID)).toBe(SHEM_ID);
        expect(toMainNameId(NOAH_ID)).toBe(NOAH_ID);
        expect(toMainNameId('anybody')).toBe('anybody');
        // Not a prototype key read as a person.
        expect(toMainNameId('toString')).toBe('toString');
    });

    it('lists every record of a person, the main one first', () => {
        expect(listNameFormIds(NOAH_ID)).toEqual([NOAH_ID, NOE_ID]);
        expect(listNameFormIds(NOE_ID)).toEqual([NOAH_ID, NOE_ID]);
        expect(listNameFormIds('anybody')).toEqual(['anybody']);
    });

    it('points every alias at a person, never at another alias', () => {
        const aliasMap = getLookupNameAliasMap();
        for (const mainId of Object.values(aliasMap)) {
            expect(Object.hasOwn(aliasMap, mainId)).toBe(false);
        }
    });

    // The ids are the same in every language's dataset; a dataset that
    // renumbered its records would leave the table pointing at nobody. The
    // missing ones are listed, never the dataset diffed.
    it.each(['en', 'km', 'fr'])(
        'holds every pair to the %s dataset',
        (langCode) => {
            const dataset = readNamesDataset(langCode);
            const missingList = Object.entries(getLookupNameAliasMap())
                .flat()
                .filter((id) => {
                    return !dataset.includes(`"id": "${id}"`);
                });
            expect(missingList).toEqual([]);
        },
    );

    it('pairs the names the comments say, in English', () => {
        const dataset = readNamesDataset('en');
        const checkIsNamed = (id: string, name: string) => {
            return new RegExp(`"id": "${id}",\\s*"name": "${name}"`).test(
                dataset,
            );
        };
        expect(checkIsNamed(NOE_ID, 'Noe')).toBe(true);
        expect(checkIsNamed(NOAH_ID, 'Noah')).toBe(true);
        expect(checkIsNamed(SEM_ID, 'Sem')).toBe(true);
        expect(checkIsNamed(SHEM_ID, 'Shem')).toBe(true);
    });
});
