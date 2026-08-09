import type {
    LocationsLookupManager,
    MentionLocationMatch,
    MentionLocationPreview,
    MentionNameLink,
    MentionNamePreview,
    MentionNameYearRange,
    NamesLookupManager,
} from 'bible-note';

import { tran } from '../lang/langHelpers';
import { getPlainReferenceText } from './lookupPresentationHelpers';

type LinkType = { type: string; url: string };

export function getTrimmedString(value: string | null | undefined) {
    return typeof value === 'string' ? value.trim() : '';
}

export function checkHasDetailValue(value: string | null) {
    const trimmedValue = getTrimmedString(value);
    return trimmedValue !== '' && trimmedValue.toLowerCase() !== 'unknown';
}

export function getFormattedDetailValue(value: string | null) {
    const trimmedValue = getTrimmedString(value);
    if (trimmedValue === '') {
        return '';
    }
    if (trimmedValue.toLowerCase() === 'unknown') {
        return tran('Unknown');
    }
    return trimmedValue;
}

// An en-dash rather than a translated "to": the value is a numeric range, and a
// two-letter dictionary key that generic is asking for a collision.
export function getFormattedYearRange(yearRange: MentionNameYearRange) {
    return `${yearRange.type}: ${yearRange.start} – ${yearRange.end}`;
}

export function getFormattedLinkType(type: string) {
    return type.charAt(0).toUpperCase() + type.slice(1);
}

// The record's own links plus the synthesized Wikipedia entry, de-duplicated by
// url so a record that already lists its Wikipedia page does not show it twice.
export function getDisplayLinks(record: {
    links: MentionNameLink[] | LinkType[];
    wikipedia: string | null;
}): LinkType[] {
    const linksByUrl = new Map<string, LinkType>();
    for (const link of record.links) {
        linksByUrl.set(link.url, link);
    }
    if (record.wikipedia !== null && !linksByUrl.has(record.wikipedia)) {
        linksByUrl.set(record.wikipedia, {
            type: 'wikipedia',
            url: record.wikipedia,
        });
    }
    return Array.from(linksByUrl.values());
}

// Location references are stored as ids, but older records carry the plain name
// instead — and a name only resolves when it is unambiguous.
export function resolveLocationReference(
    locationsLookupManager: LocationsLookupManager,
    idOrName: string,
): MentionLocationMatch | null {
    const location = locationsLookupManager.getRecordById(idOrName);
    if (location !== null) {
        return location;
    }
    const nameMatches = locationsLookupManager.getRecordsByName(idOrName);
    return nameMatches.length === 1 ? nameMatches[0] : null;
}

export function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Writes both an HTML and a plain-text representation so pasting into a
 * rich-text target (MS Word, the note editor) keeps paragraph breaks and bold
 * labels, while plain-text targets still get something readable.
 */
export async function copyRecordToClipboard(plainText: string, html: string) {
    if (
        typeof ClipboardItem !== 'undefined' &&
        typeof navigator.clipboard?.write === 'function'
    ) {
        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([html], { type: 'text/html' }),
                    'text/plain': new Blob([plainText], { type: 'text/plain' }),
                }),
            ]);
            return;
        } catch {
            // Some environments restrict multi-format clipboard writes; fall
            // back to plain text rather than leaving the copy silently failed.
        }
    }
    await navigator.clipboard.writeText(plainText);
}

function toSummary(
    name: string,
    title: string,
    description: string,
    basicFacts: string[],
    detailRows: [string, string][],
) {
    const plainBlocks: string[] = [name];
    const htmlBlocks: string[] = [
        `<p><strong>${escapeHtml(name)}</strong></p>`,
    ];
    if (title !== '') {
        plainBlocks.push(title);
        htmlBlocks.push(`<p><em>${escapeHtml(title)}</em></p>`);
    }
    if (description !== '') {
        plainBlocks.push(description);
        htmlBlocks.push(`<p>${escapeHtml(description)}</p>`);
    }
    if (basicFacts.length > 0) {
        const factsText = basicFacts.join(', ');
        plainBlocks.push(factsText);
        htmlBlocks.push(`<p>${escapeHtml(factsText)}</p>`);
    }
    if (detailRows.length > 0) {
        plainBlocks.push(
            detailRows
                .map(([label, value]) => {
                    return `${label}: ${value}`;
                })
                .join('\n'),
        );
        htmlBlocks.push(
            '<p>' +
                detailRows
                    .map(([label, value]) => {
                        return (
                            `<strong>${escapeHtml(label)}:</strong> ` +
                            escapeHtml(value)
                        );
                    })
                    .join('<br />') +
                '</p>',
        );
    }
    return { plainText: plainBlocks.join('\n\n'), html: htmlBlocks.join('') };
}

function getNamesByIds(namesLookupManager: NamesLookupManager, ids: string[]) {
    return ids.map((id) => {
        return namesLookupManager.getRecordById(id)?.name ?? id;
    });
}

function getLocationNames(
    locationsLookupManager: LocationsLookupManager,
    locations: string[],
) {
    return locations.map((idOrName) => {
        const location = resolveLocationReference(
            locationsLookupManager,
            idOrName,
        );
        return location?.name ?? idOrName;
    });
}

export function buildNameSummary(
    managers: {
        namesLookupManager: NamesLookupManager;
        locationsLookupManager: LocationsLookupManager;
    },
    record: MentionNamePreview,
    resolvedVerses: string[],
) {
    const { namesLookupManager, locationsLookupManager } = managers;
    const basicFacts = [record.type, record.gender, record.age].filter(
        (value) => {
            return value !== '' && value.toLowerCase() !== 'unknown';
        },
    );
    const detailRows: [string, string][] = [];
    if (checkHasDetailValue(record.oldName)) {
        detailRows.push([
            tran('Also called'),
            getFormattedDetailValue(record.oldName),
        ]);
    }
    if (record.years.length > 0) {
        detailRows.push([
            tran('Years'),
            record.years.map(getFormattedYearRange).join(', '),
        ]);
    }
    const listEntries: [string, string[]][] = [
        [
            tran('Locations'),
            getLocationNames(locationsLookupManager, record.locations),
        ],
        [tran('Parents'), getNamesByIds(namesLookupManager, record.parents)],
        [tran('Spouses'), getNamesByIds(namesLookupManager, record.spouses)],
        [tran('Children'), getNamesByIds(namesLookupManager, record.children)],
        [tran('Siblings'), getNamesByIds(namesLookupManager, record.siblings)],
        [tran('Cousins'), getNamesByIds(namesLookupManager, record.cousin)],
        [tran('Verses'), resolvedVerses],
    ];
    for (const [label, values] of listEntries) {
        if (values.length > 0) {
            detailRows.push([label, values.join(', ')]);
        }
    }
    const links = getDisplayLinks(record);
    if (links.length > 0) {
        detailRows.push([
            tran('Links'),
            links
                .map((link) => {
                    return `${getFormattedLinkType(link.type)}: ${link.url}`;
                })
                .join(', '),
        ]);
    }
    return toSummary(
        record.name,
        getPlainReferenceText(record.title),
        getPlainReferenceText(record.description),
        basicFacts,
        detailRows,
    );
}

export function buildLocationSummary(
    locationsLookupManager: LocationsLookupManager,
    record: MentionLocationPreview,
    resolvedVerses: string[],
) {
    const basicFacts = [record.type].filter((value) => {
        return value !== '' && value.toLowerCase() !== 'unknown';
    });
    const detailRows: [string, string][] = [];
    if (checkHasDetailValue(record.oldName)) {
        detailRows.push([
            tran('Also called'),
            getFormattedDetailValue(record.oldName),
        ]);
    }
    if (checkHasDetailValue(record.modernIdentification)) {
        detailRows.push([
            tran('Modern identification'),
            getFormattedDetailValue(record.modernIdentification),
        ]);
    }
    const relatedNames = getLocationNames(
        locationsLookupManager,
        record.relatedLocations,
    );
    if (relatedNames.length > 0) {
        detailRows.push([tran('Related locations'), relatedNames.join(', ')]);
    }
    if (resolvedVerses.length > 0) {
        detailRows.push([tran('Verses'), resolvedVerses.join(', ')]);
    }
    if (record.coordinates !== null) {
        detailRows.push([
            tran('Coordinates'),
            `${record.coordinates.latitude}, ${record.coordinates.longitude}`,
        ]);
    }
    const links = getDisplayLinks(record);
    if (links.length > 0) {
        detailRows.push([
            tran('Links'),
            links
                .map((link) => {
                    return `${getFormattedLinkType(link.type)}: ${link.url}`;
                })
                .join(', '),
        ]);
    }
    return toSummary(
        record.name,
        getPlainReferenceText(record.title),
        getPlainReferenceText(record.description),
        basicFacts,
        detailRows,
    );
}
