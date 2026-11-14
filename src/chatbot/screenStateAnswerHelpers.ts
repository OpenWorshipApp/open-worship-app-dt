/**
 * A screen ask answered with NO assistant (2026-11-14, EC-625): the setting
 * it asks about, as each screen has it now, in the window's own words.
 *
 * With no model -- no key, the network down in a church back room, the
 * spend guard paused -- every screen ask had been answered with what each
 * screen showed: _check the display: which monitor is each screen on?_ got
 * "Screen 0 is showing right now, on a machine with 3 display(s)", which
 * names no monitor, and _make the Bible text on screen 1 bigger_ the same,
 * never saying that nothing had changed. The screens' own state answers
 * the asked part: `owa_list_screens` holds each screen's display, lock,
 * tick, stage and passage; `owa_screen_edit`'s quiet `read` its
 * transitions, group, Line Sync and the Bible text's size. Pure: the
 * caller reads the state (`answerScreenAsk`, `helpBotHelpers.ts`).
 */
import { fillWords, tran } from './chatTranHelpers';
import type { ScreenAskReadType } from './typedScreenAskHelpers';

type ListDisplayType = {
    id: number;
    label?: string;
    width?: number;
    height?: number;
    isPrimary?: boolean;
};

// `owa_list_screens` gives a screen's display as `display`, by its id, or
// none when the screen's display is not on this computer now.
type ListScreenType = {
    screenId: number;
    isLocked?: boolean;
    isSelected?: boolean;
    display?: { id?: number };
    stage?: number;
    bible?: { reference?: string; version?: string; versions?: string[] };
};

type EditScreenType = {
    id: number;
    group?: string | null;
    transition?: Record<string, string>;
    lineSync?: boolean;
};

const LIST_KIND_LIST = ['display', 'lock', 'stage', 'select', 'versions'];
const EDIT_KIND_LIST = ['transition', 'group', 'lineSync', 'style'];

/** Whether the state says this kind's setting: the screens' own controls. */
export function checkIsScreenSettingKind(kind: ScreenAskReadType | null) {
    return (
        kind !== null &&
        (LIST_KIND_LIST.includes(kind) || EDIT_KIND_LIST.includes(kind))
    );
}

/** Whether the screens' quiet read is needed for this kind's answer. */
export function checkNeedsScreenEditRead(kind: ScreenAskReadType | null) {
    return kind !== null && EDIT_KIND_LIST.includes(kind);
}

function toList<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

function toListScreens(listState: any) {
    return toList<ListScreenType>(listState?.screens)
        .filter((screen) => {
            return Number.isInteger(screen?.screenId);
        })
        .sort((one, other) => {
            return one.screenId - other.screenId;
        });
}

function toEditScreens(editState: any) {
    return toList<EditScreenType>(editState?.screens)
        .filter((screen) => {
            return Number.isInteger(screen?.id);
        })
        .sort((one, other) => {
            return one.id - other.id;
        });
}

/**
 * A monitor as the screen's display button names it, with its size, and
 * "primary" as the display menu marks the computer's own monitor: a screen
 * on it covers the operator's own window.
 */
function toDisplayName(display: ListDisplayType) {
    const label = typeof display.label === 'string' ? display.label.trim() : '';
    const isPrimary = display.isPrimary === true;
    const name =
        label !== ''
            ? label
            : isPrimary
              ? tran('Primary display')
              : `${tran('Display')} ${display.id}`;
    const notes = [
        display.width && display.height
            ? `${display.width}×${display.height}`
            : '',
        isPrimary && label !== '' ? tran('primary') : '',
    ].filter((note) => {
        return note !== '';
    });
    return notes.length > 0 ? `${name} (${notes.join(', ')})` : name;
}

function genDisplaySentences(listState: any, onlyScreenId?: number | null) {
    const displays = toList<ListDisplayType>(listState?.displays);
    const screens = toListScreens(listState);
    const saidScreens =
        typeof onlyScreenId === 'number'
            ? screens.filter((screen) => {
                  return screen.screenId === onlyScreenId;
              })
            : [];
    return (saidScreens.length > 0 ? saidScreens : screens).map((screen) => {
        const displayId = screen.display?.id;
        const display =
            displayId === undefined
                ? undefined
                : displays.find((one) => {
                      return one.id === displayId;
                  });
        return display === undefined
            ? fillWords(tran('Screen {id} is on no monitor here.'), {
                  id: screen.screenId,
              })
            : fillWords(tran('Screen {id} is on {display}.'), {
                  id: screen.screenId,
                  display: toDisplayName(display),
              });
    });
}

function genLockSentences(listState: any) {
    return toListScreens(listState).map((screen) => {
        return screen.isLocked === true
            ? fillWords(tran('Screen {id} is locked.'), { id: screen.screenId })
            : fillWords(tran('Screen {id} is not locked.'), {
                  id: screen.screenId,
              });
    });
}

function genStageSentences(listState: any) {
    return toListScreens(listState)
        .filter((screen) => {
            return Number.isInteger(screen.stage);
        })
        .map((screen) => {
            return fillWords(tran('Screen {id} is on stage {stage}.'), {
                id: screen.screenId,
                stage: screen.stage as number,
            });
        });
}

function genSelectSentences(listState: any) {
    const screens = toListScreens(listState);
    if (screens.length === 0) {
        return [];
    }
    const ids = screens
        .filter((screen) => {
            return screen.isSelected === true;
        })
        .map((screen) => {
            return screen.screenId;
        });
    if (ids.length === 0) {
        return [
            tran(
                'No screen is ticked, so what you present next goes to ' +
                    'none of them.',
            ),
        ];
    }
    return [
        ids.length === 1
            ? fillWords(
                  tran(
                      'Screen {ids} is ticked, so what you present next ' +
                          'goes there.',
                  ),
                  { ids: ids.join(', ') },
              )
            : fillWords(
                  tran(
                      'Screens {ids} are ticked, so what you present next ' +
                          'goes there.',
                  ),
                  { ids: ids.join(', ') },
              ),
    ];
}

function genVersionSentences(listState: any) {
    return toListScreens(listState).map((screen) => {
        const bible = screen.bible;
        const reference =
            typeof bible?.reference === 'string' ? bible.reference.trim() : '';
        if (reference === '') {
            return fillWords(tran('Screen {id} shows no Bible passage.'), {
                id: screen.screenId,
            });
        }
        const versions =
            Array.isArray(bible?.versions) && bible.versions.length > 0
                ? bible.versions
                : typeof bible?.version === 'string' && bible.version !== ''
                  ? [bible.version]
                  : [];
        return fillWords(tran('Screen {id} shows {held}.'), {
            id: screen.screenId,
            held:
                versions.length > 0
                    ? `${reference} (${versions.join(', ')})`
                    : reference,
        });
    });
}

// The transition menu names its effects by their own identifiers, never
// translated (`RenderTransitionEffectComp`): the answer names them so.
function genTransitionSentences(editState: any) {
    return toEditScreens(editState)
        .filter((screen) => {
            return screen.transition !== undefined;
        })
        .map((screen) => {
            const transition = screen.transition ?? {};
            return fillWords(
                tran(
                    'Screen {id} changes slides with {slide}, the ' +
                        'background with {background} and the foreground ' +
                        'with {foreground}.',
                ),
                {
                    id: screen.id,
                    slide: transition.slide ?? 'fade',
                    background: transition.background ?? 'fade',
                    foreground: transition.foreground ?? 'fade',
                },
            );
        });
}

function genGroupSentences(editState: any) {
    const screens = toEditScreens(editState);
    if (screens.length === 0) {
        return [];
    }
    const groupMap = new Map<string, number[]>();
    for (const screen of screens) {
        if (typeof screen.group !== 'string' || screen.group === '') {
            continue;
        }
        groupMap.set(screen.group, [
            ...(groupMap.get(screen.group) ?? []),
            screen.id,
        ]);
    }
    const groups = [...groupMap.values()].filter((ids) => {
        return ids.length > 1;
    });
    if (groups.length === 0) {
        return [tran('No screens are grouped.')];
    }
    return groups.map((ids) => {
        return fillWords(
            tran('Screens {ids} are grouped, so they show the same thing.'),
            { ids: ids.join(', ') },
        );
    });
}

function genLineSyncSentences(editState: any) {
    return toEditScreens(editState)
        .filter((screen) => {
            return typeof screen.lineSync === 'boolean';
        })
        .map((screen) => {
            return screen.lineSync === true
                ? fillWords(tran('Line Sync is on for screen {id}.'), {
                      id: screen.id,
                  })
                : fillWords(tran('Line Sync is off for screen {id}.'), {
                      id: screen.id,
                  });
        });
}

// `describeScreenStyle` (`agentScreenControlRules.ts`) starts with the
// size: "60px, words #FFFFFF, …". The rest is English words.
const STYLE_SIZE_PATTERN = /^(\d+(?:\.\d+)?)px\b/;

function genStyleSentences(editState: any) {
    const style =
        typeof editState?.bibleStyle === 'string' ? editState.bibleStyle : '';
    const sizeMatch = STYLE_SIZE_PATTERN.exec(style.trim());
    if (sizeMatch === null) {
        return [];
    }
    return [
        fillWords(
            tran('The Bible text is {size} pixels high on every screen.'),
            { size: sizeMatch[1] },
        ),
    ];
}

/**
 * The asked setting, a sentence a screen (or one for all of them), from
 * `owa_list_screens`' state and `owa_screen_edit`'s read; null for a kind
 * this does not answer -- a clear, a screen named by its number -- or a
 * state that says nothing about it. A screen added (EC-630) is answered
 * with the screens there are: the monitor each is on, and which are
 * ticked -- a new one is ticked by nobody; once added, `addedScreenId`
 * says the monitor of that screen alone, by its number.
 */
export function genScreenSettingText(
    kind: ScreenAskReadType | null,
    listState: any,
    editState: any,
    addedScreenId?: number | null,
): string | null {
    if (kind === null) {
        return null;
    }
    let sentences: string[] = [];
    if (kind === 'newScreen') {
        sentences = [
            ...genDisplaySentences(listState, addedScreenId),
            ...genSelectSentences(listState),
        ];
    } else if (LIST_KIND_LIST.includes(kind)) {
        sentences =
            kind === 'display'
                ? genDisplaySentences(listState)
                : kind === 'lock'
                  ? genLockSentences(listState)
                  : kind === 'stage'
                    ? genStageSentences(listState)
                    : kind === 'select'
                      ? genSelectSentences(listState)
                      : genVersionSentences(listState);
    } else if (EDIT_KIND_LIST.includes(kind)) {
        sentences =
            kind === 'transition'
                ? genTransitionSentences(editState)
                : kind === 'group'
                  ? genGroupSentences(editState)
                  : kind === 'lineSync'
                    ? genLineSyncSentences(editState)
                    : genStyleSentences(editState);
    }
    return sentences.length > 0 ? sentences.join(' ') : null;
}

/**
 * What is said under it, for an ask to change and an ask to know alike:
 * nothing here changes a screen, and the two ways it will be -- an
 * assistant, or the guide's steps (a how-to is the guide's in any
 * language).
 */
export function genScreenChangeLaterText() {
    return tran(
        'To change it, ask again when an assistant can answer, or ask me ' +
            'how to do it yourself.',
    );
}
