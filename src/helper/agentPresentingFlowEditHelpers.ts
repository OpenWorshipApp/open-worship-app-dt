/**
 * The app side of `owa_presenting_flow_edit`: one presenting flow -- the one
 * a person opened in the help window (**Open in Chatbot** on its row,
 * 2026-11-07) -- read whole and changed many lines at a time.
 *
 * `owa_presenting_flow` stays what an ordinary question uses: a sheet of the
 * Presenting Flows folder by its name, one line per call. This is the
 * conversation about ONE sheet, wherever it lives (`filePath`, the window's
 * attached file), and what such a conversation needs:
 *
 * - `lines` reads every line WHOLE -- what it is, what it points at, how it
 *   is armed, its colour, its screens, what rides along with it, and what is
 *   wrong with it (`problems`) -- plus the actions there are, the foreground
 *   widgets, the Documents names and the screens, so no call has to fail to
 *   learn them. A document's slides are read only for a line asked about
 *   (`line`) or one with slide-level settings: never every document.
 * - `update-lines` applies MANY changes in ONE write and ONE backup
 *   (`agentFlowEditRules.ts`); a refusal anywhere refuses the lot, before the
 *   backup is taken.
 * - `remove-lines` takes lines out, one call and one undo -- a removal, so
 *   the firewall's removal budget and the chatbot's one-removal-an-answer
 *   both count it.
 *
 * A presenting flow has no Save: every change is the file, at once. The
 * backup is its whole undo.
 */
import { DragTypeEnum } from './DragInf';
import { handleError } from './errorHelpers';
import {
    fsCheckFileExist,
    fsListFilesWithMimetype,
    getMimetypeExtensions,
} from '../server/fileHelpers';
import {
    AGENT_DOCUMENT_MIMETYPE_NAMES,
    type AgentResultType,
    NoBackupError,
    genUndoField,
    runWithAgentBackup,
    snapshotAgentEditing,
} from './agentBackupHelpers';
import {
    type AgentFlowPreparedType,
    applyAgentFlowChanges,
    applyAgentFlowRemoval,
    readAgentFlowChangeNeeds,
    toAgentFlowColorName,
} from './agentFlowEditRules';
import { AGENT_FLOW_FOREGROUND_FIELD_TEXT_LIST } from './agentFlowForegroundRules';
import {
    checkIsFlowFound,
    checkIsPlace,
    checkIsRefusal,
    findDocumentPath,
    findFlow,
    getPlace,
} from './agentPresentingFlowHelpers';
import type { PresentingFlowItemType } from '../presenting-flow/PresentingFlowItem';

export type AgentPresentingFlowEditRequestType = {
    action?: unknown;
    filePath?: unknown;
    name?: unknown;
    line?: unknown;
    changes?: unknown;
    lines?: unknown;
};

const LINE_LIMIT = 200;
const DOCUMENT_CHOICE_LIMIT = 60;
const SLIDE_LIST_LIMIT = 100;
const KIND = 'presentingFlow' as const;

// A whole path: a drive (`C:\` / `C:/`), a share (`\\server`) or a root.
const ABSOLUTE_PATH_PATTERN = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/;

function fail(reason: string): AgentResultType {
    return { isError: true, reason };
}

function toText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

async function getPresentingFlowClass() {
    // Lazily: the presenting-flow graph pulls the screen managers in, and
    // nothing here loads until an agent asks.
    const { default: PresentingFlow } =
        await import('../presenting-flow/PresentingFlow');
    return PresentingFlow;
}

async function getFileSourceClass() {
    const { default: FileSource } = await import('./FileSource');
    return FileSource;
}

type FlowTargetType = { filePath: string; name: string };

/**
 * The sheet a request names: the attached file by its whole path -- a whole
 * path, no `..`, a presenting flow's own extension, a file that is there --
 * or a sheet of the Presenting Flows folder by its name.
 */
async function resolveFlowTarget(
    request: AgentPresentingFlowEditRequestType,
): Promise<FlowTargetType | AgentResultType> {
    const extension = getMimetypeExtensions('presentingFlow')[0] ?? 'owpf';
    if (request.filePath !== undefined) {
        const filePath = toText(request.filePath);
        if (filePath === '' || !ABSOLUTE_PATH_PATTERN.test(filePath)) {
            return fail(
                'A presenting flow path must be the whole path to the file.',
            );
        }
        if (
            filePath.split(/[\\/]/).some((part) => {
                return part === '..';
            })
        ) {
            return fail(
                'A presenting flow path may not step out of its folder with ' +
                    '"..".',
            );
        }
        if (!filePath.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) {
            return fail(
                `Only a presenting flow file (.${extension}) can be read or ` +
                    'changed this way.',
            );
        }
        if (!(await fsCheckFileExist(filePath))) {
            return fail('There is no presenting flow file at that path.');
        }
        const FileSource = await getFileSourceClass();
        return { filePath, name: FileSource.getInstance(filePath).name };
    }
    const place = getPlace();
    if (!checkIsPlace(place)) {
        return place;
    }
    const found = await findFlow(place, request.name);
    if (!checkIsFlowFound(found)) {
        return found;
    }
    return { filePath: found.filePath, name: found.name };
}

function checkIsTarget(
    value: FlowTargetType | AgentResultType,
): value is FlowTargetType {
    return (value as AgentResultType).isError !== true;
}

/** The screens there are, by id -- what a pin may name. */
async function readScreenIdList() {
    try {
        const { getScreenManagersInstanceSetting } =
            await import('../_screen/managers/screenManagerBaseHelpers');
        return getScreenManagersInstanceSetting()
            .map((one) => {
                return one.screenId;
            })
            .sort((a, b) => {
                return a - b;
            });
    } catch (error) {
        handleError(error);
        return null;
    }
}

/** The names the Documents list shows, as many as a question can carry. */
async function readDocumentChoices() {
    try {
        const { default: DirSource } = await import('./DirSource');
        const { dirSourceSettingNames } = await import('./constants');
        const { getActiveDirSourceSettingName } =
            await import('../media-sessions/folderSessionHelpers');
        const dirPath = DirSource.getDirPathBySettingName(
            getActiveDirSourceSettingName(dirSourceSettingNames.APP_DOCUMENT),
        );
        if (dirPath === null) {
            return { documentChoices: [] as string[] };
        }
        const FileSource = await getFileSourceClass();
        const nameList: string[] = [];
        for (const mimetypeName of AGENT_DOCUMENT_MIMETYPE_NAMES) {
            const filePathList =
                (await fsListFilesWithMimetype(dirPath, mimetypeName)) ?? [];
            for (const filePath of filePathList) {
                nameList.push(FileSource.getInstance(filePath).name);
            }
        }
        const sorted = Array.from(new Set(nameList)).sort((a, b) => {
            return a.localeCompare(b);
        });
        return {
            documentChoices: sorted.slice(0, DOCUMENT_CHOICE_LIMIT),
            ...(sorted.length > DOCUMENT_CHOICE_LIMIT
                ? { isDocumentChoicesTruncated: true }
                : {}),
        };
    } catch (error) {
        handleError(error);
        return { documentChoices: [] as string[] };
    }
}

/** The actions there are, said once: id, name, what each is armed with. */
async function readActionTextList() {
    const { presentingFlowActionList } =
        await import('../presenting-flow/presentingFlowActionHelpers');
    const textList: string[] = [];
    let hasForegroundClear = false;
    for (const action of presentingFlowActionList) {
        if (action.id.startsWith('clear-foreground-')) {
            hasForegroundClear = true;
            continue;
        }
        const notes: string[] = [];
        if (action.target === 'run') {
            if (action.canBeKeyArmed) {
                notes.push('key (a shortcut)');
            } else if (action.number !== null) {
                notes.push(
                    action.canBeTimeArmed
                        ? 'seconds or time (HH:mm)'
                        : 'seconds',
                );
            }
            if (action.ccItemsAreTargets) {
                notes.push('target: the line it goes to');
            }
            if (action.canBeCcItem) {
                notes.push('can ride along with a line as a CC');
            }
        } else if (action.requiresScreenIds) {
            notes.push('screenIds required');
        }
        if (action.id === 'slide-media-control') {
            notes.length = 0;
            notes.push(
                'only as a CC of a slide or document, with mediaControl',
            );
        }
        textList.push(
            `${action.id}: ${action.label}` +
                (notes.length === 0 ? '' : ` (${notes.join('; ')})`),
        );
    }
    if (hasForegroundClear) {
        textList.push(
            'clear-foreground-<widget>: clears one foreground widget ' +
                '(countdown, stopwatch, time, message, marquee-top, …)',
        );
    }
    return textList;
}

/** What a line is, in one word or two. */
function toLineKind(item: any) {
    if (item.isError) {
        return 'invalid';
    }
    if (item.isAction) {
        return `action:${String(item.data)}`;
    }
    if (item.isForeground) {
        return `foreground:${String(item.data?.target ?? '')}`;
    }
    if (item.isAppDocument) {
        return 'document';
    }
    if (item.isBibleItem) {
        return 'passage';
    }
    if (item.isSlide) {
        return 'slide';
    }
    if (item.isAudio) {
        return 'audio';
    }
    if (item.isBackground) {
        return `background:${String(item.type).replace(/^bg-/, '')}`;
    }
    return String(item.type);
}

/** A document line's slides: their ids in order, read off the document. */
async function readSlideIdList(filePath: string) {
    try {
        const { loadVaryAppDocumentSlides } =
            await import('../presenting-flow/presentingFlowDocumentHelpers');
        const slides = await loadVaryAppDocumentSlides(filePath);
        return slides === null
            ? null
            : slides.map((slide: any) => {
                  return { id: slide.id as number, name: slide.name ?? '' };
              });
    } catch (error) {
        handleError(error);
        return null;
    }
}

function checkHasSlideSettings(json: PresentingFlowItemType) {
    return (
        (Array.isArray(json.disabledSlideIds) &&
            json.disabledSlideIds.length > 0) ||
        Object.keys(json.slideScreenIds ?? {}).length > 0 ||
        Object.keys(json.slideCcItems ?? {}).length > 0
    );
}

async function handleLines(target: FlowTargetType, focusLine: unknown) {
    const PresentingFlow = await getPresentingFlowClass();
    const items = await PresentingFlow.getInstance(target.filePath).getItems();
    if (items === null) {
        return fail(`The presenting flow "${target.name}" could not be read.`);
    }
    const FileSource = await getFileSourceClass();
    const uuidLineMap = new Map<string, number>();
    items.forEach((item, index) => {
        if (item.uuid !== null && !uuidLineMap.has(item.uuid)) {
            uuidLineMap.set(item.uuid, index + 1);
        }
    });
    // Which lines' CCs each line is the ELEMENT of: a Next: Timeout line
    // that CCs point at was taken by a model for a duplicate to remove
    // (seen live, gemma4:cloud), so the line itself says what uses it.
    const ccOfMap = new Map<string, number[]>();
    items.forEach((item, index) => {
        const json = item.toJson();
        const refList = [
            ...(Array.isArray(json.ccItems) ? json.ccItems : []),
            ...Object.values(json.slideCcItems ?? {}).flatMap((list) => {
                return Array.isArray(list) ? list : [];
            }),
        ];
        for (const ref of refList) {
            if (typeof ref?.uuid !== 'string') {
                continue;
            }
            const hostList = ccOfMap.get(ref.uuid) ?? [];
            if (!hostList.includes(index + 1)) {
                hostList.push(index + 1);
            }
            ccOfMap.set(ref.uuid, hostList);
        }
    });
    const keyCountMap = new Map<string, number>();
    for (const item of items) {
        const { actionKey } = item;
        if (item.isAction && actionKey !== null) {
            keyCountMap.set(actionKey, (keyCountMap.get(actionKey) ?? 0) + 1);
        }
    }
    const toCcList = (refList: unknown) => {
        return (Array.isArray(refList) ? refList : []).map(
            (ref: any, ccIndex: number) => {
                const line = uuidLineMap.get(ref?.uuid);
                const cc: Record<string, unknown> = {
                    n: ccIndex + 1,
                    follows: line ?? null,
                    title:
                        line === undefined
                            ? 'a line that is gone'
                            : items[line - 1].title,
                };
                if (Array.isArray(ref?.screenIds) && ref.screenIds.length > 0) {
                    cc.screenIds = ref.screenIds;
                }
                if (ref?.actionArming?.actionNumber !== undefined) {
                    cc.seconds = ref.actionArming.actionNumber;
                }
                if (ref?.actionArming?.actionTime !== undefined) {
                    cc.time = ref.actionArming.actionTime;
                }
                if (ref?.mediaControl !== undefined) {
                    cc.mediaControl = ref.mediaControl;
                }
                return cc;
            },
        );
    };
    const focus =
        Number.isInteger(focusLine) &&
        (focusLine as number) >= 1 &&
        (focusLine as number) <= items.length
            ? (focusLine as number)
            : null;
    const lines: Record<string, unknown>[] = [];
    for (const [index, item] of items.entries()) {
        if (index >= LINE_LIMIT) {
            break;
        }
        const n = index + 1;
        const json = item.toJson();
        const problems: string[] = [];
        const line: Record<string, unknown> = {
            n,
            title: item.title,
            kind: toLineKind(item),
        };
        if (item.isError) {
            problems.push('it could not be read -- remove it, or add it again');
        }
        if (item.isAppDocument || item.isSlide) {
            const filePath = item.itemFilePath;
            if (item.isAppDocument) {
                line.document = FileSource.getInstance(filePath).name;
            }
            if (filePath === '' || !(await fsCheckFileExist(filePath))) {
                problems.push(
                    'its file is missing -- it was renamed, moved or deleted',
                );
            }
        }
        if (item.isDisabled) {
            line.isParked = true;
        }
        const ccOf = item.uuid === null ? undefined : ccOfMap.get(item.uuid);
        if (ccOf !== undefined) {
            line.ccOf = ccOf;
        }
        const colorName = toAgentFlowColorName(item.colorNote);
        if (colorName !== null) {
            line.color = colorName;
        }
        if (item.screenIds.length > 0) {
            line.screenIds = item.screenIds;
        }
        const { runAction } = item;
        if (runAction !== null) {
            if (runAction.canBeKeyArmed) {
                if (item.actionKey === null) {
                    problems.push('it has no shortcut yet');
                } else {
                    line.key = item.actionKey;
                    if ((keyCountMap.get(item.actionKey) ?? 0) > 1) {
                        problems.push('its shortcut is used by another line');
                    }
                }
            } else if (runAction.number !== null) {
                if (item.actionTime !== null) {
                    line.time = item.actionTime;
                } else {
                    line.seconds = item.actionNumber;
                }
            }
            if (runAction.ccItemsAreTargets) {
                const goesTo = uuidLineMap.get(json.ccItems?.[0]?.uuid ?? '');
                if (goesTo === undefined) {
                    problems.push('it goes nowhere yet -- give it a target');
                } else {
                    line.goesTo = goesTo;
                }
            }
        }
        if (!runAction?.ccItemsAreTargets) {
            const ccList = toCcList(json.ccItems);
            if (ccList.length > 0) {
                line.cc = ccList;
                if (
                    ccList.some((cc) => {
                        return cc.follows === null;
                    })
                ) {
                    problems.push('a CC follows a line that is gone');
                }
            }
        }
        if (
            item.isAppDocument &&
            (focus === n || checkHasSlideSettings(json))
        ) {
            const slideList = await readSlideIdList(item.itemFilePath);
            if (slideList !== null) {
                const numberOf = (slideId: number | string) => {
                    const at = slideList.findIndex((slide) => {
                        return `${slide.id}` === `${slideId}`;
                    });
                    return at === -1 ? null : at + 1;
                };
                const slides: Record<string, unknown> = {
                    count: slideList.length,
                };
                const parked = (json.disabledSlideIds ?? [])
                    .map(numberOf)
                    .filter((one): one is number => {
                        return one !== null;
                    });
                if (parked.length > 0) {
                    slides.parked = parked;
                }
                const pinned = Object.entries(json.slideScreenIds ?? {})
                    .map(([slideId, screenIds]) => {
                        return { slide: numberOf(slideId), screenIds };
                    })
                    .filter((one) => {
                        return one.slide !== null;
                    });
                if (pinned.length > 0) {
                    slides.pinned = pinned;
                }
                const slideCc = Object.entries(json.slideCcItems ?? {})
                    .map(([slideId, refList]) => {
                        return {
                            slide: numberOf(slideId),
                            cc: toCcList(refList),
                        };
                    })
                    .filter((one) => {
                        return one.slide !== null && one.cc.length > 0;
                    });
                if (slideCc.length > 0) {
                    slides.cc = slideCc;
                }
                if (focus === n) {
                    slides.list = slideList
                        .slice(0, SLIDE_LIST_LIMIT)
                        .map((slide, slideIndex) => {
                            return slide.name === ''
                                ? `${slideIndex + 1}`
                                : `${slideIndex + 1}: ${slide.name}`;
                        });
                }
                line.slides = slides;
            }
        }
        if (problems.length > 0) {
            line.problems = problems;
        }
        lines.push(line);
    }
    return {
        name: target.name,
        count: items.length,
        lines,
        ...(items.length > LINE_LIMIT ? { isTruncated: true } : {}),
        screens: (await readScreenIdList()) ?? [],
        actions: await readActionTextList(),
        foregroundWidgets: AGENT_FLOW_FOREGROUND_FIELD_TEXT_LIST,
        ...(await readDocumentChoices()),
    };
}

class FlowRefusalError extends Error {}

/**
 * A batch refused is a batch that changed NOTHING, said so in as many words:
 * told only that one item could not be found, a model reported the rest of
 * the order as added (seen live, gemma4:cloud, an order of service naming a
 * song the Documents list does not have).
 */
function toBatchRefusal(reason: string) {
    return fail(
        `Nothing was changed -- the whole call was refused: ${reason} ` +
            'Leave that change out or fix it, then call again with the rest.',
    );
}

/** A line's json as a drop of a document or a passage would write it. */
async function prepareAddedItems(
    needs: Exclude<
        ReturnType<typeof readAgentFlowChangeNeeds>,
        { reason: string }
    >,
) {
    const { default: PresentingFlowItem } =
        await import('../presenting-flow/PresentingFlowItem');
    const map = new Map<number, PresentingFlowItemType>();
    for (const [index, documentName] of needs.documentMap) {
        const documentPath = await findDocumentPath(documentName);
        if (checkIsRefusal(documentPath)) {
            return fail(`Change ${index + 1}: ${documentPath.reason}`);
        }
        const itemJson = await PresentingFlowItem.fromDroppedData(
            {
                type: DragTypeEnum.APP_DOCUMENT,
                item: { filePath: documentPath },
            },
            { type: DragTypeEnum.APP_DOCUMENT, data: documentPath },
        );
        if (itemJson === null) {
            return fail(
                `Change ${index + 1}: "${documentName}" cannot be added.`,
            );
        }
        map.set(index, itemJson);
    }
    if (needs.referenceMap.size > 0) {
        const { MAX_REFERENCE_LENGTH, resolveBibleItem, resolveVersionOrder } =
            await import('./agentBibleHelpers');
        for (const [index, { reference, version }] of needs.referenceMap) {
            if (reference.length > MAX_REFERENCE_LENGTH) {
                return fail(
                    `Change ${index + 1}: that is longer than a reference -- ` +
                        'the book, chapter and verse only, such as "John 3:16".',
                );
            }
            const resolved = await resolveVersionOrder(version);
            if (!('order' in resolved)) {
                return fail(`Change ${index + 1}: ${resolved.reason}`);
            }
            const bibleItem = await resolveBibleItem(reference, resolved.order);
            if (bibleItem === null) {
                return fail(
                    `Change ${index + 1}: "${reference}" could not be read ` +
                        `as a passage in ${version ?? 'any installed version'}. ` +
                        "Write it as the version's full book name, chapter and " +
                        'verse -- "John 3:16", "Psalm 23:1-6".',
                );
            }
            const itemJson = await PresentingFlowItem.fromDroppedData(
                { type: DragTypeEnum.BIBLE_ITEM, item: bibleItem },
                bibleItem.dragSerialize(),
            );
            if (itemJson === null) {
                return fail(
                    `Change ${index + 1}: "${reference}" cannot be added.`,
                );
            }
            map.set(index, itemJson);
        }
    }
    return map;
}

function toChangeFailure(error: unknown, what: string) {
    if (error instanceof NoBackupError || error instanceof FlowRefusalError) {
        return fail(error.message);
    }
    handleError(error);
    return fail(
        `${what} could not be finished: ` +
            `${error instanceof Error ? error.message : String(error)} ` +
            'Anything it did get to do can be put back with owa_undo.',
    );
}

/**
 * The change, tried first on a copy -- a refusal costs no backup and writes
 * nothing -- then made for real under the sheet's lock, backed up once.
 */
async function writeChange(
    target: FlowTargetType,
    jsonList: PresentingFlowItemType[],
    apply: (
        itemJsonList: PresentingFlowItemType[],
    ) => { changed: string[] } | { reason: string },
) {
    const dryRun = apply(structuredClone(jsonList));
    if ('reason' in dryRun) {
        return toBatchRefusal(dryRun.reason);
    }
    const editing = await snapshotAgentEditing(KIND, target.filePath);
    if (editing === null) {
        return fail(
            `The presenting flow "${target.name}" could not be read, so it ` +
                'was not changed.',
        );
    }
    const summary = `Changed the presenting flow “${target.name}”`;
    try {
        const PresentingFlow = await getPresentingFlowClass();
        const flow = PresentingFlow.getInstance(target.filePath);
        let outcome: { changed: string[] } | { reason: string } | null = null;
        let count = 0;
        const { meta } = await runWithAgentBackup(
            summary,
            [editing],
            async () => {
                const isWritten = await flow.updateItemsJson((itemJsonList) => {
                    if (itemJsonList.length !== jsonList.length) {
                        outcome = {
                            reason:
                                'The presenting flow changed while it was being ' +
                                'changed -- read it again (`lines`) and try ' +
                                'once more.',
                        };
                        return false;
                    }
                    outcome = apply(itemJsonList);
                    count = itemJsonList.length;
                    return !('reason' in outcome);
                });
                if (outcome !== null && 'reason' in outcome) {
                    throw new FlowRefusalError(
                        (outcome as { reason: string }).reason,
                    );
                }
                if (!isWritten) {
                    throw new Error(
                        'the app could not write the presenting flow.',
                    );
                }
            },
        );
        const changed =
            (outcome as { changed: string[] } | null)?.changed ?? [];
        return {
            sheet: target.name,
            count,
            changed,
            didChange: true,
            note: 'Kept at once -- a presenting flow has no Save.',
            ...genUndoField(meta),
        };
    } catch (error) {
        return toChangeFailure(error, summary);
    }
}

async function handleUpdateLines(target: FlowTargetType, changes: unknown) {
    const PresentingFlow = await getPresentingFlowClass();
    const items = await PresentingFlow.getInstance(target.filePath).getItems();
    if (items === null) {
        return fail(`The presenting flow "${target.name}" could not be read.`);
    }
    const needs = readAgentFlowChangeNeeds(changes, items.length);
    if ('reason' in needs) {
        return toBatchRefusal(needs.reason);
    }
    const addedItemJsonMap = await prepareAddedItems(needs);
    if (checkIsRefusal(addedItemJsonMap)) {
        return toBatchRefusal(
            addedItemJsonMap.reason ?? 'what it adds could not be read.',
        );
    }
    const slideIdListMap = new Map<number, number[]>();
    for (const line of needs.slideLineSet) {
        const item = items[line - 1];
        if (item?.isAppDocument) {
            const slideList = await readSlideIdList(item.itemFilePath);
            if (slideList !== null) {
                slideIdListMap.set(
                    line,
                    slideList.map((slide) => {
                        return slide.id;
                    }),
                );
            }
        }
    }
    const { genPresentingFlowItemUuid } =
        await import('../presenting-flow/presentingFlowCcHelpers');
    const prepared: AgentFlowPreparedType = {
        titles: items.map((item) => {
            return item.title;
        }),
        addedItemJsonMap,
        slideIdListMap,
        screenIdList: await readScreenIdList(),
        genId: genPresentingFlowItemUuid,
    };
    const jsonList = items.map((item) => {
        return item.toJson();
    });
    return await writeChange(target, jsonList, (itemJsonList) => {
        return applyAgentFlowChanges(
            itemJsonList,
            changes as Record<string, any>[],
            prepared,
        );
    });
}

async function handleRemoveLines(target: FlowTargetType, lines: unknown) {
    const PresentingFlow = await getPresentingFlowClass();
    const items = await PresentingFlow.getInstance(target.filePath).getItems();
    if (items === null) {
        return fail(`The presenting flow "${target.name}" could not be read.`);
    }
    const titles = items.map((item) => {
        return item.title;
    });
    return await writeChange(
        target,
        items.map((item) => {
            return item.toJson();
        }),
        (itemJsonList) => {
            return applyAgentFlowRemoval(itemJsonList, lines, titles);
        },
    );
}

export async function handleAgentPresentingFlowEditRequest(
    request: AgentPresentingFlowEditRequestType,
): Promise<AgentResultType> {
    try {
        const action = toText(request?.action);
        if (!['lines', 'update-lines', 'remove-lines'].includes(action)) {
            return fail(
                'Unknown action. Use lines, update-lines or remove-lines.',
            );
        }
        const target = await resolveFlowTarget(request ?? {});
        if (!checkIsTarget(target)) {
            return target;
        }
        if (action === 'lines') {
            return await handleLines(target, request.line);
        }
        if (action === 'update-lines') {
            return await handleUpdateLines(target, request.changes);
        }
        return await handleRemoveLines(target, request.lines);
    } catch (error: any) {
        handleError(error);
        return fail(String(error?.message ?? error));
    }
}
