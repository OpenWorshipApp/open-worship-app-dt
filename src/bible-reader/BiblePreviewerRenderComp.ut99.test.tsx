// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        viewController: null as any,
        nestedBibleItems: [] as unknown,
        fontSize: 30,
        model: 'KJV',
        fullscreenElement: null as Element | null,
        setBibleViewFontSize: vi.fn(),
        useZoomingRegistering: vi.fn(),
        handleAutoHide: vi.fn(),
        showSimpleToast: vi.fn(),
        showAppContextMenu: vi.fn(),
        setBibleModelInfoSetting: vi.fn(),
        reload: vi.fn(),
        requestFullscreen: vi.fn(),
        exitFullscreen: vi.fn(),
        rangeProps: null as any,
    };
});

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppEffect: React.useEffect,
        useAppCurrentRef: (value: unknown) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('./BibleItemsViewController', () => ({
    useBibleItemViewControllerUpdateEvent: () => h.nestedBibleItems,
    useBibleItemsViewControllerContext: () => h.viewController,
}));
vi.mock('../helper/bibleViewHelpers', async () => {
    const React = await import('react');
    return {
        BibleViewFontSizeContext: React.createContext(0),
        setBibleViewFontSize: h.setBibleViewFontSize,
        useBibleViewFontSize: () => h.fontSize,
    };
});
// The views themselves: what they are handed is the previewer's business.
vi.mock('./BibleViewRendererComp', async () => {
    const React = await import('react');
    const { BibleViewFontSizeContext } =
        await import('../helper/bibleViewHelpers');
    return {
        default: ({ nestedBibleItems }: { nestedBibleItems: unknown }) => {
            const fontSize = React.use(BibleViewFontSizeContext);
            return (
                <div
                    className="renderer"
                    data-font-size={fontSize}
                    data-items={JSON.stringify(nestedBibleItems)}
                />
            );
        },
    };
});
vi.mock('./BibleViewPaneHostComp', () => ({
    default: ({ nestedBibleItems, children }: any) => (
        <div
            className="pane-host"
            data-items={JSON.stringify(nestedBibleItems)}
        >
            {children}
        </div>
    ),
}));
vi.mock('./BibleSelectionToolbarComp', () => ({
    default: () => <span className="selection-toolbar-host" />,
}));
vi.mock('../others/AppRangeComp', () => ({
    default: (props: any) => {
        h.rangeProps = props;
        return <input type="range" className="font-range" id={props.id} />;
    },
    useZoomingRegistering: h.useZoomingRegistering,
}));
vi.mock('../helper/domHelpers', () => ({
    handleAutoHide: h.handleAutoHide,
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    bibleModelInfoTitleMap: {
        KJV: 'King James Version',
        KJVD: 'King James Version with Deuterocanon',
        DR: 'Douay-Rheims',
    },
    getBibleModelInfoSetting: () => h.model,
    setBibleModelInfoSetting: h.setBibleModelInfoSetting,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../server/appProvider', () => ({
    default: { reload: h.reload },
}));

import BiblePreviewerRenderComp from './BiblePreviewerRenderComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

async function flush() {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
}

async function renderPreviewer(footerExtra?: ReactNode) {
    await act(async () => {
        root.render(<BiblePreviewerRenderComp footerExtra={footerExtra} />);
    });
}

async function press(element: Element | null) {
    if (element === null) {
        throw new Error('nothing to press');
    }
    await act(async () => {
        (element as HTMLElement).click();
        await flush();
    });
}

function getFullScreenButton() {
    return host.querySelector<HTMLButtonElement>(
        '.card-footer button.btn-info',
    );
}

beforeEach(() => {
    h.viewController = { shouldNewLine: true, shouldModelNewLine: false };
    h.nestedBibleItems = [{ id: 1 }, [{ id: 2 }, { id: 3 }]];
    h.fontSize = 30;
    h.model = 'KJV';
    h.fullscreenElement = null;
    h.rangeProps = null;
    h.requestFullscreen.mockResolvedValue(undefined);
    h.exitFullscreen.mockResolvedValue(undefined);
    // jsdom has no Fullscreen API: `fullscreenElement` is not even null.
    Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => h.fullscreenElement,
    });
    (document as any).exitFullscreen = h.exitFullscreen;
    (document.documentElement as any).requestFullscreen = h.requestFullscreen;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    delete (document as any).fullscreenElement;
    delete (document as any).exitFullscreen;
    delete (document.documentElement as any).requestFullscreen;
});

describe('BiblePreviewerRenderComp', () => {
    test('lays the views out in the pane host, at the shared font size', async () => {
        await renderPreviewer();
        const paneHost = host.querySelector('.pane-host')!;
        expect(JSON.parse(paneHost.getAttribute('data-items')!)).toEqual(
            h.nestedBibleItems,
        );
        const renderer = paneHost.querySelector('.renderer')!;
        expect(JSON.parse(renderer.getAttribute('data-items')!)).toEqual(
            h.nestedBibleItems,
        );
        expect(renderer.getAttribute('data-font-size')).toBe('30');
        // One selection toolbar host per window that shows bible views.
        expect(host.querySelectorAll('.selection-toolbar-host')).toHaveLength(
            1,
        );
        const footer = host.querySelector('.card-footer')!;
        expect(h.handleAutoHide).toHaveBeenCalledWith(footer);
    });

    test('Ctrl + scroll zooms the card through the same font size', async () => {
        await renderPreviewer();
        const card = host.firstElementChild!;
        const [containerRef, options] = h.useZoomingRegistering.mock.calls[0];
        expect(containerRef.current).toBe(card);
        expect(options.value).toBe(30);
        expect(options.defaultSize).toEqual({
            size: 5,
            min: 5,
            max: 150,
            step: 2,
        });
        act(() => {
            options.setValue(42);
        });
        expect(h.setBibleViewFontSize).toHaveBeenLastCalledWith(42);
        act(() => {
            options.setValue((oldFontSize: number) => oldFontSize + 2);
        });
        expect(h.setBibleViewFontSize).toHaveBeenLastCalledWith(32);
    });

    test('the font size control shows the size and sets it', async () => {
        await renderPreviewer();
        const setting = host.querySelector('.bible-view-setting')!;
        expect(setting.getAttribute('title')).toBe('Font Size [Ctrl + Scroll]');
        expect(setting.querySelector('.badge')!.textContent).toBe('30px');
        expect(setting.querySelector('label')!.getAttribute('for')).toBe(
            'preview-fon-size',
        );
        expect(h.rangeProps).toMatchObject({
            value: 30,
            title: 'Font Size',
            id: 'preview-fon-size',
            defaultSize: { size: 5, min: 5, max: 150, step: 2 },
        });
        act(() => {
            h.rangeProps.setValue(12);
        });
        expect(h.setBibleViewFontSize).toHaveBeenCalledWith(12);
    });

    test('the footer extra sits before the full-screen button', async () => {
        await renderPreviewer(<span className="footer-extra" />);
        const fullScreenButton = getFullScreenButton()!;
        expect(fullScreenButton.previousElementSibling!.className).toBe(
            'footer-extra',
        );
    });

    test('Full asks for full screen, and the card follows the change', async () => {
        await renderPreviewer();
        const card = host.firstElementChild!;
        expect(card.className).not.toContain('app-popup-full');
        const fullScreenButton = getFullScreenButton()!;
        expect(fullScreenButton.getAttribute('title')).toBe('Full');
        expect(fullScreenButton.textContent).toBe('Full');
        expect(fullScreenButton.querySelector('i')!.className).toBe(
            'bi bi-arrows-fullscreen',
        );
        await press(fullScreenButton);
        expect(h.requestFullscreen).toHaveBeenCalledTimes(1);
        expect(h.exitFullscreen).not.toHaveBeenCalled();

        h.fullscreenElement = document.documentElement;
        await act(async () => {
            document.dispatchEvent(new Event('fullscreenchange'));
        });
        expect(card.className).toContain('app-popup-full');
        expect(getFullScreenButton()!.textContent).toBe('Exit Full');
        expect(getFullScreenButton()!.querySelector('i')!.className).toBe(
            'bi bi-fullscreen-exit',
        );

        await press(getFullScreenButton());
        expect(h.exitFullscreen).toHaveBeenCalledTimes(1);
    });

    test('already in full screen, it opens as such', async () => {
        h.fullscreenElement = document.documentElement;
        await renderPreviewer();
        expect(host.firstElementChild!.className).toContain('app-popup-full');
        expect(getFullScreenButton()!.textContent).toBe('Exit Full');
    });

    test('a refused full screen is said, not thrown', async () => {
        h.requestFullscreen.mockRejectedValue(new Error('denied'));
        await renderPreviewer();
        await press(getFullScreenButton());
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Toggle full screen failed',
            'Error: Error: denied',
        );
    });

    test('unmounted, it stops following full screen', async () => {
        const removeSpy = vi.spyOn(document, 'removeEventListener');
        await renderPreviewer();
        act(() => {
            root.unmount();
        });
        root = createRoot(host);
        expect(
            removeSpy.mock.calls.some(([type]) => type === 'fullscreenchange'),
        ).toBe(true);
        removeSpy.mockRestore();
    });
});

describe('NewLineSettingComp in the footer', () => {
    function getCheckboxes() {
        return {
            newLine: host.querySelector<HTMLInputElement>('#new-line-setting')!,
            modelNewLine: host.querySelector<HTMLInputElement>(
                '#use-model-new-line-setting',
            )!,
        };
    }

    test('starts from the view controller and writes each change back', async () => {
        await renderPreviewer();
        const { newLine, modelNewLine } = getCheckboxes();
        expect(newLine.checked).toBe(true);
        expect(newLine.getAttribute('aria-label')).toBe('Should New Lines');
        expect(newLine.closest('label')!.getAttribute('title')).toBe(
            'Should New Lines — Break lines following bible info',
        );
        expect(modelNewLine.checked).toBe(false);
        expect(modelNewLine.disabled).toBe(false);

        await press(modelNewLine);
        expect(h.viewController.shouldModelNewLine).toBe(true);
        expect(getCheckboxes().modelNewLine.checked).toBe(true);

        await press(newLine);
        expect(h.viewController.shouldNewLine).toBe(false);
        const after = getCheckboxes();
        expect(after.newLine.checked).toBe(false);
        // Model formatting only matters while lines break at all.
        expect(after.modelNewLine.disabled).toBe(true);
        expect(after.modelNewLine.closest('label')!.style.opacity).toBe('0.5');
    });

    test('new lines off from the start leaves the model option disabled', async () => {
        h.viewController = { shouldNewLine: false, shouldModelNewLine: true };
        await renderPreviewer();
        const { newLine, modelNewLine } = getCheckboxes();
        expect(newLine.checked).toBe(false);
        expect(modelNewLine.checked).toBe(true);
        expect(modelNewLine.disabled).toBe(true);
    });
});

describe('BibleModelInfoSettingComp in the footer', () => {
    function getModelButton() {
        return host.querySelector<HTMLButtonElement>(
            '.card-footer button.btn-outline-secondary',
        )!;
    }

    test('names the model in use and offers the others', async () => {
        h.model = 'KJVD';
        await renderPreviewer();
        const button = getModelButton();
        expect(button.textContent).toBe('KJVD');
        expect(button.getAttribute('title')).toBe(
            'Change Bible Model Info (King James Version with Deuterocanon)',
        );
        await press(button);
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(1);
        const [event, itemList] = h.showAppContextMenu.mock.calls[0];
        expect(event.type).toBe('click');
        expect(
            itemList.map((item: any) => {
                return [item.menuElement, item.title, item.disabled];
            }),
        ).toEqual([
            ['KJV - (King James Version)', 'King James Version', false],
            [
                'KJVD - (King James Version with Deuterocanon)',
                'King James Version with Deuterocanon',
                true,
            ],
            ['DR - (Douay-Rheims)', 'Douay-Rheims', false],
        ]);
        expect(itemList[0].childBefore.props.className).toBe('bi bi-cpu');
    });

    test('picking another model saves it and reloads the window', async () => {
        await renderPreviewer();
        await press(getModelButton());
        const [, itemList] = h.showAppContextMenu.mock.calls[0];
        act(() => {
            itemList[2].onSelect();
        });
        expect(h.setBibleModelInfoSetting).toHaveBeenCalledWith('DR');
        expect(h.reload).toHaveBeenCalledTimes(1);
    });
});
