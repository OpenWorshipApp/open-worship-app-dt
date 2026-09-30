// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({
    mocks: {
        createEvent: vi.fn(),
        toggle: vi.fn(),
        click: vi.fn(),
        context: vi.fn(),
    },
}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    createMouseEvent: mocks.createEvent,
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening }: any) => (
        <button data-testid="menu" onClick={onOpening}>
            menu
        </button>
    ),
}));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));

import PresentingFlowRowComp from './PresentingFlowRowComp';
import PresentingFlowRowGutterComp from './PresentingFlowRowGutterComp';

describe('presenting-flow row primitives', () => {
    test('renders cue gutters and a fully annotated active row', () => {
        expect(renderToStaticMarkup(<PresentingFlowRowGutterComp />)).toContain(
            'app-presenting-flow-gutter',
        );
        expect(
            renderToStaticMarkup(
                <PresentingFlowRowGutterComp lineNumber={3} isCommand />,
            ),
        ).toContain('gutter-command');
        const html = renderToStaticMarkup(
            <PresentingFlowRowComp
                depth={2}
                lineNumber={4}
                isCommand
                isRunCursor
                idLabel="⏱"
                iconName="clock"
                iconColor="red"
                label="Wait"
                title="title"
                isExpandable
                isExpanded
                onToggleExpanding={mocks.toggle}
                onClick={mocks.click}
                onDragStart={() => undefined}
                onContextMenu={mocks.context}
                colorNote="#123456"
                isOnScreen
                itemUuid="uuid"
                isCcRow
                extraChild={<b>extra</b>}
                extraClassName="custom"
                extraStyle={{ fontWeight: 700 }}
            />,
        );
        expect(html).toContain('row-run-cursor');
        expect(html).toContain('role="button"');
        expect(html).toContain('data-presenting-flow-item-uuid="uuid"');
        expect(html).toContain('data-presenting-flow-cc-row=""');
        expect(html).toContain('width:24px');
        expect(html).toContain('bi-chevron-down');
        expect(html).toContain('extra');
    });

    test('distinguishes run-sheet parking from document disabling', () => {
        const runParked = renderToStaticMarkup(
            <PresentingFlowRowComp
                iconName="x"
                label="Parked"
                isDisabled
                isPresentingFlowDisabled
                onClick={mocks.click}
            />,
        );
        expect(runParked).toContain('disabled-presenting-flow');
        expect(runParked).toContain('bi-slash-circle');
        expect(runParked).not.toContain('role="button"');
        const docParked = renderToStaticMarkup(
            <PresentingFlowRowComp iconName="x" label="Hidden" isDisabled />,
        );
        expect(docParked).toContain('disabled in its document');
        expect(docParked).toContain('bi-eye-slash');
    });

    test('fires keyboard activation and isolates chevron clicks', async () => {
        const rootElement = document.createElement('div');
        document.body.append(rootElement);
        const root = createRoot(rootElement);
        mocks.createEvent.mockReturnValue({ synthetic: true });
        await act(async () =>
            root.render(
                <PresentingFlowRowComp
                    iconName="x"
                    label="Row"
                    isExpandable
                    onToggleExpanding={mocks.toggle}
                    onClick={mocks.click}
                />,
            ),
        );
        const row = rootElement.querySelector(
            '.app-presenting-flow-row',
        ) as HTMLElement;
        row.getBoundingClientRect = () => ({ left: 10, top: 20 }) as DOMRect;
        row.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Space', bubbles: true }),
        );
        expect(mocks.click).not.toHaveBeenCalled();
        row.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
        );
        expect(mocks.createEvent).toHaveBeenCalledWith(18, 28);
        expect(mocks.click).toHaveBeenCalledWith({ synthetic: true });
        (
            rootElement.querySelector(
                '.app-caught-hover-pointer',
            ) as HTMLElement
        ).click();
        expect(mocks.toggle).toHaveBeenCalled();
        await act(async () => root.unmount());
    });
});
