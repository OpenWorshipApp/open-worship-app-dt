/**
 * What can be DONE with the person, place or passage a lookup conversation
 * is about (`lookupChatHelpers.ts`), as buttons the window answers with no
 * model: open it in the Bible Lookup, the chapter or verse before and after,
 * another passage, the same in another Bible, who and where is in it, its
 * family and places, its verses, save it, copy it.
 *
 * Asked for with a picture of a lookup conversation about Genesis 4:1-26
 * (2026-10-18): _add more options, like open another verse or open other
 * bible key, and more option to let user able be to do a lot of things on
 * bible_.
 *
 * Every button is `LOOKUP_STEP_TOOL_NAME`, a pseudo tool no model can press,
 * carrying the record it acts on in its args -- an old button acts on its
 * own record, whatever the tab moved on to. Its label is stored in English
 * and drawn in the app's language (`tranLabel`), or is the name or reference
 * itself, already in the record's language.
 *
 * Pure, every rule a test.
 */
import type { LookupAskType } from '../helper/ai/lookupAskHelpers';
import { toValidLookupAsk } from '../helper/ai/lookupAskHelpers';
import { fillWords, tran } from './chatTranHelpers';
import { getAssistantLanguage, toShownDigits } from './chatLangHelpers';
import type { BotActionType } from './helpBotHelpers';
import {
    RESOURCE_ASK_LABEL_TEMPLATE,
    RESOURCE_ASK_TOOL_NAME,
} from './resourcesChatHelpers';

export const LOOKUP_STEP_TOOL_NAME = 'owa_window_lookup_step';

export type LookupStepNameType =
    | 'open'
    | 'more'
    | 'lookup'
    | 'near'
    | 'bibles'
    | 'names'
    | 'related'
    | 'verses'
    | 'lineage'
    | 'another'
    | 'save'
    | 'copy'
    | 'map'
    | 'crossrefs'
    | 'files'
    // Studying the passage's words (`wordStudyHelpers.ts`, 2026-10-23): the
    // verse to study, then the word; one word or every word of a verse
    // explained by the assistant; a word searched on Google.
    | 'words'
    | 'word'
    | 'verseWords'
    | 'wordWeb';

export type LookupStepType = {
    step: LookupStepNameType;
    ask: LookupAskType;
    near?: 'previous' | 'next';
    // A language the person named when they asked for another Bible
    // ("show this in Khmer"): the list keeps the Bibles in it, when there
    // are any (2026-10-19).
    preferLanguage?: 'en' | 'km' | 'fr';
    // A word study's place: the verse by its key (`GEN 8:1`), the word as
    // the verse writes it, the verse's English reference (`Genesis 8:1`,
    // what a web search is written with) and where a long list's page starts.
    verse?: string;
    word?: string;
    ref?: string;
    from?: number;
};

const PREFER_LANGUAGE_LIST: LookupStepType['preferLanguage'][] = [
    'en',
    'km',
    'fr',
];

const STEP_NAME_LIST: LookupStepNameType[] = [
    'open',
    'more',
    'lookup',
    'near',
    'bibles',
    'names',
    'related',
    'verses',
    'lineage',
    'another',
    'save',
    'copy',
    'map',
    'crossrefs',
    'files',
    'words',
    'word',
    'verseWords',
    'wordWeb',
];

// Stored in English, drawn with `tranLabel`; `chatTranLabels.test.ts` holds
// each to its Khmer and French.
export const LOOKUP_ACTION_LABEL_LIST = [
    'More things to do',
    'Open in bible lookup',
    'Previous chapter',
    'Next chapter',
    'Previous verse',
    'Next verse',
    'Read it in another Bible',
    'Who and where is in it',
    'Family and places',
    'Family line to Jesus',
    'Related places',
    'Its verses',
    'Open another passage',
    'Save to my Bibles list',
    'Copy the passage',
    'Show it on a map',
    'Related verses',
    'Study files for this chapter',
    'Study the words',
    'All words',
    'Another verse',
    'Choose a word',
    'More verses',
    'More words',
] as const;

type LabelType = (typeof LOOKUP_ACTION_LABEL_LIST)[number];

// A verse key as a passage record writes one, and the most a saved button
// may carry of a word or a reference.
const STEP_VERSE_PATTERN = /^[0-9A-Z]{3} \d{1,3}:\d{1,3}$/;
const MAX_STEP_WORD_CHARS = 60;
const STEP_REF_PATTERN = /^[\p{L}\p{M}\d .:'’-]{1,40}$/u;
const MAX_STEP_FROM = 2000;

// A word study's fields, each only when it is what such a field holds.
function toValidStudyFields(raw: any) {
    const word = typeof raw?.word === 'string' ? raw.word.trim() : '';
    return {
        ...(typeof raw?.verse === 'string' && STEP_VERSE_PATTERN.test(raw.verse)
            ? { verse: raw.verse }
            : {}),
        ...(word.length > 0 &&
        word.length <= MAX_STEP_WORD_CHARS &&
        !/[\n\r]/.test(word)
            ? { word }
            : {}),
        ...(typeof raw?.ref === 'string' && STEP_REF_PATTERN.test(raw.ref)
            ? { ref: raw.ref }
            : {}),
        ...(Number.isInteger(raw?.from) &&
        raw.from > 0 &&
        raw.from <= MAX_STEP_FROM
            ? { from: raw.from }
            : {}),
    };
}

/** A step as it may be trusted off a button a saved conversation carried. */
export function toValidLookupStep(raw: any): LookupStepType | null {
    if (!STEP_NAME_LIST.includes(raw?.step)) {
        return null;
    }
    const ask = toValidLookupAsk(raw.ask);
    if (ask === null) {
        return null;
    }
    const preferLanguage = PREFER_LANGUAGE_LIST.includes(raw.preferLanguage)
        ? { preferLanguage: raw.preferLanguage }
        : {};
    if (raw.step === 'near') {
        return raw.near === 'previous' || raw.near === 'next'
            ? { step: 'near', ask, near: raw.near, ...preferLanguage }
            : null;
    }
    const study = toValidStudyFields(raw);
    // A word explained or searched for names the word and its verse; every
    // verse's words name the verse.
    if (
        (raw.step === 'word' || raw.step === 'wordWeb') &&
        (study.verse === undefined || study.word === undefined)
    ) {
        return null;
    }
    if (raw.step === 'verseWords' && study.verse === undefined) {
        return null;
    }
    return { step: raw.step, ask, ...preferLanguage, ...study };
}

type StepExtraType = {
    near?: 'previous' | 'next';
    verse?: string;
    word?: string;
    ref?: string;
    from?: number;
};

function toAction(
    label: string,
    step: LookupStepNameType,
    ask: LookupAskType,
    extra: StepExtraType = {},
): BotActionType {
    // Its listed fields alone: a subject handed in carries the words read
    // of it, and a button is stored with the conversation.
    return {
        label,
        toolName: LOOKUP_STEP_TOOL_NAME,
        args: { step, ask: toValidLookupAsk(ask) ?? ask, ...extra },
    };
}

function toLabeled(
    label: LabelType,
    step: LookupStepNameType,
    ask: LookupAskType,
    extra: StepExtraType = {},
) {
    return toAction(label, step, ask, extra);
}

/**
 * A button of a word study (`wordStudyHelpers.ts`): one of the listed
 * labels, drawn in the app's language, or -- `isData` -- words drawn as
 * they are written: a verse's own, a word's own.
 */
export function toLookupStudyAction(
    label: string,
    step: 'words' | 'word' | 'verseWords' | 'wordWeb',
    ask: LookupAskType,
    extra: Omit<StepExtraType, 'near'> = {},
    isData = false,
): BotActionType {
    const action = toAction(label, step, ask, extra);
    return isData ? { ...action, isData: true } : action;
}

/** Whether a passage record read any words to study. */
function checkHasPassageText(facts: any) {
    return (Array.isArray(facts?.passages) ? facts.passages : []).some(
        (passage: any) => {
            return (
                typeof passage?.text === 'string' &&
                passage.text.trim().length > 0
            );
        },
    );
}

/** Whether a passage is ONE verse (`GEN 4:6`), so its neighbours are verses. */
export function checkIsOneVerse(target: string) {
    return /^\S+ \d+:\d+$/.test(target.trim());
}

/** The record's facts as the tool wrote them, or null. */
export function readLookupFacts(facts: string): any {
    try {
        const parsed = JSON.parse(facts);
        return parsed !== null && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

const RELATION_FIELD_LIST = [
    'parents',
    'spouses',
    'children',
    'siblings',
    'cousins',
    'places',
    'relatedPlaces',
];

type RelatedType = {
    kind: 'name' | 'location';
    id: string;
    name: string;
    kjvName?: string;
};

/** A record's family and places, each once, as the tool named them. */
export function listLookupRelated(facts: any): RelatedType[] {
    const seen = new Set<string>();
    const list: RelatedType[] = [];
    for (const field of RELATION_FIELD_LIST) {
        for (const one of Array.isArray(facts?.[field]) ? facts[field] : []) {
            if (
                typeof one?.id !== 'string' ||
                typeof one?.name !== 'string' ||
                seen.has(one.id)
            ) {
                continue;
            }
            seen.add(one.id);
            list.push({
                kind:
                    field === 'places' || field === 'relatedPlaces'
                        ? 'location'
                        : 'name',
                id: one.id,
                name: one.name,
                ...(typeof one.kjvName === 'string'
                    ? { kjvName: one.kjvName }
                    : {}),
            });
        }
    }
    return list;
}

/** The everything-you-can-do list, for the opening card and **More**. */
export function genLookupActions(
    ask: LookupAskType,
    facts: any,
): BotActionType[] {
    if (ask.kind === 'verse') {
        const isOneVerse = checkIsOneVerse(ask.target);
        // What the card gathered (2026-10-23): offered only when there is
        // something to show, like every list here.
        const gathered = [
            ...(Number(facts?.crossRefs?.referenceCount) > 0
                ? [toLabeled('Related verses', 'crossrefs', ask)]
                : []),
            ...(Array.isArray(facts?.studyFiles) && facts.studyFiles.length > 0
                ? [toLabeled('Study files for this chapter', 'files', ask)]
                : []),
            // Its words, one verse at a time (2026-10-23, the user studying
            // the Greek Bible: _give option like study vocabulary then
            // choose verse … then list word to choose or choose all then
            // explain the word_).
            ...(checkHasPassageText(facts)
                ? [toLabeled('Study the words', 'words', ask)]
                : []),
        ];
        return [
            ...gathered,
            toLabeled('Open in bible lookup', 'lookup', ask),
            toLabeled(
                isOneVerse ? 'Previous verse' : 'Previous chapter',
                'near',
                ask,
                { near: 'previous' },
            ),
            toLabeled(isOneVerse ? 'Next verse' : 'Next chapter', 'near', ask, {
                near: 'next',
            }),
            toLabeled('Read it in another Bible', 'bibles', ask),
            toLabeled('Who and where is in it', 'names', ask),
            toLabeled('Open another passage', 'another', ask),
            toLabeled('Save to my Bibles list', 'save', ask),
            toLabeled('Copy the passage', 'copy', ask),
        ];
    }
    const actions: BotActionType[] = [];
    if (Number(facts?.verseCount) > 0) {
        actions.push(toLabeled('Its verses', 'verses', ask));
    }
    if (listLookupRelated(facts).length > 0) {
        actions.push(
            toLabeled(
                ask.kind === 'name' ? 'Family and places' : 'Related places',
                'related',
                ask,
            ),
        );
    }
    // A person's line to Jesus is in the Bible, never in the record: the
    // window reads Matthew 1 / Luke 3 itself (2026-10-19, EC-369). Offered
    // only once something was read, like every other button here.
    if (ask.kind === 'name' && facts !== null) {
        actions.push(toLabeled('Family line to Jesus', 'lineage', ask));
    }
    if (Number(facts?.verseCount) > 0) {
        actions.push(toLabeled('Read it in another Bible', 'bibles', ask));
    }
    // A place the lookup has a point for opens on a map in the browser
    // (2026-10-22): asked to show Ararat on a map, the assistant said it
    // cannot show one.
    if (ask.kind === 'location' && toLookupMapUrl(facts) !== null) {
        actions.push(toLabeled('Show it on a map', 'map', ask));
    }
    return actions;
}

/**
 * The map a place with a point opens on: the same Google Maps search the
 * detail panel's own **Open in Google Maps** opens
 * (`RenderDetailBodyComp`), at the record's coordinates. Null for a place
 * with no point -- a region (Ararat), or a site nobody has placed.
 */
export function toLookupMapUrl(facts: any) {
    const latitude = facts?.coordinates?.latitude;
    const longitude = facts?.coordinates?.longitude;
    if (
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180
    ) {
        return null;
    }
    const query = encodeURIComponent(`${latitude},${longitude}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/** Under every answer: the step a reader takes next, and **More**. */
export function genLookupAnswerActions(ask: LookupAskType): BotActionType[] {
    if (ask.kind !== 'verse') {
        return [toLabeled('More things to do', 'more', ask)];
    }
    const isOneVerse = checkIsOneVerse(ask.target);
    return [
        toLabeled(
            isOneVerse ? 'Previous verse' : 'Previous chapter',
            'near',
            ask,
            { near: 'previous' },
        ),
        toLabeled(isOneVerse ? 'Next verse' : 'Next chapter', 'near', ask, {
            near: 'next',
        }),
        toLabeled('More things to do', 'more', ask),
    ];
}

/** The passage a passage read came back as, to ask about next. */
export function toPassageAsk(
    from: LookupAskType,
    facts: any,
): LookupAskType | null {
    const passage = Array.isArray(facts?.passages) ? facts.passages[0] : null;
    if (typeof passage?.key !== 'string') {
        return null;
    }
    return toValidLookupAsk({
        kind: 'verse',
        target: passage.key,
        title:
            typeof passage.title === 'string'
                ? passage.title
                : String(passage.ref ?? passage.key),
        ...(typeof facts.bible === 'string'
            ? { bibleKey: facts.bible }
            : from.bibleKey === undefined
              ? {}
              : { bibleKey: from.bibleKey }),
        ...(from.page === undefined ? {} : { page: from.page }),
    });
}

/** A record the step leads to, opened in its own card when pressed. */
function toRecordAction(
    record: RelatedType,
    from: LookupAskType,
    langCode?: string,
): BotActionType {
    const lang = langCode ?? from.langCode;
    return toAction(
        record.kjvName === undefined
            ? record.name
            : `${record.name} (${record.kjvName})`,
        'open',
        {
            kind: record.kind,
            target: record.id,
            title: record.name,
            ...(lang === undefined ? {} : { langCode: lang }),
            ...(from.page === undefined ? {} : { page: from.page }),
        },
    );
}

function toUniqueActions(actions: BotActionType[]) {
    const seen = new Set<string>();
    return actions.filter((action) => {
        if (seen.has(action.label)) {
            return false;
        }
        seen.add(action.label);
        return true;
    });
}

/** **Family and places** / **Related places**: one button each. */
export function genRelatedAnswer(ask: LookupAskType, facts: any) {
    const related = listLookupRelated(facts);
    if (related.length === 0) {
        return {
            text: fillWords(
                tran('The names lookup lists no family or places for {name}.'),
                { name: ask.title },
            ),
            actions: [],
        };
    }
    return {
        text: fillWords(
            ask.kind === 'name'
                ? tran(
                      'The family and places of {name}. Press one to ask about it.',
                  )
                : tran('Places related to {name}. Press one to ask about it.'),
            { name: ask.title },
        ),
        actions: toUniqueActions(
            related.slice(0, 16).map((record) => {
                return toRecordAction(record, ask);
            }),
        ),
    };
}

/** **Its verses**: the ones the record quotes, a button each. */
export function genVersesAnswer(ask: LookupAskType, facts: any) {
    const quoted = Array.isArray(facts?.quoted) ? facts.quoted : [];
    const count = Number(facts?.verseCount) || 0;
    if (quoted.length === 0) {
        return {
            text: fillWords(
                tran('The names lookup lists no verses for {name}.'),
                { name: ask.title },
            ),
            actions: [],
        };
    }
    const actions = quoted.flatMap((verse: any) => {
        if (typeof verse?.key !== 'string') {
            return [];
        }
        const title =
            typeof verse.title === 'string'
                ? verse.title
                : String(verse.ref ?? verse.key);
        return [
            toAction(title, 'open', {
                kind: 'verse',
                target: verse.key,
                title,
                ...(typeof facts.bible === 'string'
                    ? { bibleKey: facts.bible }
                    : {}),
                ...(ask.page === undefined ? {} : { page: ask.page }),
            }),
        ];
    });
    const lines = [
        fillWords(tran('Verses about {name}. Press one to read it with me.'), {
            name: ask.title,
        }),
    ];
    if (count > actions.length) {
        lines.push(
            fillWords(
                tran(
                    'The names lookup lists {count} verses; these are the first {shown}.',
                ),
                { count: String(count), shown: String(actions.length) },
            ),
        );
    }
    return { text: lines.join(' '), actions: toUniqueActions(actions) };
}

/** **Who and where is in it**: the people and places the passage names. */
export function genNamesAnswer(ask: LookupAskType, facts: any) {
    const langCode = typeof facts?.lang === 'string' ? facts.lang : undefined;
    const toRecords = (field: string, kind: 'name' | 'location') => {
        return (Array.isArray(facts?.[field]) ? facts[field] : []).flatMap(
            (one: any): RelatedType[] => {
                return typeof one?.id === 'string' &&
                    typeof one?.name === 'string'
                    ? [
                          {
                              kind,
                              id: one.id,
                              name: one.name,
                              ...(typeof one.kjvName === 'string'
                                  ? { kjvName: one.kjvName }
                                  : {}),
                          },
                      ]
                    : [];
            },
        );
    };
    const records = [
        ...toRecords('people', 'name'),
        ...toRecords('places', 'location'),
    ];
    if (records.length === 0) {
        return {
            text: fillWords(
                tran('The names lookup has nobody and no place in {name}.'),
                { name: ask.title },
            ),
            actions: [],
        };
    }
    return {
        text: fillWords(
            tran('People and places in {name}. Press one to ask about it.'),
            { name: ask.title },
        ),
        actions: toUniqueActions(
            records.slice(0, 20).map((record) => {
                return toRecordAction(record, ask, langCode);
            }),
        ),
    };
}

/**
 * Whether a Bible's key or title says it is in this language: its own
 * script for a language written in one, and its own name for a Latin one
 * (`English NIV`, `French (BDS)`), which is how the installed list reads.
 */
function checkIsBibleInLanguage(bible: any, code: string) {
    const language = getAssistantLanguage(code);
    const sample = [bible?.key, bible?.title]
        .filter((one) => {
            return typeof one === 'string';
        })
        .join(' ');
    if (sample.length === 0) {
        return false;
    }
    if (!language.isLatinScript && language.scriptPattern.test(sample)) {
        return true;
    }
    // Its own name too: an installed Khmer Bible may be titled `Khmer 2012`
    // in English (`KCB`), and an English one `English NIV`.
    return `${language.name} ${language.nativeName}`
        .split(/\s+/)
        .some((word) => {
            return (
                word.length > 0 &&
                new RegExp(`\\b${word}\\b`, 'iu').test(sample)
            );
        });
}

/** **Read it in another Bible**: every other installed Bible, a button each. */
export function genBiblesAnswer(
    ask: LookupAskType,
    listed: any,
    preferLanguage?: LookupStepType['preferLanguage'],
) {
    const others = (Array.isArray(listed?.bibles) ? listed.bibles : []).filter(
        (bible: any) => {
            return typeof bible?.key === 'string' && bible.key !== ask.bibleKey;
        },
    );
    // A language the person named: only its Bibles when there are any.
    const inLanguage =
        preferLanguage === undefined
            ? []
            : others.filter((bible: any) => {
                  return checkIsBibleInLanguage(bible, preferLanguage);
              });
    const bibles = inLanguage.length > 0 ? inLanguage : others;
    if (bibles.length === 0) {
        return {
            text: tran('This is the only Bible on this computer.'),
            actions: [],
        };
    }
    return {
        text: fillWords(tran('Which Bible should I read {name} in?'), {
            name: ask.title,
        }),
        actions: toUniqueActions(
            bibles.slice(0, 16).map((bible: any) => {
                return toAction(
                    typeof bible.title === 'string' && bible.title !== bible.key
                        ? `${bible.key} — ${bible.title}`
                        : bible.key,
                    'open',
                    { ...ask, bibleKey: bible.key },
                );
            }),
        ),
    };
}

type NamedRefType = {
    key: string;
    title?: string;
    from?: string[];
    // How many verses lead there when more than `from` names.
    fromCount?: number;
};

function readNamedRefs(list: any): NamedRefType[] {
    return (Array.isArray(list) ? list : []).flatMap((one: any) => {
        return typeof one?.key === 'string'
            ? [
                  {
                      key: one.key,
                      ...(typeof one.title === 'string'
                          ? { title: one.title }
                          : {}),
                      ...(Array.isArray(one.from)
                          ? {
                                from: one.from.filter((verse: any) => {
                                    return typeof verse === 'string';
                                }),
                            }
                          : {}),
                      ...(Number.isInteger(one.fromCount)
                          ? { fromCount: one.fromCount }
                          : {}),
                  },
              ]
            : [];
    });
}

// How many of the references a **Related verses** answer names, and how
// many verses' themes it lists.
const MAX_SHOWN_REFS = 6;
const MAX_SHOWN_THEME_VERSES = 12;
const MAX_REF_BUTTONS = 18;
const MAX_NAMED_FROM_VERSES = 3;

/**
 * **Related verses**: what the app's cross references lead to from the
 * passage, told with no model (2026-10-23) -- what most of its verses point
 * to, where the other Testament speaks of it, and each verse's themes in
 * the words of the Bible's language -- with a button for every reference
 * named, which opens it in a card of its own.
 */
export function genCrossRefsAnswer(ask: LookupAskType, facts: any) {
    const crossRefs = facts?.crossRefs;
    const count = Number(crossRefs?.referenceCount) || 0;
    if (count === 0) {
        return {
            text: fillWords(
                tran("The app's cross references have nothing for {name}."),
                { name: ask.title },
            ),
            actions: [],
        };
    }
    const bibleKey =
        typeof facts?.bible === 'string' ? facts.bible : ask.bibleKey;
    // Which of its verses lead there: named while they are few, counted
    // past that -- seen live, eleven verse numbers under one reference.
    const toLine = (ref: NamedRefType) => {
        const fromCount = ref.fromCount ?? ref.from?.length ?? 0;
        const from =
            fromCount > MAX_NAMED_FROM_VERSES
                ? ` (${fillWords(tran('{count} of its verses'), {
                      count: toShownDigits(fromCount),
                  })})`
                : fromCount > 1
                  ? ` (${fillWords(tran('verses {list}'), {
                        list: toShownDigits((ref.from ?? []).join(', ')),
                    })})`
                  : '';
        return `- **${ref.title ?? ref.key}**${from}`;
    };
    const other = readNamedRefs(crossRefs.otherTestament).slice(
        0,
        MAX_SHOWN_REFS,
    );
    // Each once: one the other Testament's list names is told there.
    const otherKeySet = new Set(
        other.map((ref) => {
            return ref.key;
        }),
    );
    const mostCited = readNamedRefs(crossRefs.mostCited)
        .filter((ref) => {
            return !otherKeySet.has(ref.key);
        })
        .slice(0, MAX_SHOWN_REFS);
    // The rest of the same story (2026-10-23): what the other Testament
    // says of the chapters around it -- Jesus on the days of Noah, under
    // Genesis 8.
    const around = readNamedRefs(crossRefs.otherTestamentAround).slice(
        0,
        MAX_SHOWN_REFS,
    );
    const isOldTestament = crossRefs.otherTestamentName === 'Old Testament';
    const lines = [
        fillWords(
            tran(
                "The app's cross references lead from {name} to {count} " +
                    'other verses. Press one to read it with me.',
            ),
            { name: ask.title, count: toShownDigits(count) },
        ),
    ];
    if (mostCited.length > 0) {
        lines.push(
            '',
            `**${tran('What most of its verses point to')}**`,
            ...mostCited.map(toLine),
        );
    }
    if (other.length > 0) {
        lines.push(
            '',
            `**${
                isOldTestament
                    ? tran('In the Old Testament')
                    : tran('In the New Testament')
            }**`,
            ...other.map(toLine),
        );
    }
    if (around.length > 0) {
        lines.push(
            '',
            `**${
                isOldTestament
                    ? tran('In the Old Testament, about the chapters around it')
                    : tran('In the New Testament, about the chapters around it')
            }**`,
            ...around.map(toLine),
        );
    }
    const byVerse: any[] = Array.isArray(crossRefs.byVerse)
        ? crossRefs.byVerse
        : [];
    const themeLines = byVerse
        .slice(0, MAX_SHOWN_THEME_VERSES)
        .flatMap((one: any) => {
            const themes = (Array.isArray(one?.themes) ? one.themes : [])
                .map((theme: any) => {
                    return typeof theme?.theme === 'string' ? theme.theme : '';
                })
                .filter((theme: string) => {
                    return theme.length > 0;
                });
            return typeof one?.verse === 'string' && themes.length > 0
                ? [
                      `- ${fillWords(tran('Verse {verse}: {themes}'), {
                          verse: toShownDigits(one.verse),
                          themes: themes.join('; '),
                      })}`,
                  ]
                : [];
        });
    if (themeLines.length > 0) {
        lines.push('', `**${tran('Themes, verse by verse')}**`, ...themeLines);
    }
    const seen = new Set<string>();
    const actions = [...mostCited, ...other, ...around]
        .filter((ref) => {
            if (seen.has(ref.key)) {
                return false;
            }
            seen.add(ref.key);
            return true;
        })
        .slice(0, MAX_REF_BUTTONS)
        .map((ref) => {
            const title = ref.title ?? ref.key;
            return toAction(title, 'open', {
                kind: 'verse',
                target: ref.key,
                title,
                ...(bibleKey === undefined ? {} : { bibleKey }),
                ...(ask.page === undefined ? {} : { page: ask.page }),
            });
        });
    return { text: lines.join('\n'), actions };
}

/**
 * **Study files for this chapter**: the passage's chapter's files in
 * Resources, each with **Ask about …** -- the press attaches it to the
 * tab, the way an answer about Resources offers another file.
 */
export function genStudyFilesAnswer(ask: LookupAskType, facts: any) {
    const files: string[] = (
        Array.isArray(facts?.studyFiles) ? facts.studyFiles : []
    ).filter((file: any) => {
        return typeof file === 'string' && file.length > 0;
    });
    if (files.length === 0) {
        return {
            text: fillWords(
                tran('Resources has no study files for the chapter of {name}.'),
                { name: ask.title },
            ),
            actions: [],
        };
    }
    const toName = (file: string) => {
        return file.split('/').pop() ?? file;
    };
    return {
        text: [
            fillWords(
                tran(
                    'The study files in Resources for the chapter of {name}. ' +
                        'Press one to ask about it.',
                ),
                { name: ask.title },
            ),
            ...files.map((file) => {
                return `- ${toName(file)}`;
            }),
        ].join('\n'),
        actions: files.map((file) => {
            return {
                label: fillWords(RESOURCE_ASK_LABEL_TEMPLATE, {
                    name: toName(file),
                }),
                toolName: RESOURCE_ASK_TOOL_NAME,
                args: { file },
            };
        }),
    };
}

/** **Copy the passage**: the words a passage read came back with. */
export function toPassageCopyText(facts: any) {
    const passages = Array.isArray(facts?.passages) ? facts.passages : [];
    const text = passages
        .flatMap((passage: any) => {
            return typeof passage?.text === 'string'
                ? [
                      `${String(passage.title ?? passage.ref ?? '')}\n${passage.text}`.trim(),
                  ]
                : [];
        })
        .join('\n\n');
    if (text.length === 0) {
        return null;
    }
    return typeof facts.bible === 'string' ? `(${facts.bible}) ${text}` : text;
}
