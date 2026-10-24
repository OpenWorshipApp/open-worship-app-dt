// @vitest-environment jsdom

import { act, use } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { settingState, setStageSettingMock, resizeActorPropsMock } = vi.hoisted(
    () => ({
        settingState: { value: '0' },
        setStageSettingMock: vi.fn(),
        resizeActorPropsMock: vi.fn(),
    }),
);

vi.mock('../../helper/settingHelpers', () => ({
    useStateSettingString: (name: string, defaultValue: string) => {
        expect(name).toBe('document-slides-previewer-stages');
        expect(defaultValue).toBe('0');
        return [settingState.value, setStageSettingMock];
    },
}));
vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));
vi.mock('../../others/labelIconHelpers', () => ({
    getLabelIconName: () => 'easel2',
    toIconedLabel: (text: string) => text,
}));
vi.mock('../../resize-actor/ResizeActorComp', () => ({
    default: (props: any) => {
        resizeActorPropsMock(props);
        return (
            <div data-testid="resize-actor">
                {props.dataInput.map((input: any) => (
                    <div key={input.key} data-key={input.key}>
                        {input.children.render()}
                    </div>
                ))}
            </div>
        );
    },
}));
// Each pane reads its stage from the context the previewer provides.
vi.mock('../items/VarySlidesPreviewerComp', async () => {
    const { SlideStageContext } = await import('./documentStageContexts');
    return {
        default: () => {
            const stage = use(SlideStageContext);
            return <div data-testid="slides" data-stage={stage} />;
        },
    };
});
vi.mock('./StagePreviewerHeaderComp', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('./StagePreviewerHeaderComp')>();
    return {
        ...original,
        default: (props: any) => {
            return (
                <button
                    data-testid="header"
                    data-stages={props.stages.join(',')}
                    data-max={props.maxPaneCount}
                    data-increment={`${props.isWithIncrement}`}
                    onClick={() => {
                        props.onStagesChange([0, 5, 2]);
                    }}
                />
            );
        },
    };
});
// What the real header module imports beside the helpers kept from it.
vi.mock('../../helper/appHooks', () => ({
    useAppCurrentRef: (value: unknown) => ({ current: value }),
}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: vi.fn(),
}));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../../_screen/screenHelpers', () => ({
    getStageAccentColor: () => 'red',
    STAGE_NUMBER_CHOICE_COUNT: 6,
}));

import DocumentStagePreviewerComp from './DocumentStagePreviewerComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    settingState.value = '0';
    setStageSettingMock.mockReset();
    resizeActorPropsMock.mockReset();
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

describe('DocumentStagePreviewerComp', () => {
    test('ships with the one stage 0 pane: the slide list as it was', () => {
        act(() => {
            root.render(<DocumentStagePreviewerComp />);
        });
        const panes = container.querySelectorAll('[data-testid="slides"]');
        expect(panes).toHaveLength(1);
        expect(panes[0].getAttribute('data-stage')).toBe('0');
        const header = container.querySelector('[data-testid="header"]')!;
        expect(header.getAttribute('data-max')).toBe('6');
        expect(header.getAttribute('data-increment')).toBe('false');
    });

    test('one pane per stage, each drawing its own stage', () => {
        settingState.value = '3,1';
        act(() => {
            root.render(<DocumentStagePreviewerComp flexSizeNamePrefix="f-" />);
        });
        expect(
            Array.from(
                container.querySelectorAll('[data-testid="slides"]'),
            ).map((pane) => pane.getAttribute('data-stage')),
        ).toEqual(['0', '1', '3']);
        const props = resizeActorPropsMock.mock.calls.at(-1)![0];
        expect(props.flexSizeName).toBe(
            'f-flex-size-document-slides-previewer',
        );
        expect(props.dataInput.map((input: any) => input.key)).toEqual([
            'h0',
            'h1',
            'h3',
        ]);
    });

    test('changing the stages writes them back sorted, stage 0 left out', () => {
        act(() => {
            root.render(<DocumentStagePreviewerComp />);
        });
        act(() => {
            (
                container.querySelector(
                    '[data-testid="header"]',
                ) as HTMLButtonElement
            ).click();
        });
        expect(setStageSettingMock).toHaveBeenCalledWith('2,5');
    });
});
