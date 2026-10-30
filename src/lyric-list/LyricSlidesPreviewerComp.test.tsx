// @vitest-environment jsdom

import { act, createElement, use } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The song's Stage Previewer: one pane per stage named in a setting, the gear
// on each chip, the `⋮` menu and the file-update ordering. The REAL style-panel
// store (`lyricStageStyleFloatingHelpers`) is used, because which previewer
// owns the panel is exactly what this component has to get right when two of
// them are mounted. Panes, header and warm-up are stand-ins that record what
// they were handed.
const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    lyricManager: null as any,
    stageDocuments: new Map<number, any>(),
    resizeProps: null as any,
    headerProps: null as any,
    floatingProps: [] as any[],
    fileUpdate: null as null | (() => Promise<void>),
    fileUpdatePath: null as string | null,
    warmCalls: [] as any[],
    calls: [] as string[],
    scheduleWarmUp: vi.fn(),
    showAppContextMenu: vi.fn(),
    exportLyricStagesToPptx: vi.fn(),
    genDocumentTransitionMenuItems: vi.fn(),
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useStateSettingString: (key: string, defaultValue: string) => {
            const [value, setValue] = useState(
                h.settings.get(key) ?? defaultValue,
            );
            return [
                value,
                (newValue: string) => {
                    h.settings.set(key, newValue);
                    setValue(newValue);
                },
            ];
        },
    };
});
vi.mock('../app-document-list/appDocumentHelpers', async () => {
    const { createContext } = await import('react');
    return { VaryAppDocumentContext: createContext<any>(null) };
});
vi.mock('../app-document-presenter/items/VarySlidesPreviewerComp', async () => {
    const { VaryAppDocumentContext } =
        await import('../app-document-list/appDocumentHelpers');
    return {
        default: () => {
            const lyricAppDocument = use(VaryAppDocumentContext) as any;
            return createElement('div', {
                className: 'slides',
                'data-stage': lyricAppDocument.stage,
            });
        },
    };
});
vi.mock('../resize-actor/ResizeActorComp', () => ({
    default: (props: any) => {
        h.resizeProps = props;
        return createElement(
            'div',
            { className: 'panes' },
            props.dataInput.map((input: any) =>
                createElement(
                    'div',
                    { key: input.key, 'data-key': input.key },
                    input.children.render(),
                ),
            ),
        );
    },
}));
vi.mock('./LyricManager', () => ({
    useLyricManagerContext: () => h.lyricManager,
}));
vi.mock('./lyricHelpers', () => ({
    getLyricAppDocumentStageByStage: (_filePath: string, stage: number) => {
        if (!h.stageDocuments.has(stage)) {
            h.stageDocuments.set(stage, {
                stage,
                openLyric: null,
                clearCache: vi.fn(() => {
                    h.calls.push(`clear-${stage}`);
                }),
            });
        }
        return [stage, h.stageDocuments.get(stage)];
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../others/labelIconHelpers', () => ({
    getLabelIconName: (label: string) => `${label.toLowerCase()}-icon`,
}));
vi.mock('./LyricStageStyleFloatingComp', () => ({
    default: (props: any) => {
        h.floatingProps.push(props);
        return null;
    },
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (
        _events: string[],
        callback: () => Promise<void>,
        _deps: unknown,
        filePath: string,
    ) => {
        h.fileUpdate = callback;
        h.fileUpdatePath = filePath;
    },
}));
vi.mock('./lyricPptxExportHelpers', () => ({
    exportLyricStagesToPptx: h.exportLyricStagesToPptx,
}));
vi.mock('../others/slideTransitionMenuHelpers', () => ({
    genDocumentTransitionMenuItems: h.genDocumentTransitionMenuItems,
}));
vi.mock('../app-document-presenter/stage/StagePreviewerHeaderComp', () => ({
    // The real parse, minus the screen-helper import it carries.
    parseStagePaneSetting: (stageSetting: string, maxPaneCount: number) => {
        const stages = [
            ...new Set(
                stageSetting
                    .split(',')
                    .map((stage) => Number.parseInt(stage.trim(), 10))
                    .filter((stage) => Number.isInteger(stage) && stage > 0),
            ),
        ]
            .sort((stageA, stageB) => stageA - stageB)
            .slice(0, maxPaneCount - 1);
        return [0, ...stages];
    },
    toStagePaneSetting: (stages: number[]) =>
        [...new Set(stages)]
            .filter((stage) => stage !== 0)
            .sort((stageA, stageB) => stageA - stageB)
            .join(','),
    genStageAccentStyle: (stage: number) => ({ color: `rgb(${stage}, 0, 0)` }),
    default: (props: any) => {
        h.headerProps = props;
        return createElement(
            'header',
            null,
            props.stages.map((stage: number) =>
                createElement(
                    'span',
                    { key: stage, className: 'chip' },
                    props.renderChipExtra(stage),
                ),
            ),
            props.children,
        );
    },
}));
vi.mock('./useLyricWarmSlides', () => ({
    useLyricWarmSlides: (lyricManager: unknown, stages: number[]) => {
        h.warmCalls.push([lyricManager, stages]);
        return h.scheduleWarmUp;
    },
}));

import LyricSlidesPreviewerComp from './LyricSlidesPreviewerComp';
import { useLyricStageStyleFloatingStage } from './lyricStageStyleFloatingHelpers';

const SETTING_NAME = 'lyric-slides-previewer-stages';

let container: HTMLDivElement;
let root: Root;

function genLyricManager() {
    return {
        filePath: '/songs/grace.owl',
        openLyricPreviewer: { name: 'shared previewer' },
        fileSource: {
            filePath: '/songs/grace.owl',
            fireUpdateEvent: vi.fn(),
        },
        refreshOpenLyricContent: vi.fn(async () => {
            // Resolves on a later microtask, so an un-awaited call would
            // let the cache drops below overtake it.
            await Promise.resolve();
            await Promise.resolve();
            h.calls.push('refresh');
        }),
    };
}

async function renderPreviewers(count = 1) {
    await act(async () => {
        root.render(
            createElement(
                'div',
                null,
                Array.from({ length: count }, (_value, index) =>
                    createElement(LyricSlidesPreviewerComp, { key: index }),
                ),
            ),
        );
    });
}

function getPaneStages() {
    return Array.from(container.querySelectorAll('.slides')).map((pane) => {
        return Number(pane.getAttribute('data-stage'));
    });
}

function getGear(stage: number, previewerIndex = 0) {
    const previewer = container.querySelectorAll('.lyric-slides-previewer')[
        previewerIndex
    ];
    return previewer.querySelector<HTMLButtonElement>(
        `button[aria-label="Stage Style ${stage}"]`,
    )!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.settings.clear();
    h.stageDocuments.clear();
    h.floatingProps = [];
    h.warmCalls = [];
    h.calls = [];
    h.lyricManager = genLyricManager();
    h.scheduleWarmUp.mockImplementation(() => {
        h.calls.push('warm');
    });
    h.genDocumentTransitionMenuItems.mockResolvedValue([
        { menuElement: 'Transition' },
    ]);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('stage panes', () => {
    test('a fresh install shows the base stage alone', async () => {
        await renderPreviewers();
        expect(getPaneStages()).toEqual([0]);
        expect(h.headerProps.stages).toEqual([0]);
        expect(h.headerProps.maxPaneCount).toBe(8);
        expect(h.headerProps.isWithIncrement).toBe(true);
    });

    test('one pane per stage named, each fed the ONE shared previewer', async () => {
        h.settings.set(SETTING_NAME, '2,1');
        await renderPreviewers();

        expect(getPaneStages()).toEqual([0, 1, 2]);
        for (const stage of [0, 1, 2]) {
            expect(h.stageDocuments.get(stage).openLyric).toBe(
                h.lyricManager.openLyricPreviewer,
            );
        }
        expect(h.resizeProps.flexSizeName).toBe(
            'flex-size-lyric-slides-previewer',
        );
        expect(h.resizeProps.flexSizeDefault).toEqual({
            h0: ['1'],
            h1: ['1'],
            h2: ['1'],
        });
        expect(
            h.resizeProps.dataInput.map((input: any) => [
                input.key,
                input.widgetName,
                input.widgetIconName,
            ]),
        ).toEqual([
            ['h0', 'Stage 0', 'stage-icon'],
            ['h1', 'Stage 1', 'stage-icon'],
            ['h2', 'Stage 2', 'stage-icon'],
        ]);
        // Each pane wears its stage's accent.
        const pane = container.querySelector<HTMLElement>(
            '[data-key="h2"] .stage-previewer-pane',
        )!;
        expect(pane.style.color).toBe('rgb(2, 0, 0)');
        // The warm-up is told what the panes already build.
        expect(h.warmCalls.at(-1)).toEqual([h.lyricManager, [0, 1, 2]]);
    });

    test('the header edits the list, and the setting keeps it', async () => {
        await renderPreviewers();
        await act(async () => {
            h.headerProps.onStagesChange([0, 3, 1, 3]);
        });
        expect(h.settings.get(SETTING_NAME)).toBe('1,3');
        expect(getPaneStages()).toEqual([0, 1, 3]);
    });
});

describe('the song changed on disk', () => {
    test('re-feeds the previewer FIRST, then drops caches, then warms', async () => {
        h.settings.set(SETTING_NAME, '2');
        await renderPreviewers();
        expect(h.fileUpdatePath).toBe('/songs/grace.owl');

        await act(async () => {
            await h.fileUpdate!();
        });
        expect(h.calls).toEqual(['refresh', 'clear-0', 'clear-2', 'warm']);
    });
});

describe('More Options', () => {
    test('offers Reload, Export to PPTX and the song transition', async () => {
        h.settings.set(SETTING_NAME, '1');
        await renderPreviewers();
        const moreButton = container.querySelector<HTMLButtonElement>(
            'button[aria-label="More Options"]',
        )!;
        await act(async () => {
            moreButton.click();
        });

        expect(h.genDocumentTransitionMenuItems).toHaveBeenCalledWith(
            '/songs/grace.owl',
        );
        const [event, items] = h.showAppContextMenu.mock.calls[0];
        expect(event.type).toBe('click');
        expect(items.map((item: any) => item.menuElement)).toEqual([
            'Reload',
            'Export to PPTX',
            'Transition',
        ]);
        expect(items[0].childBefore).toBe('icon:arrow-clockwise');

        items[0].onSelect();
        expect(h.lyricManager.fileSource.fireUpdateEvent).toHaveBeenCalledTimes(
            1,
        );
        items[1].onSelect();
        expect(h.exportLyricStagesToPptx).toHaveBeenCalledWith([
            [0, h.stageDocuments.get(0)],
            [1, h.stageDocuments.get(1)],
        ]);
    });
});

describe('stage style gear', () => {
    test('each chip gear toggles that stage, retargeting one panel', async () => {
        h.settings.set(SETTING_NAME, '2');
        await renderPreviewers();
        expect(getGear(2).getAttribute('aria-pressed')).toBe('false');

        await act(async () => {
            getGear(2).click();
        });
        expect(getGear(2).getAttribute('aria-pressed')).toBe('true');
        expect(getGear(2).className).toContain('is-active');

        await act(async () => {
            getGear(0).click();
        });
        expect(getGear(2).getAttribute('aria-pressed')).toBe('false');
        expect(getGear(0).getAttribute('aria-pressed')).toBe('true');

        await act(async () => {
            getGear(0).click();
        });
        expect(getGear(0).getAttribute('aria-pressed')).toBe('false');
    });

    test("one previewer's gear never opens the other's panel", async () => {
        await renderPreviewers(2);
        const ownerIds = h.floatingProps
            .slice(-2)
            .map((props: any) => props.ownerId);
        expect(new Set(ownerIds).size).toBe(2);

        await act(async () => {
            getGear(0, 1).click();
        });
        expect(getGear(0, 1).getAttribute('aria-pressed')).toBe('true');
        expect(getGear(0, 0).getAttribute('aria-pressed')).toBe('false');
    });

    test('a style change refreshes every pane through the song file', async () => {
        await renderPreviewers();
        h.floatingProps.at(-1).onChanged();
        expect(h.lyricManager.fileSource.fireUpdateEvent).toHaveBeenCalledTimes(
            1,
        );
    });

    test('a previewer that goes away takes its open panel with it', async () => {
        await renderPreviewers();
        const { ownerId } = h.floatingProps.at(-1);
        await act(async () => {
            getGear(0).click();
        });
        act(() => {
            root.unmount();
        });

        let openedStage: number | null = -1;
        function ProbeComp() {
            openedStage = useLyricStageStyleFloatingStage(ownerId);
            return null;
        }
        root = createRoot(container);
        await act(async () => {
            root.render(createElement(ProbeComp));
        });
        expect(openedStage).toBeNull();
    });
});
