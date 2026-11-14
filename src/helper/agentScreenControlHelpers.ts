/**
 * The app side of `owa_screen_edit`: the screens' own controls, the ones a
 * Mini Screen card and the Bible text panel hold, read and changed for the
 * help window's assistant (2026-11-13, the user: _chatbot is very smart to
 * help user control screen_ -- the size, colour or style of the Bible
 * showing, another version added to it, a transition, the display checked,
 * screens grouped, _everything in screen control_).
 *
 * Measured first through the help window on a scratch profile
 * (`references/screen-asks.json`, 27 asks): not one of the 23 asks to change
 * something was done; every one was answered with the panel's steps, nine of
 * them wrong. This does what each control does, the way it does it:
 *
 * - the Bible text style (one for every screen): `applyTextStyle`, the patch
 *   the panel's own controls write (`genScreenStylePatch`, pure);
 * - a passage's versions: the card's version menu -- Shift+click adds one
 *   after those there, Remove takes one off (`planScreenBibleKeys`);
 * - Line Sync, a layer's transition, the stage, the display, the tick
 *   (Select / Solo), the lock (its group with it), the colour note that
 *   groups screens, show / hide, and the Clear buttons;
 *
 * and every change is backed up: the screens' controls and layers are read
 * before and after, and what differs joins the backup (`screen-setting`,
 * `screen-text`, `screen-layer`, `screen-foreground` restores), so the
 * answer's `undoId` -- the help window's **Undo this change** -- puts back
 * exactly what the change did, whatever its setters did beside it (a stage
 * above 0 sets the slide transition to none; a screen joining a group takes
 * the group's content and lock).
 *
 * Everything asked is checked before anything changes: one wrong field
 * refuses the call whole, so a refusal never leaves half a change on a
 * congregation's screen. Imported lazily by `domHelpers.ts`: it pulls in the
 * screen managers.
 */
import ScreenLongTextManager from '../_screen/managers/ScreenLongTextManager';
import type ScreenManager from '../_screen/managers/ScreenManager';
import {
    findFreeScreenId,
    genNewScreenManagerBase,
} from '../_screen/managers/screenManagerHelpers';
import { getAllDisplays } from '../_screen/managers/screenHelpers';
import {
    toBibleTextStyleView,
    type BibleTextStyleViewType,
} from '../_screen/bibleTextStyleHelpers';
import { bibleItemJsonToScreenViewData } from '../_screen/screenBibleHelpers';
import {
    checkIsLongTextData,
    getBibleItemData,
} from '../_screen/screenLongTextTypeHelpers';
import type { BibleItemType } from '../bible-list/bibleItemHelpers';
import { BIBLE_TEXT_LOOK_ID_LIST } from '../screen-setting/bibleTextLookHelpers';
import { isVirtualDisplayId } from '../../electron/virtualDisplayProtocol';
import appProvider from '../server/appProvider';
import { getAllLocalBibleInfoList } from './bible-helpers/bibleDownloadHelpers';
import {
    type AgentScreenSummaryType,
    describeScreensForAgent,
} from './agentScreenHelpers';
import type { AgentResultType } from './agentBackupHelpers';
import {
    type AgentRestoreType,
    diffForegroundSlots,
    diffScreenLayers,
    diffScreenSettings,
    diffTextLayers,
    genAddedScreenRestores,
} from './agentBackupPlanHelpers';
import { MAX_AGENT_SCREEN_COUNT } from './agentScreenLimitHelpers';
import {
    captureScreenControls,
    captureScreenLayers,
    listLiveScreenManagers,
    toEffectManager,
} from './agentScreenControlRestoreHelpers';
import {
    captureForegroundLists,
    captureTextLayers,
} from './agentScreenRestoreHelpers';
import {
    SCREEN_GROUP_COLOR_LIST,
    SCREEN_TRANSITION_TARGET_MAP,
    type ScreenBibleInfoType,
    type ScreenDisplayInfoType,
    type ScreenRefusalType,
    type ScreenStyleArgsType,
    type ScreenTransitionLayerType,
    checkIsScreenRefusal,
    describeScreenStyle,
    findScreenBibles,
    findScreenDisplay,
    genScreenStylePatch,
    pickScreenGroupColor,
    planScreenBibleKeys,
    toScreenGroupName,
    toScreenTransition,
} from './agentScreenControlRules';
import { resolveCssColor } from './cssColorResolveHelpers';
import { handleError } from './errorHelpers';

export type AgentScreenEditRequestType = {
    action?: unknown;
    screens?: unknown;
    style?: unknown;
    versions?: unknown;
    lineSync?: unknown;
    transition?: unknown;
    display?: unknown;
    group?: unknown;
    lock?: unknown;
    select?: unknown;
    stage?: unknown;
    show?: unknown;
    clear?: unknown;
    newScreen?: unknown;
};

/** What `set` may change; a test holds the MCP tool's schema to it. */
export const AGENT_SCREEN_EDIT_FIELD_LIST = [
    'style',
    'versions',
    'lineSync',
    'transition',
    'display',
    'group',
    'lock',
    'select',
    'stage',
    'show',
    'clear',
    'newScreen',
] as const;

// The most screens the assistant adds to (EC-630), a leaf the help
// window's offer reads too.
export { MAX_AGENT_SCREEN_COUNT };

export const AGENT_SCREEN_SELECT_LIST = ['only', 'add', 'remove', 'all'];
export const AGENT_SCREEN_CLEAR_LIST = [
    'bible',
    'slide',
    'background',
    'foreground',
    'all',
];
// The card's stage menu offers 0..9 and an Increment with no end.
const MAX_STAGE = 99;
// Long enough for what a setter starts and does not wait for -- a group's
// content synced from another member, a screen window shown -- to land
// before the screens are read again.
const SETTLE_MILLISECONDS = 400;

function toReason(reason: string): ScreenRefusalType {
    return { reason };
}

function fail(reason: string): AgentResultType {
    return { isError: true, reason };
}

function sleep(milliseconds: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

function joinIds(ids: number[]) {
    return ids.length <= 1
        ? ids.join('')
        : `${ids.slice(0, -1).join(', ')} and ${ids.at(-1)}`;
}

function toScreenWord(ids: number[]) {
    return `${ids.length === 1 ? 'screen' : 'screens'} ${joinIds(ids)}`;
}

// --- what the screens are -----------------------------------------------

function toDisplayName(
    display: { id: number; label?: unknown; guestId?: unknown },
    isPrimary: boolean,
) {
    const label = typeof display.label === 'string' ? display.label.trim() : '';
    if (label !== '') {
        return label;
    }
    if (isPrimary) {
        return 'Primary display';
    }
    return display.guestId ? 'Guest display' : `Display ${display.id}`;
}

/** Every display a screen can be put on, as the card's display menu names it. */
function listDisplays(): ScreenDisplayInfoType[] {
    try {
        const { primaryDisplay, displays } = getAllDisplays();
        return displays.map((display) => {
            const isPrimary =
                display.id === primaryDisplay.id ||
                (display as { isPrimary?: boolean }).isPrimary === true;
            return {
                id: display.id,
                name: toDisplayName(display, isPrimary),
                isVirtual: isVirtualDisplayId(display.id),
                isPrimary,
                width: display.bounds.width,
                height: display.bounds.height,
            };
        });
    } catch (error) {
        handleError(error);
        return [];
    }
}

function toEnglishLanguage(names: Intl.DisplayNames | null, locale: string) {
    const base = locale.split(/[-_]/)[0] ?? '';
    if (base === '' || names === null) {
        return base;
    }
    try {
        return names.of(base) ?? base;
    } catch {
        return base;
    }
}

/** The installed Bibles, each with its language's English name. */
async function listBibles(): Promise<ScreenBibleInfoType[]> {
    const infoList = (await getAllLocalBibleInfoList()) ?? [];
    let names: Intl.DisplayNames | null = null;
    try {
        names = new Intl.DisplayNames(['en'], { type: 'language' });
    } catch {
        // No language names in this runtime: the code alone is said.
    }
    return infoList.map((info) => {
        const locale = String(info.locale ?? '');
        return {
            key: info.key,
            title: info.title,
            locale,
            language: toEnglishLanguage(names, locale),
        };
    });
}

type PassageType = {
    bibleItemJson: BibleItemType;
    keys: string[];
    shownChapterCount?: number;
};

function readPassage(screenManager: ScreenManager): PassageType | null {
    const viewData = screenManager.screenLongTextManager.screenViewData;
    if (viewData === null || checkIsLongTextData(viewData)) {
        return null;
    }
    const bibleItemData = getBibleItemData(viewData);
    if (bibleItemData?.bibleItem === undefined) {
        return null;
    }
    const keys = (bibleItemData.renderedList ?? []).map((item) => {
        return item.bibleKey;
    });
    return {
        bibleItemJson: bibleItemData.bibleItem,
        keys: keys.length > 0 ? keys : [bibleItemData.bibleItem.bibleKey],
        shownChapterCount: viewData.shownChapterCount,
    };
}

function toTransitionWords(screenManager: ScreenManager) {
    const transitions: Partial<Record<ScreenTransitionLayerType, string>> = {};
    for (const [layer, target] of Object.entries(
        SCREEN_TRANSITION_TARGET_MAP,
    )) {
        transitions[layer as ScreenTransitionLayerType] =
            toEffectManager(screenManager, target)?.effectType ?? 'fade';
    }
    return transitions;
}

/** One screen as its card shows it, and what is on it. */
function toScreenState(
    screenManager: ScreenManager,
    allManagers: ScreenManager[],
    displays: ScreenDisplayInfoType[],
    content: AgentScreenSummaryType | null,
) {
    const colorNote = screenManager.colorNote ?? null;
    const groupWith =
        colorNote === null
            ? []
            : allManagers
                  .filter((other) => {
                      return (
                          other.screenId !== screenManager.screenId &&
                          other.colorNote === colorNote
                      );
                  })
                  .map((other) => {
                      return other.screenId;
                  });
    let displayId: number | null = null;
    try {
        displayId = screenManager.displayId;
    } catch {
        // Not known in this window.
    }
    const display = displays.find((one) => {
        return one.id === displayId;
    });
    const passage = readPassage(screenManager);
    return {
        id: screenManager.screenId,
        on: screenManager.isShowing,
        ticked: screenManager.isSelected,
        locked: screenManager.isLocked,
        group: toScreenGroupName(colorNote),
        ...(groupWith.length > 0 ? { groupWith } : {}),
        stage: screenManager.stage,
        display:
            display === undefined
                ? displayId === null
                    ? null
                    : `display ${displayId}, not connected`
                : `${display.name} (id ${display.id}` +
                  `${display.isVirtual ? ', virtual: on no monitor here' : ''})`,
        transition: toTransitionWords(screenManager),
        lineSync: screenManager.screenLongTextManager.isLineSync,
        bible:
            passage === null
                ? null
                : {
                      reference: content?.bible?.reference ?? '',
                      versions: passage.keys,
                  },
        ...(content?.slide
            ? {
                  slide:
                      `${content.slide.kind} "${content.slide.document}"` +
                      (content.slide.name ? `, ${content.slide.name}` : ''),
              }
            : {}),
        ...(content?.background
            ? {
                  background:
                      `${content.background.kind}` +
                      (content.background.name
                          ? ` ${content.background.name}`
                          : ''),
              }
            : {}),
        ...(content !== null && content.foreground.length > 0
            ? { foreground: content.foreground }
            : {}),
    };
}

function describeAllScreens(displays: ScreenDisplayInfoType[]) {
    const allManagers = listLiveScreenManagers();
    const contentList = describeScreensForAgent().screens;
    return allManagers.map((screenManager) => {
        return toScreenState(
            screenManager,
            allManagers,
            displays,
            contentList.find((content) => {
                return content.screenId === screenManager.screenId;
            }) ?? null,
        );
    });
}

function readStyleView(): BibleTextStyleViewType {
    return toBibleTextStyleView(ScreenLongTextManager.textStyle);
}

async function readScreens(): Promise<AgentResultType> {
    const displays = listDisplays();
    const bibles = await listBibles();
    return {
        screens: describeAllScreens(displays),
        bibleStyle: describeScreenStyle(readStyleView()),
        displays: displays.map((display) => {
            return {
                id: display.id,
                name: display.name,
                size: `${display.width}x${display.height}`,
                ...(display.isPrimary ? { primary: true } : {}),
                ...(display.isVirtual ? { virtual: true } : {}),
            };
        }),
        bibles: bibles.map((bible) => {
            return `${bible.key}: ${bible.title} (${bible.language || '?'})`;
        }),
        looks: BIBLE_TEXT_LOOK_ID_LIST,
        groupColors: SCREEN_GROUP_COLOR_LIST.map(([name]) => {
            return name;
        }),
        note:
            'The Bible text style is one for every screen. A virtual ' +
            'display shows on no monitor here: it is watched at its ' +
            "address. 'group' is the card's colour note: grouped screens " +
            'show the same thing.',
    };
}

// --- the plan: every field read and checked before anything changes ------

type PlanStepType = {
    said: string;
    run: () => Promise<void> | void;
};

type PlanType = {
    steps: PlanStepType[];
    already: string[];
    notes: string[];
    // Screens a step puts content on or takes it off: a locked one refuses.
    contentIds: Set<number>;
    unlockIds: Set<number>;
};

function readBooleanField(value: unknown, name: string) {
    if (value === true || value === false) {
        return value;
    }
    return toReason(`\`${name}\` is true or false.`);
}

function resolveTargets(
    request: AgentScreenEditRequestType,
    allManagers: ScreenManager[],
): ScreenManager[] | ScreenRefusalType {
    const choices = allManagers
        .map((screenManager) => {
            const states = [
                screenManager.isSelected ? 'ticked' : 'not ticked',
                screenManager.isShowing ? 'on' : 'OFF',
                ...(screenManager.isLocked ? ['locked'] : []),
            ];
            return `${screenManager.screenId} (${states.join(', ')})`;
        })
        .join(', ');
    if (allManagers.length === 0) {
        return toReason(
            'There is no screen. Add one first with `newScreen: true` alone ' +
                "in a call, as the Mini Screen panel's ⋮ menu does (Add New " +
                'Screen), then change it by its number.',
        );
    }
    if (request.screens === undefined) {
        const ticked = allManagers.filter((screenManager) => {
            return screenManager.isSelected;
        });
        return ticked.length > 0 ? ticked : allManagers;
    }
    const ids = Array.isArray(request.screens) ? request.screens : null;
    if (
        ids === null ||
        ids.length === 0 ||
        !ids.every((id) => {
            return Number.isInteger(id);
        })
    ) {
        return toReason(
            '`screens` is a list of screen numbers, or left out for the ' +
                `ticked ones. The screens: ${choices}.`,
        );
    }
    const targets: ScreenManager[] = [];
    for (const id of ids as number[]) {
        const screenManager = allManagers.find((one) => {
            return one.screenId === id;
        });
        if (screenManager === undefined) {
            return toReason(
                `There is no screen ${id}. The screens: ${choices}. Leave ` +
                    'screens out to use the ticked ones, or name one of ' +
                    'those numbers.',
            );
        }
        if (!targets.includes(screenManager)) {
            targets.push(screenManager);
        }
    }
    return targets;
}

function toIds(screenManagers: ScreenManager[]) {
    return screenManagers.map((screenManager) => {
        return screenManager.screenId;
    });
}

function planSelect(
    plan: PlanType,
    value: unknown,
    request: AgentScreenEditRequestType,
    targets: ScreenManager[],
    allManagers: ScreenManager[],
) {
    if (
        typeof value !== 'string' ||
        !AGENT_SCREEN_SELECT_LIST.includes(value)
    ) {
        return toReason(
            '`select` is "only" (those screens alone, the card\'s Solo), ' +
                '"add", "remove" or "all".',
        );
    }
    if (value !== 'all' && request.screens === undefined) {
        return toReason(`\`select: "${value}"\` needs \`screens\`.`);
    }
    const targetIds = new Set(toIds(targets));
    const wanted = new Map<ScreenManager, boolean>();
    for (const screenManager of allManagers) {
        const isTarget = targetIds.has(screenManager.screenId);
        const next =
            value === 'all'
                ? true
                : value === 'only'
                  ? isTarget
                  : value === 'add'
                    ? isTarget || screenManager.isSelected
                    : !isTarget && screenManager.isSelected;
        if (next !== screenManager.isSelected) {
            wanted.set(screenManager, next);
        }
    }
    const tickedIds = allManagers
        .filter((screenManager) => {
            return wanted.get(screenManager) ?? screenManager.isSelected;
        })
        .map((screenManager) => {
            return screenManager.screenId;
        });
    if (tickedIds.length === 0) {
        return toReason(
            'That would leave no screen ticked, and a passage or a slide ' +
                'then goes nowhere. Tick another one in the same call.',
        );
    }
    if (wanted.size === 0) {
        plan.already.push(`${toScreenWord(tickedIds)} already ticked`);
        return null;
    }
    plan.steps.push({
        said: `${toScreenWord(tickedIds)} ticked (what is put up goes there)`,
        run: () => {
            for (const [screenManager, isSelected] of wanted) {
                screenManager.isSelected = isSelected;
            }
        },
    });
    return null;
}

function planGroup(
    plan: PlanType,
    value: unknown,
    targets: ScreenManager[],
    allManagers: ScreenManager[],
) {
    if (value === false) {
        const grouped = targets.filter((screenManager) => {
            return screenManager.colorNote !== null;
        });
        if (grouped.length === 0) {
            plan.already.push(`${toScreenWord(toIds(targets))} in no group`);
            return null;
        }
        plan.steps.push({
            said: `${toScreenWord(toIds(grouped))} out of its group`,
            run: async () => {
                for (const screenManager of grouped) {
                    await screenManager.setColorNote(null);
                }
            },
        });
        return null;
    }
    if (value !== true && typeof value !== 'string') {
        return toReason(
            '`group` is true (the screens named, together), a colour ' +
                `(${SCREEN_GROUP_COLOR_LIST.map(([name]) => name).join(', ')}) ` +
                'or false (out of its group).',
        );
    }
    const usedColors = allManagers.map((screenManager) => {
        return screenManager.colorNote;
    });
    const ownColor =
        value === true
            ? (targets.find((screenManager) => {
                  return screenManager.colorNote !== null;
              })?.colorNote ?? null)
            : null;
    const picked =
        ownColor !== null
            ? { name: toScreenGroupName(ownColor) ?? ownColor, color: ownColor }
            : pickScreenGroupColor(
                  value === true ? undefined : value,
                  usedColors,
              );
    if (checkIsScreenRefusal(picked)) {
        return picked;
    }
    const members = allManagers.filter((screenManager) => {
        return screenManager.colorNote === picked.color;
    });
    const joining = targets.filter((screenManager) => {
        return screenManager.colorNote !== picked.color;
    });
    if (value === true && members.length + joining.length < 2) {
        return toReason(
            'A group is two screens at least: name them, as ' +
                '`screens: [0, 1]`, or name the colour of a group to join.',
        );
    }
    if (joining.length === 0) {
        plan.already.push(
            `${toScreenWord(toIds(targets))} already in the ${picked.name} group`,
        );
        return null;
    }
    // The first to take the colour keeps what it shows; each one after it
    // takes the group's, as the card's colour note does.
    const keeperId = members[0]?.screenId ?? joining[0].screenId;
    const takers = joining.filter((screenManager) => {
        return screenManager.screenId !== keeperId;
    });
    plan.steps.push({
        said:
            `${toScreenWord(toIds(joining))} in the ${picked.name} group` +
            (members.length > 0 ? ` with ${toScreenWord(toIds(members))}` : ''),
        run: async () => {
            for (const screenManager of joining) {
                await screenManager.setColorNote(picked.color);
            }
        },
    });
    if (takers.length > 0) {
        plan.notes.push(
            `${toScreenWord(toIds(takers))} now ${
                takers.length === 1 ? 'shows' : 'show'
            } what screen ${keeperId} shows: grouped screens show the same ` +
                'thing, and what is put on one goes on all of them.',
        );
        for (const screenManager of takers) {
            plan.contentIds.add(screenManager.screenId);
        }
    }
    return null;
}

function planLock(plan: PlanType, value: unknown, targets: ScreenManager[]) {
    const isLocked = readBooleanField(value, 'lock');
    if (checkIsScreenRefusal(isLocked)) {
        return isLocked;
    }
    const changing = targets.filter((screenManager) => {
        return screenManager.isLocked !== isLocked;
    });
    if (changing.length === 0) {
        plan.already.push(
            `${toScreenWord(toIds(targets))} already ${isLocked ? 'locked' : 'unlocked'}`,
        );
        return null;
    }
    if (!isLocked) {
        for (const screenManager of changing) {
            plan.unlockIds.add(screenManager.screenId);
        }
    }
    const step: PlanStepType = {
        said:
            `${toScreenWord(toIds(changing))} ${isLocked ? 'locked' : 'unlocked'}` +
            (isLocked ? ' (with any screen grouped with it)' : ''),
        run: async () => {
            for (const screenManager of changing) {
                await screenManager.setIsLockedWithSyncGroup(isLocked);
            }
        },
    };
    // Unlocked first, so the rest of the call can change the screen;
    // locked last, once it has.
    if (isLocked) {
        plan.steps.push(step);
    } else {
        plan.steps.unshift(step);
    }
    return null;
}

function planStage(plan: PlanType, value: unknown, targets: ScreenManager[]) {
    if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > MAX_STAGE
    ) {
        return toReason(`\`stage\` is a whole number from 0 to ${MAX_STAGE}.`);
    }
    const changing = targets.filter((screenManager) => {
        return screenManager.stage !== value;
    });
    if (changing.length === 0) {
        plan.already.push(
            `${toScreenWord(toIds(targets))} already on stage ${value}`,
        );
        return null;
    }
    plan.steps.push({
        said: `${toScreenWord(toIds(changing))} on stage ${value}`,
        run: () => {
            for (const screenManager of changing) {
                screenManager.stage = value;
            }
        },
    });
    if (
        value > 0 &&
        changing.some((screenManager) => {
            return (
                screenManager.varyAppDocumentEffectManager.effectType !== 'none'
            );
        })
    ) {
        plan.notes.push(
            'A stage above 0 cuts between slides, so the slide transition ' +
                'was set to none, as the card does.',
        );
    }
    return null;
}

function planDisplay(plan: PlanType, value: unknown, targets: ScreenManager[]) {
    const displays = listDisplays();
    const display = findScreenDisplay(displays, value);
    if (checkIsScreenRefusal(display)) {
        return display;
    }
    const changing = targets.filter((screenManager) => {
        try {
            return screenManager.displayId !== display.id;
        } catch {
            return true;
        }
    });
    if (changing.length === 0) {
        plan.already.push(
            `${toScreenWord(toIds(targets))} already on ${display.name}`,
        );
        return null;
    }
    plan.steps.push({
        said:
            `${toScreenWord(toIds(changing))} on ${display.name}` +
            (display.isVirtual ? ' (virtual: on no monitor here)' : ''),
        run: () => {
            for (const screenManager of changing) {
                screenManager.displayId = display.id;
            }
        },
    });
    const sharing = listLiveScreenManagers().filter((screenManager) => {
        if (changing.includes(screenManager)) {
            return false;
        }
        try {
            return screenManager.displayId === display.id;
        } catch {
            return false;
        }
    });
    if (sharing.length > 0) {
        plan.notes.push(
            `${toScreenWord(toIds(sharing))} ${
                sharing.length === 1 ? 'is' : 'are'
            } on ${display.name} too: shown together, the last one shown is ` +
                'on top.',
        );
    }
    return null;
}

function planTransition(
    plan: PlanType,
    value: unknown,
    targets: ScreenManager[],
) {
    // A transition named with no layer is the slide's: "the transition" is
    // the one between slides, and the card's first.
    const asked: Partial<Record<ScreenTransitionLayerType, unknown>> =
        typeof value === 'string'
            ? { slide: value }
            : typeof value === 'object' && value !== null
              ? (value as Record<string, unknown>)
              : {};
    const layerList = Object.keys(asked) as ScreenTransitionLayerType[];
    if (
        layerList.length === 0 ||
        layerList.some((layer) => {
            return !(layer in SCREEN_TRANSITION_TARGET_MAP);
        })
    ) {
        return toReason(
            '`transition` is {slide, background, foreground}: each none, ' +
                'fade, move or zoom.',
        );
    }
    for (const layer of layerList) {
        const effect = toScreenTransition(asked[layer]);
        if (effect === null) {
            return toReason(
                `"${String(asked[layer])}" is not a transition: none, fade, ` +
                    'move or zoom.',
            );
        }
        const target = SCREEN_TRANSITION_TARGET_MAP[layer];
        const changing = targets.filter((screenManager) => {
            return (
                toEffectManager(screenManager, target)?.effectType !== effect
            );
        });
        if (changing.length === 0) {
            plan.already.push(
                `the ${layer} transition of ${toScreenWord(toIds(targets))} already ${effect}`,
            );
            continue;
        }
        plan.steps.push({
            said: `the ${layer} transition of ${toScreenWord(toIds(changing))} ${effect}`,
            run: () => {
                for (const screenManager of changing) {
                    const effectManager = toEffectManager(
                        screenManager,
                        target,
                    );
                    if (effectManager !== null) {
                        effectManager.effectType = effect;
                    }
                }
            },
        });
    }
    return null;
}

function planLineSync(
    plan: PlanType,
    value: unknown,
    targets: ScreenManager[],
) {
    const isLineSync = readBooleanField(value, 'lineSync');
    if (checkIsScreenRefusal(isLineSync)) {
        return isLineSync;
    }
    const changing = targets.filter((screenManager) => {
        return screenManager.screenLongTextManager.isLineSync !== isLineSync;
    });
    if (changing.length === 0) {
        plan.already.push(
            `Line Sync already ${isLineSync ? 'on' : 'off'} for ${toScreenWord(toIds(targets))}`,
        );
        return null;
    }
    for (const screenManager of changing) {
        plan.contentIds.add(screenManager.screenId);
    }
    plan.steps.push({
        said:
            `Line Sync turned ${isLineSync ? 'on' : 'off'} for ${toScreenWord(toIds(changing))}` +
            (isLineSync ? ' (the versions lined up verse by verse)' : ''),
        run: () => {
            for (const screenManager of changing) {
                screenManager.screenLongTextManager.isLineSync = isLineSync;
            }
        },
    });
    return null;
}

async function planVersions(
    plan: PlanType,
    value: unknown,
    targets: ScreenManager[],
) {
    const asked = (
        typeof value === 'object' && value !== null ? value : {}
    ) as {
        add?: unknown;
        remove?: unknown;
    };
    const toList = (list: unknown) => {
        return list === undefined ? [] : Array.isArray(list) ? list : [list];
    };
    const addList = toList(asked.add);
    const removeList = toList(asked.remove);
    if (addList.length === 0 && removeList.length === 0) {
        return toReason(
            '`versions` is {add: [Bibles]} and/or {remove: [Bibles]}, each ' +
                'a key ("KJV"), a title, or a language in English as the ' +
                'read names it.',
        );
    }
    const withPassage = targets
        .map((screenManager) => {
            return { screenManager, passage: readPassage(screenManager) };
        })
        .filter(
            (
                one,
            ): one is {
                screenManager: ScreenManager;
                passage: PassageType;
            } => {
                return one.passage !== null;
            },
        );
    if (withPassage.length === 0) {
        return toReason(
            `${toScreenWord(toIds(targets))} ${
                targets.length === 1 ? 'shows' : 'show'
            } no Bible passage. Put one up first (owa_present_bible), then ` +
                'add the version.',
        );
    }
    const bibles = await listBibles();
    const added = findScreenBibles(bibles, addList);
    if (checkIsScreenRefusal(added)) {
        return added;
    }
    // A version taken off is found among those on the screen first: it may
    // be a key no installed Bible has any more.
    const onScreenKeys = [
        ...new Set(
            withPassage.flatMap(({ passage }) => {
                return passage.keys;
            }),
        ),
    ];
    const removeKeys: string[] = [];
    for (const wanted of removeList) {
        const raw = String(wanted ?? '').trim();
        const onScreen = onScreenKeys.find((key) => {
            return key.toLowerCase() === raw.toLowerCase();
        });
        if (onScreen !== undefined) {
            removeKeys.push(onScreen);
            continue;
        }
        const found = findScreenBibles(bibles, [wanted]);
        if (checkIsScreenRefusal(found)) {
            return toReason(
                `${found.reason} On the screen: ${onScreenKeys.join(', ')}.`,
            );
        }
        removeKeys.push(found[0].key);
    }
    const changes: {
        screenManager: ScreenManager;
        passage: PassageType;
        keys: string[];
    }[] = [];
    for (const { screenManager, passage } of withPassage) {
        const keys = planScreenBibleKeys(
            passage.keys,
            added.map((bible) => {
                return bible.key;
            }),
            removeKeys.filter((key) => {
                return passage.keys.includes(key);
            }),
        );
        if (checkIsScreenRefusal(keys)) {
            return keys;
        }
        if (keys.join('\n') === passage.keys.join('\n')) {
            continue;
        }
        changes.push({ screenManager, passage, keys });
        plan.contentIds.add(screenManager.screenId);
    }
    if (
        removeKeys.length > 0 &&
        !withPassage.some(({ passage }) => {
            return removeKeys.some((key) => {
                return passage.keys.includes(key);
            });
        })
    ) {
        return toReason(
            `${removeKeys.join(', ')} is not on the screen; it shows ` +
                `${onScreenKeys.join(', ')}.`,
        );
    }
    if (changes.length === 0) {
        plan.already.push(`the passage already in ${onScreenKeys.join(' + ')}`);
        return null;
    }
    // Read before anything changes: a version that cannot draw the passage
    // refuses the call whole.
    const dataList: Awaited<
        ReturnType<typeof bibleItemJsonToScreenViewData>
    >[] = [];
    for (const change of changes) {
        dataList.push(
            await bibleItemJsonToScreenViewData(
                change.passage.bibleItemJson,
                change.keys,
                change.passage.shownChapterCount,
            ),
        );
    }
    plan.steps.push({
        said: changes
            .map((change) => {
                return `${toScreenWord([change.screenManager.screenId])} in ${change.keys.join(' + ')}`;
            })
            .join('; '),
        run: () => {
            changes.forEach((change, index) => {
                // The card's own write: its version menu sets the layer so.
                change.screenManager.screenLongTextManager.screenViewData =
                    dataList[index];
            });
        },
    });
    if (
        changes.some((change) => {
            return change.keys.length > 1;
        })
    ) {
        plan.notes.push(
            'Side by side, each version keeps its own lines; Line Sync ' +
                '(lineSync: true) lines them up verse by verse.',
        );
    }
    return null;
}

function planClear(plan: PlanType, value: unknown, targets: ScreenManager[]) {
    if (typeof value !== 'string' || !AGENT_SCREEN_CLEAR_LIST.includes(value)) {
        return toReason(
            '`clear` is "bible" (the passage, or a Long Text Show in its ' +
                'place), "slide", "background", "foreground" or "all".',
        );
    }
    const isAll = value === 'all';
    const holding = targets.filter((screenManager) => {
        return (
            ((isAll || value === 'bible') &&
                screenManager.screenLongTextManager.isShowing) ||
            ((isAll || value === 'slide') &&
                screenManager.screenVaryAppDocumentManager.varySlideData !==
                    null) ||
            ((isAll || value === 'background') &&
                screenManager.screenBackgroundManager.backgroundSrc !== null) ||
            ((isAll || value === 'foreground') &&
                screenManager.isShowingForeground)
        );
    });
    if (holding.length === 0) {
        plan.already.push(
            `${toScreenWord(toIds(targets))} already holding no ${isAll ? 'content' : value}`,
        );
        return null;
    }
    for (const screenManager of holding) {
        plan.contentIds.add(screenManager.screenId);
    }
    plan.steps.push({
        said: `${isAll ? 'everything' : `the ${value}`} off ${toScreenWord(toIds(holding))}`,
        run: () => {
            for (const screenManager of holding) {
                if (isAll || value === 'bible') {
                    if (screenManager.screenLongTextManager.isShowing) {
                        screenManager.screenLongTextManager.clear();
                    }
                }
                if (isAll || value === 'slide') {
                    screenManager.screenVaryAppDocumentManager.clear();
                }
                if (isAll || value === 'background') {
                    screenManager.screenBackgroundManager.clear();
                }
                if (isAll || value === 'foreground') {
                    screenManager.clearForeground();
                }
            }
        },
    });
    return null;
}

function planStyle(plan: PlanType, value: unknown) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return toReason(
            '`style` is an object: size, color, bold, italic, shadow, ' +
                'outline, outlineColor, glow, glowColor, look, align, ' +
                'lineHeight, letterSpacing, font, backdrop, highlight, reset.',
        );
    }
    const view = readStyleView();
    const patchPlan = genScreenStylePatch(
        view,
        value as ScreenStyleArgsType,
        resolveCssColor,
    );
    if (checkIsScreenRefusal(patchPlan)) {
        return patchPlan;
    }
    const current = ScreenLongTextManager.textStyle;
    const next = JSON.parse(JSON.stringify({ ...current, ...patchPlan.patch }));
    if (
        JSON.stringify(next) ===
        JSON.stringify(JSON.parse(JSON.stringify(current)))
    ) {
        plan.already.push(
            `the Bible text already so (${describeScreenStyle(view)})`,
        );
        return null;
    }
    plan.steps.push({
        said: `the Bible text on every screen: ${patchPlan.said.join(', ')}`,
        run: () => {
            ScreenLongTextManager.applyTextStyle(patchPlan.patch);
        },
    });
    return null;
}

function planShow(plan: PlanType, value: unknown, targets: ScreenManager[]) {
    const isShowing = readBooleanField(value, 'show');
    if (checkIsScreenRefusal(isShowing)) {
        return isShowing;
    }
    const changing = targets.filter((screenManager) => {
        return screenManager.isShowing !== isShowing;
    });
    if (changing.length === 0) {
        plan.already.push(
            `${toScreenWord(toIds(targets))} already ${isShowing ? 'on' : 'off'}`,
        );
        return null;
    }
    plan.steps.push({
        said: `${toScreenWord(toIds(changing))} turned ${isShowing ? 'on' : 'off'}`,
        run: () => {
            for (const screenManager of changing) {
                screenManager.isShowing = isShowing;
            }
        },
    });
    return null;
}

/**
 * Every field of a `set`, read and checked: the steps to run, in the order
 * that keeps each one possible -- an unlock first, the tick, the group, the
 * stage before a transition, what the screens show, the style, on or off,
 * and a lock last -- or the first reason one cannot be done.
 */
async function genPlan(
    request: AgentScreenEditRequestType,
): Promise<PlanType | ScreenRefusalType> {
    const allManagers = listLiveScreenManagers();
    const targets = resolveTargets(request, allManagers);
    if (checkIsScreenRefusal(targets)) {
        return targets;
    }
    const plan: PlanType = {
        steps: [],
        already: [],
        notes: [],
        contentIds: new Set(),
        unlockIds: new Set(),
    };
    const asked = AGENT_SCREEN_EDIT_FIELD_LIST.filter((field) => {
        return request[field] !== undefined;
    });
    if (asked.length === 0) {
        return toReason(
            '`set` changed nothing: give at least one of ' +
                `${AGENT_SCREEN_EDIT_FIELD_LIST.join(', ')}.`,
        );
    }
    const runList: (() =>
        Promise<ScreenRefusalType | null> | ScreenRefusalType | null)[] = [
        () => {
            return request.select === undefined
                ? null
                : planSelect(
                      plan,
                      request.select,
                      request,
                      targets,
                      allManagers,
                  );
        },
        () => {
            return request.group === undefined
                ? null
                : planGroup(plan, request.group, targets, allManagers);
        },
        () => {
            return request.stage === undefined
                ? null
                : planStage(plan, request.stage, targets);
        },
        () => {
            return request.display === undefined
                ? null
                : planDisplay(plan, request.display, targets);
        },
        () => {
            return request.transition === undefined
                ? null
                : planTransition(plan, request.transition, targets);
        },
        () => {
            return request.lineSync === undefined
                ? null
                : planLineSync(plan, request.lineSync, targets);
        },
        () => {
            return request.versions === undefined
                ? null
                : planVersions(plan, request.versions, targets);
        },
        () => {
            return request.clear === undefined
                ? null
                : planClear(plan, request.clear, targets);
        },
        () => {
            return request.style === undefined
                ? null
                : planStyle(plan, request.style);
        },
        () => {
            return request.show === undefined
                ? null
                : planShow(plan, request.show, targets);
        },
        () => {
            return request.lock === undefined
                ? null
                : planLock(plan, request.lock, targets);
        },
    ];
    for (const run of runList) {
        const refusal = await run();
        if (refusal !== null) {
            return refusal;
        }
    }
    // A locked screen refuses what goes onto it or comes off it; the call
    // that unlocks it first may change it.
    const lockedIds = allManagers
        .filter((screenManager) => {
            return (
                screenManager.isLocked &&
                plan.contentIds.has(screenManager.screenId) &&
                !plan.unlockIds.has(screenManager.screenId)
            );
        })
        .map((screenManager) => {
            return screenManager.screenId;
        });
    if (lockedIds.length > 0) {
        return toReason(
            `${toScreenWord(lockedIds)} ${
                lockedIds.length === 1 ? 'is' : 'are'
            } locked, so ${
                lockedIds.length === 1 ? 'it refuses' : 'they refuse'
            } a change to what ${
                lockedIds.length === 1 ? 'it shows' : 'they show'
            }. Ask whether to unlock (lock: false in the same call); the ` +
                'lock is on its Mini Screen card. Nothing was changed.',
        );
    }
    return plan;
}

// --- the change, backed up ------------------------------------------------

type CapturedType = {
    controls: ReturnType<typeof captureScreenControls>;
    layers: ReturnType<typeof captureScreenLayers>;
    texts: ReturnType<typeof captureTextLayers>;
    foreground: Map<string, ReturnType<typeof captureForegroundLists>>;
};

function listForegroundKeys() {
    const keySet = new Set<string>();
    for (const screenManager of listLiveScreenManagers()) {
        for (const key of Object.keys(
            screenManager.screenForegroundManager.foregroundData,
        )) {
            keySet.add(key);
        }
    }
    return [...keySet];
}

function captureEverything(): CapturedType {
    const foreground = new Map<
        string,
        ReturnType<typeof captureForegroundLists>
    >();
    for (const key of listForegroundKeys()) {
        foreground.set(
            key,
            captureForegroundLists(
                key as Parameters<typeof captureForegroundLists>[0],
            ),
        );
    }
    return {
        controls: captureScreenControls(),
        layers: captureScreenLayers(),
        texts: captureTextLayers(),
        foreground,
    };
}

/** What the change did to the screens, as the restores that undo it. */
function diffEverything(before: CapturedType): AgentRestoreType[] {
    const restoreList = [
        ...diffScreenSettings(before.controls, captureScreenControls()),
        ...diffTextLayers(before.texts, captureTextLayers()),
        ...diffScreenLayers(before.layers, captureScreenLayers()),
    ];
    for (const [key, beforeList] of before.foreground) {
        restoreList.push(
            ...diffForegroundSlots(
                key,
                beforeList,
                captureForegroundLists(
                    key as Parameters<typeof captureForegroundLists>[0],
                ),
            ),
        );
    }
    return restoreList;
}

function toSummary(plan: PlanType) {
    const said = plan.steps
        .map((step) => {
            return step.said;
        })
        .join('; ');
    const summary = `Changed the screens: ${said}`;
    return summary.length > 300 ? `${summary.slice(0, 297)}...` : summary;
}

// --- a screen added: the Mini Screen menu's Add New Screen ----------------

/**
 * `newScreen: true`: a screen added the way the Mini Screen menu's Add New
 * Screen adds one (`genNewScreenManagerBase`) -- off, not ticked, in no
 * group, so nothing put up reaches it until it is ticked -- backed up as a
 * `screen-presence` restore, so its undo takes it away again while it is
 * still off and empty. A call of its own: the screen's number is known only
 * once it is there, and every other field is checked against the screens
 * as they are before anything changes.
 */
async function addNewScreen(
    request: AgentScreenEditRequestType,
): Promise<AgentResultType> {
    if (request.newScreen !== true) {
        return fail('`newScreen` is true, to add a screen.');
    }
    const otherFieldList = [
        ...(request.screens === undefined ? [] : ['screens']),
        ...AGENT_SCREEN_EDIT_FIELD_LIST.filter((field) => {
            return field !== 'newScreen' && request[field] !== undefined;
        }),
    ];
    if (otherFieldList.length > 0) {
        return fail(
            '`newScreen` is a call of its own, with no ' +
                `${otherFieldList.join(', ')}: add the screen, then change ` +
                'it in the next call by the number this one answers ' +
                '(`screens: [number]`). Nothing was changed.',
        );
    }
    const beforeIdList = toIds(listLiveScreenManagers());
    if (beforeIdList.length >= MAX_AGENT_SCREEN_COUNT) {
        return fail(
            `There are ${beforeIdList.length} screens already, the most ` +
                'the assistant adds to: a person adds another from the Mini ' +
                "Screen panel's ⋮ menu (Add New Screen). Nothing was changed.",
        );
    }
    const { runWithAgentBackup, appendAgentBackupRestores, genUndoField } =
        await import('./agentBackupHelpers');
    const { meta } = await runWithAgentBackup(
        `Added screen ${findFreeScreenId()}`,
        [],
        async () => {
            genNewScreenManagerBase();
            await sleep(SETTLE_MILLISECONDS);
        },
    );
    const afterIdList = toIds(listLiveScreenManagers());
    const restoreList = genAddedScreenRestores(beforeIdList, afterIdList);
    const addedIdList = restoreList.map((restore) => {
        return restore.screenId;
    });
    if (addedIdList.length === 0) {
        return fail(
            'No screen was added: the Mini Screen panel did not take one. ' +
                "Say so; a person adds one from the panel's ⋮ menu.",
        );
    }
    let isBackedUp = true;
    try {
        await appendAgentBackupRestores(meta.id, restoreList);
    } catch (error) {
        handleError(error);
        isBackedUp = false;
    }
    const addedId = addedIdList[0];
    const screens = describeAllScreens(listDisplays());
    const addedDisplay = screens.find((screen) => {
        return screen.id === addedId;
    })?.display;
    return {
        did: `added screen ${addedId}`,
        newScreen: addedId,
        screens,
        ...(isBackedUp ? genUndoField(meta) : {}),
        note:
            `Screen ${addedId} is new: off and not ticked, so nothing put ` +
            'up goes to it yet' +
            (typeof addedDisplay === 'string'
                ? `; it is on ${addedDisplay}`
                : '') +
            `. To use it, change it in the next call with screens: ` +
            `[${addedId}] -- tick it (select), move it to a display ` +
            '(display); turn it on (show) only when they ask.' +
            (isBackedUp
                ? ''
                : ' Done, but no Undo could be kept for it: say so; a ' +
                  "person removes it with Delete in its Mini Screen card's " +
                  'menu.'),
    };
}

async function setScreens(
    request: AgentScreenEditRequestType,
): Promise<AgentResultType> {
    if (request.newScreen !== undefined) {
        return await addNewScreen(request);
    }
    const plan = await genPlan(request);
    if (checkIsScreenRefusal(plan)) {
        return fail(plan.reason);
    }
    if (plan.steps.length === 0) {
        return {
            did: 'nothing: it is already so',
            already: plan.already,
            screens: describeAllScreens(listDisplays()),
        };
    }
    const { runWithAgentBackup, appendAgentBackupRestores, genUndoField } =
        await import('./agentBackupHelpers');
    const before = captureEverything();
    const failure: { at: string | null } = { at: null };
    const { meta } = await runWithAgentBackup(toSummary(plan), [], async () => {
        for (const step of plan.steps) {
            try {
                await step.run();
            } catch (error: any) {
                handleError(error);
                failure.at = `${step.said}: ${String(error?.message ?? error)}`;
                break;
            }
        }
        await sleep(SETTLE_MILLISECONDS);
    });
    let isBackedUp = true;
    try {
        await appendAgentBackupRestores(meta.id, diffEverything(before));
    } catch (error) {
        handleError(error);
        isBackedUp = false;
    }
    const result: AgentResultType = {
        did: plan.steps
            .map((step) => {
                return step.said;
            })
            .join('; '),
        ...(plan.already.length > 0 ? { already: plan.already } : {}),
        screens: describeAllScreens(listDisplays()),
        ...(plan.steps.some((step) => {
            return step.said.startsWith('the Bible text');
        })
            ? { bibleStyle: describeScreenStyle(readStyleView()) }
            : {}),
        ...(isBackedUp ? genUndoField(meta) : {}),
        ...(plan.notes.length > 0 ? { note: plan.notes.join(' ') } : {}),
    };
    if (failure.at !== null) {
        return {
            ...result,
            isError: true,
            reason:
                `Part of it could not be done (${failure.at}). What was done ` +
                (isBackedUp
                    ? `is undone with owa_undo id "${meta.id}".`
                    : 'is on the screens now.'),
        };
    }
    if (!isBackedUp) {
        result.note =
            `${result.note ?? ''} Done, but no Undo could be kept for it: ` +
            'say so, and how to change it back on the Mini Screen card.';
    }
    return result;
}

/**
 * One request from `owa_screen_edit`. Always answers with a plain object
 * and never throws: the caller is a page expression whose only channel back
 * is a DOM event.
 */
export async function handleAgentScreenEditRequest(
    request: AgentScreenEditRequestType,
): Promise<AgentResultType> {
    try {
        if (!appProvider.isPagePresenter) {
            return {
                needsPage: 'presenter',
                note:
                    'The screens are controlled from the Presenter page, and ' +
                    'the main window is not on it. Switch it there first ' +
                    '(owa_goto_page presenter), or tell the person to.',
                ...(request?.action === 'set'
                    ? {
                          isError: true,
                          reason: 'Nothing was changed: the main window is not on the Presenter page. Switch it there first (owa_goto_page presenter).',
                      }
                    : {}),
            };
        }
        if (request?.action === 'read') {
            return await readScreens();
        }
        if (request?.action === 'set') {
            return await setScreens(request);
        }
        return fail('`action` is "read" or "set".');
    } catch (error: any) {
        handleError(error);
        const { NoBackupError } = await import('./agentBackupHelpers');
        if (error instanceof NoBackupError) {
            return fail(error.message);
        }
        return fail(String(error?.message ?? error));
    }
}
