/**
 * Passages saved to a Bibles list by the window, and the ones that need a
 * person's word first (2026-11-14, EC-626; the user: _I carry a list of
 * bible verses so I expect chatbot can parse and add those items into the
 * list_, _if ambiguous bible verse then have to follow up to ask for user
 * input_). `bibleListPasteHelpers.ts` reads what was typed; this saves it
 * through `owa_bible_item`, words the answer, and asks about one unclear
 * passage at a time with buttons -- the choice pressed is saved the same
 * way, then the next one is asked. No model.
 */

import {
    BIBLE_ITEM_TOOL_NAME,
    checkIsSavedAlready,
    checkIsUnreadableReference,
    DEFAULT_BIBLE_LIST_NAME,
    readBibleListTitles,
    type BibleListAskType,
    type BibleListRequestType,
} from './bibleListAskHelpers';
import {
    MAX_PASTE_PASSAGE_COUNT,
    readBibleListPaste,
    toValidBibleListPicks,
    type BibleListChoiceType,
    type BibleListPassageType,
    type BibleListPasteType,
    type BibleListPickType,
    type ReadTypedRequestType,
} from './bibleListPasteHelpers';
import { toAsciiDigitText } from '../helper/bibleVerseFindHelpers';
import { fillWords, tran } from './chatTranHelpers';
import type { BotActionType } from './helpBotHelpers';
import {
    genStudyBookNames,
    type StudyBookNamesType,
} from './studyVerseCheckHelpers';

/** A choice pressed under the window's question -- registered nowhere. */
export const BIBLE_LIST_PICK_TOOL_NAME = 'owa-bible-list-pick';
// Stored English and drawn in the window's language, like every button
// label code does not read back.
const SKIP_LABEL = 'Skip';
// Bibles offered for a version that is not installed, beside **Skip**.
const MAX_VERSION_CHOICES = 4;
// What a list name and a page may be on a pressed button.
const MAX_LIST_NAME_LENGTH = 120;
const READER_PAGE = 'reader.html';

/** A tool called and its answer read as JSON (`parseToolJson`). */
export type CallToolJsonType = (
    name: string,
    args: Record<string, unknown>,
) => Promise<any>;

/** What a request to save passages reads as, whichever reader read it. */
export type BibleListSaveAskType = {
    listName: string | null;
    isNewList: boolean;
    // A list was named, or `owa_bible_item`'s own words were: a bare
    // "Add John 3:16" is not, and a tab with a document open keeps it.
    isListNamed: boolean;
    passages: BibleListPassageType[];
    picks: BibleListPickType[];
    unreadable: string[];
    overflow: string[];
};

export type BibleListSavedType = {
    savedTitles: string[];
    changeIds: string[];
    alreadySaved: string[];
    unreadable: string[];
    notSaved: string[];
    // A passage asked for in a Bible that is not installed: which one to
    // save it in is asked.
    picks: BibleListPickType[];
};

/** The pressed choice, read back off its button. */
export type BibleListPickArgsType = {
    // Null for **Skip**.
    choice: BibleListChoiceType | null;
    list: string | null;
    page?: string;
    rest: BibleListPickType[];
};

/** The older reader's answer, in the shape the window saves from. */
export function toBibleListSaveAsk(
    ask: BibleListAskType | null,
): BibleListSaveAskType | null {
    if (ask === null) {
        return null;
    }
    return {
        listName: ask.listName,
        isNewList: ask.isNewList,
        isListNamed: true,
        passages: ask.references.map((reference) => {
            return { written: reference, reference, version: null };
        }),
        picks: [],
        unreadable: [],
        overflow: [],
    };
}

/** The new reader's answer, in the same shape. */
export function toPastedBibleListSaveAsk(
    paste: BibleListPasteType | null,
): BibleListSaveAskType | null {
    return paste === null ? null : { ...paste };
}

/**
 * Passages read off what was typed with every installed Bible's book names
 * (`owa_bible_suggest books`). `undefined` when the names cannot be read,
 * so the older reader is asked instead; null when the line is no request.
 */
export async function readBibleListPasteAsk(
    callToolJson: CallToolJsonType,
    text: string,
    readTypedRequest?: ReadTypedRequestType,
    carriedRequest?: BibleListRequestType | null,
): Promise<BibleListSaveAskType | null | undefined> {
    let names: StudyBookNamesType | null;
    try {
        names = genStudyBookNames(
            await callToolJson('owa_bible_suggest', {
                kind: 'books',
                prefix: '',
            }),
        );
    } catch (error) {
        console.warn('The Bibles could not be read for a list:', error);
        return undefined;
    }
    if (names === null) {
        return undefined;
    }
    return toPastedBibleListSaveAsk(
        readBibleListPaste(text, names, {
            installedKeys: [...names.bibleMap.keys()],
            readTypedRequest,
            carriedRequest,
        }),
    );
}

const VERSION_REFUSAL_PATTERN =
    /No Bible version called "([^"]*)" is installed\./u;
const INSTALLED_VERSIONS_PATTERN = /Installed versions: (.+?)\.?\s*$/u;

/** A refusal of a version that is not installed, and the ones that are. */
export function readVersionRefusal(message: string) {
    const match = VERSION_REFUSAL_PATTERN.exec(message);
    if (match === null) {
        return null;
    }
    const installed = (
        INSTALLED_VERSIONS_PATTERN.exec(message.trim())?.[1] ?? ''
    )
        .split(',')
        .map((one) => {
            return one.trim();
        })
        .filter((one) => {
            return one !== '';
        });
    return { version: match[1], installed };
}

function toVersionPick(
    passage: BibleListPassageType,
    refusal: { version: string; installed: string[] },
): BibleListPickType {
    return {
        kind: 'version',
        written: passage.written,
        missingVersion: refusal.version,
        choices: refusal.installed.slice(0, MAX_VERSION_CHOICES).map((key) => {
            return {
                label: key,
                reference: passage.reference,
                version: key,
            };
        }),
    };
}

/** What the list holds already, read before anything is saved to it. */
export async function readSavedBibleListTitles(
    callToolJson: CallToolJsonType,
    listName: string | null,
    pageArgs: Record<string, string>,
) {
    try {
        return readBibleListTitles(
            await callToolJson(BIBLE_ITEM_TOOL_NAME, {
                action: 'list',
                list: listName ?? DEFAULT_BIBLE_LIST_NAME,
                ...pageArgs,
            }),
        );
    } catch (_error) {
        // Default not made yet: nothing is in it.
        return [];
    }
}

/**
 * Each passage saved, in the Bible written beside it or the Lookup's. A
 * passage the list held already is taken back at once (the Bibles panel
 * flags a repeat), and one asked for in a Bible that is not installed is
 * asked about.
 */
export async function saveBibleListPassages(
    callToolJson: CallToolJsonType,
    passages: BibleListPassageType[],
    target: {
        listName: string | null;
        pageArgs: Record<string, string>;
        savedBefore: string[];
    },
): Promise<BibleListSavedType> {
    const saved: BibleListSavedType = {
        savedTitles: [],
        changeIds: [],
        alreadySaved: [],
        unreadable: [],
        notSaved: [],
        picks: [],
    };
    for (const passage of passages) {
        try {
            const added = await callToolJson(BIBLE_ITEM_TOOL_NAME, {
                action: 'add',
                reference: passage.reference,
                ...(passage.version === null
                    ? {}
                    : { version: passage.version }),
                ...(target.listName === null ? {} : { list: target.listName }),
                ...target.pageArgs,
            });
            const addedTitle = String(added?.added ?? passage.written);
            const addedId =
                typeof added?.undoId === 'string' && added.undoId !== ''
                    ? added.undoId
                    : null;
            if (
                addedId !== null &&
                checkIsSavedAlready(addedTitle, [
                    ...target.savedBefore,
                    ...saved.savedTitles,
                ])
            ) {
                try {
                    await callToolJson('owa_undo', {
                        action: 'undo',
                        id: addedId,
                    });
                    saved.alreadySaved.push(addedTitle);
                    continue;
                } catch (_error) {
                    // Not taken back: it stays saved, said as saved, its
                    // Undo under the answer.
                }
            }
            saved.savedTitles.push(addedTitle);
            if (addedId !== null) {
                saved.changeIds.push(addedId);
            }
        } catch (error: any) {
            const message = String(error?.message ?? '');
            const refusal =
                passage.version === null ? null : readVersionRefusal(message);
            if (refusal !== null && refusal.installed.length > 0) {
                saved.picks.push(toVersionPick(passage, refusal));
            } else if (checkIsUnreadableReference(message)) {
                saved.unreadable.push(passage.written);
            } else {
                saved.notSaved.push(passage.written);
            }
        }
    }
    return saved;
}

/** The answer's lines: what was made, saved, kept out and left. */
export function genBibleListSavedLines(
    saved: Omit<BibleListSavedType, 'picks' | 'changeIds'>,
    listName: string | null,
    options: { isMadeList?: boolean; overflow?: string[] } = {},
) {
    const shownListName = listName ?? DEFAULT_BIBLE_LIST_NAME;
    const overflow = options.overflow ?? [];
    return [
        ...(options.isMadeList === true
            ? [
                  fillWords(
                      tran('I made “{name}” for you. It is in {list} now.'),
                      { name: shownListName, list: tran('Bibles') },
                  ),
              ]
            : []),
        ...(saved.savedTitles.length === 0
            ? []
            : [
                  listName === null
                      ? fillWords(tran('Saved {name} to your Bibles list.'), {
                            name: saved.savedTitles.join(', '),
                        })
                      : fillWords(
                            tran(
                                'Saved to the Bibles list “{list}”: {passages}.',
                            ),
                            {
                                list: listName,
                                passages: saved.savedTitles.join(', '),
                            },
                        ),
              ]),
        ...(saved.alreadySaved.length === 0
            ? []
            : [
                  listName === null
                      ? fillWords(
                            tran(
                                '{name} is in your Bibles list already, so it is not saved twice.',
                            ),
                            { name: saved.alreadySaved.join(', ') },
                        )
                      : fillWords(
                            tran(
                                '{name} is in the Bibles list “{list}” already, so it is not saved twice.',
                            ),
                            {
                                name: saved.alreadySaved.join(', '),
                                list: listName,
                            },
                        ),
              ]),
        ...(saved.unreadable.length === 0
            ? []
            : [
                  fillWords(
                      tran(
                          'These could not be read as a passage in any installed Bible: {passages}.',
                      ),
                      { passages: saved.unreadable.join(', ') },
                  ),
              ]),
        ...(saved.notSaved.length === 0
            ? []
            : [
                  fillWords(tran('I could not save {name} just now.'), {
                      name: saved.notSaved.join(', '),
                  }),
              ]),
        ...(overflow.length === 0
            ? []
            : [
                  fillWords(
                      tran(
                          'I save up to {count} passages at a time. These were not saved: {passages}. Send them again and I will save them.',
                      ),
                      {
                          count: String(MAX_PASTE_PASSAGE_COUNT),
                          passages: overflow.join(', '),
                      },
                  ),
              ]),
    ];
}

/** The question asked about one unclear passage. */
export function genBibleListPickText(pick: BibleListPickType) {
    if (pick.kind === 'version' && pick.missingVersion !== undefined) {
        return fillWords(
            tran(
                'No Bible called “{version}” is installed. Which Bible should I save {name} in?',
            ),
            { version: pick.missingVersion, name: pick.written },
        );
    }
    return fillWords(
        tran('Which do you mean by “{name}”? Press one and I will save it.'),
        { name: pick.written },
    );
}

/**
 * A button a choice, then **Skip**. Each carries the questions still to
 * ask, so a press after the window was opened again still goes on; the
 * choice's label is the passage as a Bible writes it, drawn as written.
 */
export function genBibleListPickActions(
    pick: BibleListPickType,
    rest: BibleListPickType[],
    listName: string | null,
    page?: string,
): BotActionType[] {
    const base = {
        list: listName,
        ...(page === undefined ? {} : { page }),
        rest: rest.slice(0, MAX_PASTE_PASSAGE_COUNT),
    };
    const labels = new Set<string>();
    return [
        ...pick.choices.flatMap((choice): BotActionType[] => {
            if (labels.has(choice.label) || choice.label === SKIP_LABEL) {
                return [];
            }
            labels.add(choice.label);
            return [
                {
                    label: choice.label,
                    isData: true,
                    toolName: BIBLE_LIST_PICK_TOOL_NAME,
                    args: { ...base, choice },
                },
            ];
        }),
        {
            label: SKIP_LABEL,
            toolName: BIBLE_LIST_PICK_TOOL_NAME,
            args: { ...base, choice: null },
        },
    ];
}

/** A pressed button's args, field by field, or null. */
export function toValidBibleListPickArgs(
    value: unknown,
): BibleListPickArgsType | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const args = value as Record<string, unknown>;
    const list =
        args.list === null
            ? null
            : typeof args.list === 'string' &&
                args.list.trim() !== '' &&
                args.list.length <= MAX_LIST_NAME_LENGTH
              ? args.list
              : undefined;
    if (list === undefined) {
        return null;
    }
    if (args.page !== undefined && args.page !== READER_PAGE) {
        return null;
    }
    let choice: BibleListChoiceType | null = null;
    if (args.choice !== null) {
        const [read] = toValidBibleListPicks([
            { kind: 'range', written: '-', choices: [args.choice] },
        ]);
        if (read === undefined) {
            return null;
        }
        choice = read.choices[0];
    }
    return {
        choice,
        list,
        ...(args.page === undefined ? {} : { page: READER_PAGE }),
        rest: toValidBibleListPicks(args.rest),
    };
}

// `GEN 1:2-`, the form an open range is read into.
const OPEN_RANGE_PATTERN = /^(\S+)\s+(\d+):(\d+)-$/u;

/**
 * An open range's two choices made whole and named as the Bible names them
 * -- _Genesis 1:2-31_ and _Genesis 1:2_ -- off `owa_present_bible check`,
 * which puts nothing on a screen: the chapter for its last verse (the tool
 * reads no open range), then the range for its title. Left as written when
 * the Bible cannot be read; saving it then says so.
 */
export async function nameBibleListRangePick(
    callToolJson: CallToolJsonType,
    pick: BibleListPickType,
): Promise<BibleListPickType> {
    if (pick.kind !== 'range' || pick.choices.length < 2) {
        return pick;
    }
    const [whole, single, ...others] = pick.choices;
    const open = OPEN_RANGE_PATTERN.exec(whole.reference);
    if (open === null) {
        return pick;
    }
    const versionArgs =
        whole.version === null ? {} : { version: whole.version };
    const check = async (reference: string) => {
        const checked = await callToolJson('owa_present_bible', {
            action: 'check',
            reference,
            ...versionArgs,
        });
        return typeof checked?.reference === 'string'
            ? checked.reference.trim()
            : '';
    };
    try {
        const [, book, chapter, start] = open;
        const lastVerse = Number(
            toAsciiDigitText(
                /(\p{Nd}+)\s*$/u.exec(await check(`${book} ${chapter}`))?.[1] ??
                    '',
            ),
        );
        if (!Number.isInteger(lastVerse) || lastVerse < Number(start)) {
            return pick;
        }
        const reference =
            lastVerse === Number(start)
                ? `${book} ${chapter}:${start}`
                : `${book} ${chapter}:${start}-${lastVerse}`;
        const title = await check(reference);
        if (title === '') {
            return pick;
        }
        const singleTitle = title.replace(/\s*[-–—]\s*\p{Nd}+\s*$/u, '');
        return {
            ...pick,
            choices: [
                { ...whole, label: title, reference },
                {
                    ...single,
                    label: singleTitle === '' ? single.label : singleTitle,
                },
                ...others,
            ],
        };
    } catch (_error) {
        return pick;
    }
}
