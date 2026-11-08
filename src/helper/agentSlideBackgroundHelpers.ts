/**
 * The app side of `owa_slide_edit`'s `set-background` and of the background
 * lines a `slides` read carries: the Background panel's pictures and videos
 * listed by name, a slide's attached background read and written through
 * `AttachBackgroundManager` (ONE read and ONE write of the `.bg.json`
 * sidecar for the whole change), the sidecar backed up first so `owa_undo`
 * -- the window's **Undo this change** -- puts it back.
 *
 * Unlike a box, a background is NOT part of the document's editing history:
 * it is kept the moment it is set, the way dropping a picture on a slide
 * card keeps it. The answer says so. The rules are in
 * `agentSlideBackgroundRules.ts`.
 */
import { dirSourceSettingNames } from './constants';
import DirSource from './DirSource';
import { DragTypeEnum, type DroppedDataType } from './DragInf';
import { handleError } from './errorHelpers';
import type { MimetypeNameType } from '../server/fileHelpers';
import {
    ATTACHED_BACKGROUND_EXTENSION,
    NoBackupError,
    genUndoField,
    listAgentFiles,
    runWithAgentBackup,
    snapshotAgentFile,
} from './agentBackupHelpers';
import {
    AGENT_SLIDE_BACKGROUND_LIMITS,
    type AgentCheckedSlideBackgroundType,
    describeAttachedBackground,
    findBackgroundCandidates,
    findBackgroundFileName,
    genSlideBackgroundSummary,
    toSlideIdList,
} from './agentSlideBackgroundRules';

type BackgroundKindType = {
    type: DragTypeEnum;
    settingName: string;
    mimetypeName: MimetypeNameType;
    /** The key a document read lists them under. */
    listKey: 'pictures' | 'videos';
};

const BACKGROUND_KIND_LIST: BackgroundKindType[] = [
    {
        type: DragTypeEnum.BACKGROUND_IMAGE,
        settingName: dirSourceSettingNames.BACKGROUND_IMAGE,
        mimetypeName: 'image',
        listKey: 'pictures',
    },
    {
        type: DragTypeEnum.BACKGROUND_VIDEO,
        settingName: dirSourceSettingNames.BACKGROUND_VIDEO,
        mimetypeName: 'video',
        listKey: 'videos',
    },
];

type ListedFileType = { filePath: string; fullName: string };

async function listKindFiles(
    kind: BackgroundKindType,
): Promise<ListedFileType[]> {
    const dirPath = DirSource.getDirPathBySettingName(kind.settingName);
    if (dirPath === null) {
        return [];
    }
    return await listAgentFiles(dirPath, kind.mimetypeName, '');
}

async function getAttachBackgroundManager() {
    const { attachBackgroundManager } =
        await import('../others/AttachBackgroundManager');
    return attachBackgroundManager;
}

function readSlideIdList(json: unknown) {
    const items = (json as { items?: unknown } | null)?.items;
    return Array.isArray(items) ? (items as { id?: unknown }[]) : [];
}

/**
 * What a document read adds about backgrounds: each listed slide's own
 * (`background` on its summary), and the Background panel's pictures and
 * videos by name -- the ones `set-background` can put behind a slide.
 * Bounded both ways: a Videos folder can hold hundreds.
 */
export async function readSlideBackgroundLines(
    filePath: string,
    slides: { id?: unknown }[],
) {
    const manager = await getAttachBackgroundManager();
    const data = await manager.readData(filePath);
    const bySlide = slides.map((slide) => {
        const key =
            typeof slide.id === 'number' || typeof slide.id === 'string'
                ? String(slide.id)
                : null;
        return key === null ? null : describeAttachedBackground(data[key]);
    });
    const choices: Record<string, string[]> = {};
    let isTruncated = false;
    for (const kind of BACKGROUND_KIND_LIST) {
        const names = (await listKindFiles(kind)).map((one) => {
            return one.fullName;
        });
        if (names.length > AGENT_SLIDE_BACKGROUND_LIMITS.listedNames) {
            isTruncated = true;
        }
        choices[kind.listKey] = names.slice(
            0,
            AGENT_SLIDE_BACKGROUND_LIMITS.listedNames,
        );
    }
    return {
        bySlide,
        documentBackground: describeAttachedBackground(data.self),
        backgroundChoices: {
            ...choices,
            ...(isTruncated ? { isTruncated: true } : {}),
        },
    };
}

type FoundBackgroundType = {
    droppedData: DroppedDataType;
    fullName: string;
};

type KindFileType = ListedFileType & { kind: BackgroundKindType };

async function toFound(file: KindFileType): Promise<FoundBackgroundType> {
    const { default: FileSource } = await import('./FileSource');
    return {
        droppedData: {
            type: file.kind.type,
            item: FileSource.getInstance(file.filePath),
        },
        fullName: file.fullName,
    };
}

function toQuotedList(files: { fullName: string }[]) {
    return files
        .slice(0, AGENT_SLIDE_BACKGROUND_LIMITS.listedNames)
        .map((one) => {
            return `"${one.fullName}"`;
        })
        .join(', ');
}

/**
 * A name in the Background panel to what a drop of it carries: the full
 * name or the name without its extension, else the ONE file whose name
 * holds every word asked. Several such files are named back to choose from.
 */
async function findBackgroundFile(
    name: string,
): Promise<FoundBackgroundType | { reason: string }> {
    const fileList: KindFileType[] = [];
    for (const kind of BACKGROUND_KIND_LIST) {
        const files = (await listKindFiles(kind)).map((one) => {
            return { ...one, kind };
        });
        const fullName = findBackgroundFileName(
            files.map((one) => {
                return one.fullName;
            }),
            name,
        );
        const found = files.find((one) => {
            return one.fullName === fullName;
        });
        if (found !== undefined) {
            return await toFound(found);
        }
        fileList.push(...files);
    }
    const candidateNames = new Set(
        findBackgroundCandidates(
            fileList.map((one) => {
                return one.fullName;
            }),
            name,
        ),
    );
    const candidates = fileList.filter((one) => {
        return candidateNames.has(one.fullName);
    });
    if (candidates.length === 1) {
        return await toFound(candidates[0]);
    }
    if (candidates.length > 1) {
        return {
            reason:
                `Several backgrounds fit "${name}": ` +
                `${toQuotedList(candidates)}. Nothing was changed. Ask ` +
                'again with the one wanted, or ask them which.',
        };
    }
    const listed = BACKGROUND_KIND_LIST.map((kind) => {
        const files = fileList.filter((one) => {
            return one.kind === kind;
        });
        return files.length === 0
            ? `no ${kind.listKey}`
            : `${kind.listKey} ${toQuotedList(files)}` +
                  (files.length > AGENT_SLIDE_BACKGROUND_LIMITS.listedNames
                      ? ` and ${files.length - AGENT_SLIDE_BACKGROUND_LIMITS.listedNames} more`
                      : '');
    }).join('; ');
    return {
        reason:
            `The Background panel has no picture or video called "${name}" ` +
            `(it has ${listed}). Nothing was changed. A picture the user ` +
            'wants there is dropped into the Background panel first; a plain ' +
            'colour is written #RRGGBB.',
    };
}

/** `set-background` on the slide document at `filePath`, request checked. */
export async function handleSlideBackgroundAt(
    filePath: string,
    name: string,
    json: unknown,
    checked: AgentCheckedSlideBackgroundType,
) {
    const slideList = readSlideIdList(json);
    if (slideList.length === 0) {
        return {
            isError: true as const,
            reason: `"${name}" has no slides yet, so nothing was changed.`,
        };
    }
    const numbers =
        checked.slides ??
        slideList.map((_slide, index) => {
            return index + 1;
        });
    const idList = toSlideIdList(slideList, numbers, name);
    if (!Array.isArray(idList)) {
        return idList;
    }
    let droppedData: DroppedDataType | null = null;
    let described: string | null = null;
    if (checked.wanted.kind === 'color') {
        droppedData = {
            type: DragTypeEnum.BACKGROUND_COLOR,
            item: checked.wanted.color,
        };
        described = describeAttachedBackground(droppedData);
    } else if (checked.wanted.kind === 'file') {
        const found = await findBackgroundFile(checked.wanted.name);
        if ('reason' in found) {
            return { isError: true as const, reason: found.reason };
        }
        droppedData = found.droppedData;
        described = describeAttachedBackground({
            type: found.droppedData.type,
            item: found.fullName,
        });
    }
    // Taking EVERY slide's off takes the document's own one off too, or
    // the screen would still put that behind them.
    const keyList: (string | number | undefined)[] =
        droppedData === null && checked.slides === null
            ? [...idList, undefined]
            : idList;
    // Nothing to take off is no change: no backup, and no Undo under it.
    if (droppedData === null) {
        const manager = await getAttachBackgroundManager();
        const data = await manager.readData(filePath);
        const hasAny = keyList.some((key) => {
            return Object.hasOwn(data, manager.toKey(key));
        });
        if (!hasAny) {
            return {
                didChange: false,
                background: 'none',
                slides: numbers,
                note: 'Those slides have no background of their own to take off.',
            };
        }
    }
    const summary = genSlideBackgroundSummary(name, described, checked.slides);
    try {
        const { meta } = await runWithAgentBackup(
            summary,
            [
                await snapshotAgentFile(
                    `${filePath}${ATTACHED_BACKGROUND_EXTENSION}`,
                ),
            ],
            async () => {
                const manager = await getAttachBackgroundManager();
                await manager.setAttachedBackgrounds(
                    filePath,
                    keyList,
                    droppedData,
                );
            },
        );
        return {
            background: described ?? 'none',
            slides: numbers,
            summary,
            isSaved: true,
            ...genUndoField(meta),
            note:
                'A background is kept at once -- it is not one of the ' +
                "document's unsaved changes, and Save is not needed for it. " +
                'The screen shows it behind the words when the slide is ' +
                'presented.',
        };
    } catch (error) {
        if (error instanceof NoBackupError) {
            return { isError: true as const, reason: error.message };
        }
        handleError(error);
        return {
            isError: true as const,
            reason:
                `${summary} could not be finished: ` +
                `${error instanceof Error ? error.message : String(error)} ` +
                'Anything it did get to do can be put back with owa_undo.',
        };
    }
}
