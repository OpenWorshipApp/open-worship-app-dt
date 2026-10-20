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
import { getAssistantLanguage } from './chatLangHelpers';
import type { BotActionType } from './helpBotHelpers';

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
    | 'copy';

export type LookupStepType = {
    step: LookupStepNameType;
    ask: LookupAskType;
    near?: 'previous' | 'next';
    // A language the person named when they asked for another Bible
    // ("show this in Khmer"): the list keeps the Bibles in it, when there
    // are any (2026-10-19).
    preferLanguage?: 'en' | 'km' | 'fr';
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
] as const;

type LabelType = (typeof LOOKUP_ACTION_LABEL_LIST)[number];

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
    return { step: raw.step, ask, ...preferLanguage };
}

function toAction(
    label: string,
    step: LookupStepNameType,
    ask: LookupAskType,
    extra: { near?: 'previous' | 'next' } = {},
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
    extra: { near?: 'previous' | 'next' } = {},
) {
    return toAction(label, step, ask, extra);
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
        return [
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
    return actions;
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
