// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { showAppContextMenuMock } = vi.hoisted(() => ({
    showAppContextMenuMock: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../../others/labelIconHelpers', () => ({
    toIconedLabel: (text: string) => text,
}));
// The real module reaches the screen managers and the settings store.
vi.mock('../../_screen/screenHelpers', () => ({
    getStageAccentColor: () => 'red',
    STAGE_NUMBER_CHOICE_COUNT: 6,
}));
vi.mock('../../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

import StagePreviewerHeaderComp, {
    parseStagePaneSetting,
    toStagePaneSetting,
} from './StagePreviewerHeaderComp';
import { DESTRUCTIVE_LABEL_PATTERNS } from '../../../tools/owa-devtools-mcp/destructiveLabel.mjs';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    showAppContextMenuMock.mockReset();
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

function render(
    props: Partial<Parameters<typeof StagePreviewerHeaderComp>[0]>,
) {
    const onStagesChange = vi.fn();
    act(() => {
        root.render(
            <StagePreviewerHeaderComp
                stages={[0]}
                maxPaneCount={6}
                isWithIncrement={false}
                onStagesChange={onStagesChange}
                {...props}
            />,
        );
    });
    return onStagesChange;
}

function getAddButton() {
    return container.querySelector('.stage-previewer-add') as HTMLButtonElement;
}

describe('parseStagePaneSetting', () => {
    test('the base stage leads, the rest sorted, each once', () => {
        expect(parseStagePaneSetting('3, 1,3,x,-2,0', 8)).toEqual([0, 1, 3]);
        expect(parseStagePaneSetting('', 8)).toEqual([0]);
    });

    test('never more panes than the ceiling', () => {
        expect(parseStagePaneSetting('1,2,3,4,5,6,7', 6)).toEqual([
            0, 1, 2, 3, 4, 5,
        ]);
    });
});

describe('toStagePaneSetting', () => {
    test('sorted, the base stage left out', () => {
        expect(toStagePaneSetting([0, 4, 2, 4])).toBe('2,4');
        expect(toStagePaneSetting([0])).toBe('');
    });
});

describe('StagePreviewerHeaderComp', () => {
    test('the base stage chip says it stays, the others can be hidden', () => {
        const onStagesChange = render({ stages: [0, 2] });
        const chips = container.querySelectorAll('.stage-previewer-chip');
        expect(chips).toHaveLength(2);
        expect(chips[0].classList.contains('is-base')).toBe(true);
        expect(chips[0].querySelector('.stage-previewer-chip-remove')).toBe(
            null,
        );
        const hideButton = chips[1].querySelector(
            '.stage-previewer-chip-remove',
        ) as HTMLButtonElement;
        expect(hideButton.getAttribute('aria-label')).toBe('Hide Stage 2');
        act(() => {
            hideButton.click();
        });
        expect(onStagesChange).toHaveBeenCalledWith([0]);
    });

    // Hiding a pane is undone by Add Stage, so the words on it must not read
    // as a press that cannot be undone: the agent firewall refused "Remove
    // Stage 3", and an assistant that added a pane could not take it away.
    test('the x is worded as something an assistant may press', () => {
        render({ stages: [0, 3] });
        const hideButton = container.querySelector(
            '.stage-previewer-chip-remove',
        ) as HTMLButtonElement;
        const label = hideButton.getAttribute('aria-label') ?? '';
        expect(label).toBe('Hide Stage 3');
        for (const pattern of DESTRUCTIVE_LABEL_PATTERNS) {
            expect(pattern.test(label)).toBe(false);
        }
    });

    test('Add Stage keeps its name when its words fold away', () => {
        render({ stages: [0] });
        expect(getAddButton().getAttribute('aria-label')).toBe('Add Stage');
    });

    test('Add Stage offers stages 0 to 5, the shown ones disabled', () => {
        const onStagesChange = render({ stages: [0, 2] });
        act(() => {
            getAddButton().click();
        });
        const items = showAppContextMenuMock.mock.calls[0][1];
        expect(items.map((item: any) => item.menuElement)).toEqual([
            'Stage 0',
            'Stage 1',
            'Stage 2',
            'Stage 3',
            'Stage 4',
            'Stage 5',
        ]);
        expect(items.map((item: any) => item.disabled)).toEqual([
            true,
            false,
            true,
            false,
            false,
            false,
        ]);
        items[3].onSelect();
        expect(onStagesChange).toHaveBeenCalledWith([0, 2, 3]);
    });

    test('a song also offers the next stage past the highest shown', () => {
        render({ stages: [0, 2], isWithIncrement: true });
        act(() => {
            getAddButton().click();
        });
        const items = showAppContextMenuMock.mock.calls[0][1];
        expect(items).toHaveLength(7);
        expect(items[6].menuElement).toBe('Increment · Stage 3');
    });

    test('Add Stage goes dead at the pane ceiling', () => {
        render({ stages: [0, 1], maxPaneCount: 2 });
        expect(getAddButton().disabled).toBe(true);
        expect(getAddButton().title).toBe('Maximum stages are shown');
    });

    test('a caller can add to every chip and end the row', () => {
        render({
            stages: [0, 3],
            renderChipExtra: (stage) => (
                <i className="chip-extra" data-stage={stage} />
            ),
            children: <button className="row-end" />,
        });
        expect(
            Array.from(container.querySelectorAll('.chip-extra')).map(
                (element) => element.getAttribute('data-stage'),
            ),
        ).toEqual(['0', '3']);
        expect(container.querySelector('.row-end')).not.toBeNull();
    });

    test('a document stage has no gear and no Increment unless given', () => {
        render({ stages: [0] });
        expect(container.querySelector('.stage-previewer-chip-config')).toBe(
            null,
        );
        act(() => {
            getAddButton().click();
        });
        expect(showAppContextMenuMock.mock.calls[0][1]).toHaveLength(6);
    });
});
