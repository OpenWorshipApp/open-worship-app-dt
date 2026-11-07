// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// `TransitionOverrideComp` (the checkbox + effect buttons, its dialog and menu
// row) and `slideTransitionMenuHelpers` (the slide / slides-preview wiring on
// top of it) on one mock surface: the helpers are driven through the REAL
// dialog body, only the popup host (`showAppInput`) is a stand-in.
const h = vi.hoisted(() => {
    const state = {
        isPagePresenter: true,
        fileSourceRegistrations: new Set<{
            events: string[];
            filePath?: string;
            fire: () => void;
        }>(),
    };
    const mocks = {
        showAppInput: vi.fn(),
        getCommonEffectType: vi.fn(),
        getAllTransitions: vi.fn(),
        setTransition: vi.fn(),
        handleAppError: vi.fn(),
    };
    const appProvider = {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        appUtils: {
            handleError: (error: unknown) => mocks.handleAppError(error),
        },
        messageUtils: { sendData: () => {} },
        get isPagePresenter() {
            return state.isPagePresenter;
        },
    };
    return { state, mocks, appProvider };
});

vi.mock('../server/appProvider', () => ({ default: h.appProvider }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppInput: (...args: any[]) => h.mocks.showAppInput(...args),
}));
vi.mock('../_screen/managers/ScreenEffectManager', () => ({
    default: {
        getCommonEffectType: (target: string) =>
            h.mocks.getCommonEffectType(target),
    },
}));
vi.mock('./SlideTransitionManager', () => ({
    default: {
        genMetaDataFilePath: (filePath: string) =>
            `${filePath}.transition.json`,
    },
    slideTransitionManager: {
        getAllTransitions: (filePath: string) =>
            h.mocks.getAllTransitions(filePath),
        setTransition: (...args: any[]) => h.mocks.setTransition(...args),
        toKey: (id?: string | number) => {
            return typeof id === 'number' ? id.toString() : (id ?? 'self');
        },
    },
}));
vi.mock('../helper/dirSourceHelpers', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useFileSourceEvents: (
            events: string[],
            callback: () => void,
            _deps: unknown,
            filePath?: string,
        ) => {
            const callbackRef = useRef(callback);
            callbackRef.current = callback;
            useEffect(() => {
                const registration = {
                    events,
                    filePath,
                    fire: () => callbackRef.current(),
                };
                h.state.fileSourceRegistrations.add(registration);
                return () => {
                    h.state.fileSourceRegistrations.delete(registration);
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [filePath]);
        },
    };
});

import TransitionOverrideComp, {
    TRANSITION_LABEL_MAP,
    genTransitionMenuItem,
    getTransitionIconName,
    showTransitionOverrideDialog,
    toTransitionLabel,
} from './TransitionOverrideComp';
import {
    DocumentTransitionIconComp,
    SlideTransitionIconComp,
    genDocumentTransitionMenuItems,
    genSlideInherited,
    genSlideTransitionMenuItems,
    genSlidesPreviewInherited,
    openSlideTransitionDialog,
    useSlideTransition,
} from './slideTransitionMenuHelpers';

let container: HTMLDivElement;
let root: Root | null = null;

async function render(node: ReactNode) {
    await act(async () => {
        root?.render(node);
    });
}

async function flush() {
    for (let i = 0; i < 5; i++) {
        await act(async () => {
            await Promise.resolve();
        });
    }
}

async function press(target: Element, type = 'click') {
    let isNotPrevented = true;
    await act(async () => {
        isNotPrevented = target.dispatchEvent(
            new MouseEvent(type, { bubbles: true, cancelable: true }),
        );
    });
    return isNotPrevented;
}

function getCheckbox() {
    return container.querySelector(
        'input[type="checkbox"]',
    ) as HTMLInputElement;
}

function getEffectButtons() {
    return Array.from(
        container.querySelectorAll('[role="group"] button'),
    ) as HTMLButtonElement[];
}

function getEffectButton(label: string) {
    return getEffectButtons().find((button) => {
        return button.getAttribute('aria-label') === label;
    })!;
}

// The popup host: records what it was asked to show and lets the test answer
// once it has pressed through the body.
function armAppInput() {
    const call = { title: '', body: null as any, options: null as any };
    let resolve: (isOk: boolean) => void = () => {};
    h.mocks.showAppInput.mockImplementation(
        (title: string, body: ReactNode, options: any) => {
            call.title = title;
            call.body = body;
            call.options = options;
            return new Promise<boolean>((resolver) => {
                resolve = resolver;
            });
        },
    );
    return {
        call,
        answer: async (isOk: boolean) => {
            await act(async () => {
                resolve(isOk);
            });
        },
    };
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.state.isPagePresenter = true;
    h.state.fileSourceRegistrations.clear();
    h.mocks.getCommonEffectType.mockReturnValue('fade');
    h.mocks.setTransition.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    const currentRoot = root;
    root = null;
    if (currentRoot !== null) {
        await act(async () => {
            currentRoot.unmount();
        });
    }
    container.remove();
    expect(h.mocks.handleAppError).not.toHaveBeenCalled();
});

describe('transition labels and icons', () => {
    test('name every effect in words and fall back to fade for the icon', () => {
        expect(Object.keys(TRANSITION_LABEL_MAP)).toEqual([
            'none',
            'fade',
            'move',
            'zoom',
        ]);
        expect(toTransitionLabel('move')).toBe('Slide In');
        expect(toTransitionLabel(null)).toBe('Varies by screen');
        expect(getTransitionIconName('none')).toBe('ban');
        expect(getTransitionIconName('zoom')).toBe('arrows-fullscreen');
        expect(getTransitionIconName(null)).toBe('shadows');
    });
});

describe('TransitionOverrideComp', () => {
    test('unticked, it shows what the item follows with every button disabled', async () => {
        const onChange = vi.fn();
        await render(
            <TransitionOverrideComp
                value={undefined}
                inherited={{ effect: 'zoom', sourceLabel: 'Screen setting' }}
                onChange={onChange}
                choicesClassName="choices"
            />,
        );
        const checkbox = getCheckbox();
        expect(checkbox.checked).toBe(false);
        const label = container.querySelector('label')!;
        expect(label.textContent).toBe('Own transition');
        expect(label.htmlFor).toBe(checkbox.id);
        expect(container.querySelector('.bi-question-circle')).toBeNull();
        const group = container.querySelector('[role="group"]')!;
        expect(group.className).toBe('btn-group choices');
        expect(group.getAttribute('aria-label')).toBe('Transition');
        expect(group.getAttribute('title')).toBe(
            'Follows: Screen setting (Zoom)',
        );
        const buttons = getEffectButtons();
        expect(
            buttons.map((button) => [
                button.value,
                button.getAttribute('aria-label'),
                button.querySelector('i')!.className,
                button.getAttribute('aria-pressed'),
                button.disabled,
            ]),
        ).toEqual([
            ['none', 'No Transition', 'bi bi-ban', 'false', true],
            ['fade', 'Fade', 'bi bi-shadows', 'false', true],
            ['move', 'Slide In', 'bi bi-align-end', 'false', true],
            ['zoom', 'Zoom', 'bi bi-arrows-fullscreen', 'true', true],
        ]);
        expect(getEffectButton('Zoom').className).toBe('btn btn-sm btn-info');
        expect(getEffectButton('Fade').className).toBe(
            'btn btn-sm btn-outline-info',
        );
        expect(container.querySelector('small')!.textContent).toBe(
            'Follows: Screen setting',
        );
        // Ticking starts from the effect it was following.
        await press(checkbox);
        expect(onChange).toHaveBeenCalledWith('zoom');
    });

    test('a screen-dependent fallback is flagged and ticking starts from fade', async () => {
        const onChange = vi.fn();
        await render(
            <TransitionOverrideComp
                value={undefined}
                inherited={{ effect: null, sourceLabel: 'Screen setting' }}
                onChange={onChange}
                isCompact
            />,
        );
        const question = container.querySelector(
            '.bi-question-circle',
        )!.parentElement!;
        expect(question.title).toBe('Varies by screen');
        expect(question.getAttribute('aria-label')).toBe('Varies by screen');
        expect(
            container.querySelector('[role="group"]')!.getAttribute('title'),
        ).toBe('Follows: Screen setting (Varies by screen)');
        expect(
            getEffectButtons().map((button) => {
                return button.getAttribute('aria-pressed');
            }),
        ).toEqual(['false', 'false', 'false', 'false']);
        // Compact rows say "Follows" in their own tooltip instead.
        expect(container.querySelector('small')).toBeNull();
        await press(getCheckbox());
        expect(onChange).toHaveBeenCalledWith('fade');
    });

    test('ticked, its own effect is pressed and another can be chosen or unticked', async () => {
        const onChange = vi.fn();
        await render(
            <TransitionOverrideComp
                value="move"
                inherited={{ effect: 'fade', sourceLabel: 'Slides preview' }}
                onChange={onChange}
            />,
        );
        expect(getCheckbox().checked).toBe(true);
        expect(
            container.querySelector('[role="group"]')!.getAttribute('title'),
        ).toBe('Transition');
        expect(container.querySelector('small')).toBeNull();
        const buttons = getEffectButtons();
        expect(buttons.every((button) => !button.disabled)).toBe(true);
        expect(getEffectButton('Slide In').getAttribute('aria-pressed')).toBe(
            'true',
        );
        expect(getEffectButton('Fade').getAttribute('aria-pressed')).toBe(
            'false',
        );
        await press(getEffectButton('Zoom'));
        expect(onChange).toHaveBeenLastCalledWith('zoom');
        await press(getCheckbox());
        expect(onChange).toHaveBeenLastCalledWith(undefined);
    });
});

describe('showTransitionOverrideDialog', () => {
    test('resolves the effect chosen in its body on OK', async () => {
        const input = armAppInput();
        const resultPromise = showTransitionOverrideDialog({
            title: 'Slide transition',
            value: undefined,
            inherited: { effect: 'move', sourceLabel: 'Slides preview' },
            description: 'Comes in with it.',
        });
        expect(input.call.title).toBe('Slide transition');
        expect(input.call.options).toEqual({
            escToCancel: true,
            enterToOk: true,
        });
        await render(input.call.body);
        expect(container.querySelector('small')!.textContent).toBe(
            'Comes in with it.',
        );
        await press(getCheckbox());
        // The body keeps its own state: ticked now, starting from `move`.
        expect(getCheckbox().checked).toBe(true);
        expect(getEffectButton('Slide In').getAttribute('aria-pressed')).toBe(
            'true',
        );
        await press(getEffectButton('Zoom'));
        expect(getEffectButton('Zoom').getAttribute('aria-pressed')).toBe(
            'true',
        );
        await input.answer(true);
        await expect(resultPromise).resolves.toEqual({ value: 'zoom' });
    });

    test('resolves an empty override when OK leaves the box unticked', async () => {
        const input = armAppInput();
        const resultPromise = showTransitionOverrideDialog({
            title: 'T',
            value: 'fade',
            inherited: { effect: 'zoom', sourceLabel: 'Screen setting' },
        });
        await render(input.call.body);
        expect(
            container.querySelector('.d-flex.flex-column > small'),
        ).toBeNull();
        expect(getCheckbox().checked).toBe(true);
        await press(getCheckbox());
        expect(getCheckbox().checked).toBe(false);
        await input.answer(true);
        await expect(resultPromise).resolves.toEqual({});
    });

    test('resolves null on Cancel', async () => {
        const input = armAppInput();
        const resultPromise = showTransitionOverrideDialog({
            title: 'T',
            value: 'fade',
            inherited: { effect: 'zoom', sourceLabel: 'Screen setting' },
        });
        await input.answer(false);
        await expect(resultPromise).resolves.toBeNull();
    });
});

describe('genTransitionMenuItem', () => {
    test('says what the item follows, or its own effect highlighted', () => {
        const onSelect = vi.fn();
        const following = genTransitionMenuItem({
            value: undefined,
            inherited: { effect: 'zoom', sourceLabel: 'Screen setting' },
            onSelect,
        });
        expect(following.menuElement).toBe('Transition: Zoom (Screen setting)');
        expect(following.title).toBe('Transition');
        expect(following.onSelect).toBe(onSelect);
        const followingIcon = following.childBefore as any;
        expect(followingIcon.props.className).toBe('bi bi-arrows-fullscreen');
        expect(followingIcon.props.style.color).toBe(
            'var(--bs-info-text-emphasis)',
        );

        const own = genTransitionMenuItem({
            value: 'none',
            inherited: { effect: 'zoom', sourceLabel: 'Screen setting' },
            onSelect,
        });
        expect(own.menuElement).toBe('Transition: No Transition');
        const ownIcon = own.childBefore as any;
        expect(ownIcon.props.className).toBe('bi bi-ban');
        expect(ownIcon.props.style.color).toBe(
            'var(--bs-warning-text-emphasis)',
        );

        const varying = genTransitionMenuItem({
            value: undefined,
            inherited: { effect: null, sourceLabel: 'Screen setting' },
            onSelect,
        });
        expect(varying.menuElement).toBe(
            'Transition: Varies by screen (Screen setting)',
        );
        expect((varying.childBefore as any).props.className).toBe(
            'bi bi-shadows',
        );
    });
});

describe('slide transition inheritance', () => {
    test('a slides preview follows the screen, a slide its slides preview first', () => {
        h.mocks.getCommonEffectType.mockReturnValue(null);
        expect(genSlidesPreviewInherited()).toEqual({
            effect: null,
            sourceLabel: 'Screen setting',
        });
        expect(h.mocks.getCommonEffectType).toHaveBeenCalledWith(
            'vary-app-document',
        );
        expect(genSlideInherited('zoom')).toEqual({
            effect: 'zoom',
            sourceLabel: 'Slides preview',
        });
        h.mocks.getCommonEffectType.mockReturnValue('move');
        expect(genSlideInherited(undefined)).toEqual({
            effect: 'move',
            sourceLabel: 'Screen setting',
        });
    });
});

describe('openSlideTransitionDialog', () => {
    test("asks for one slide's own transition and saves the answer", async () => {
        h.mocks.getAllTransitions.mockResolvedValue({
            self: 'fade',
            3: 'zoom',
        });
        const input = armAppInput();
        const done = openSlideTransitionDialog('/d/song.slides', 3);
        await flush();
        expect(h.mocks.getAllTransitions).toHaveBeenCalledWith(
            '/d/song.slides',
        );
        expect(input.call.title).toBe('Slide transition');
        expect(input.call.body.props.initialValue).toBe('zoom');
        expect(input.call.body.props.inherited).toEqual({
            effect: 'fade',
            sourceLabel: 'Slides preview',
        });
        expect(input.call.body.props.description).toBeUndefined();
        await input.answer(true);
        await done;
        expect(h.mocks.setTransition).toHaveBeenCalledWith(
            '/d/song.slides',
            3,
            'zoom',
        );
    });

    test('asks for the whole slides preview and removes an unticked one', async () => {
        h.mocks.getAllTransitions.mockResolvedValue({ self: 'move' });
        h.mocks.getCommonEffectType.mockReturnValue('none');
        const input = armAppInput();
        const done = openSlideTransitionDialog('/d/song.slides');
        await flush();
        expect(input.call.title).toBe('Slides preview transition');
        expect(input.call.body.props.initialValue).toBe('move');
        expect(input.call.body.props.inherited).toEqual({
            effect: 'none',
            sourceLabel: 'Screen setting',
        });
        expect(input.call.body.props.description).toBe(
            'Every slide of this document comes in with it, unless the slide has its own.',
        );
        await render(input.call.body);
        await press(getCheckbox());
        await input.answer(true);
        await done;
        expect(h.mocks.setTransition).toHaveBeenCalledWith(
            '/d/song.slides',
            undefined,
            undefined,
        );
    });

    test('changes nothing on Cancel', async () => {
        h.mocks.getAllTransitions.mockResolvedValue({});
        const input = armAppInput();
        const done = openSlideTransitionDialog('/d/song.slides', 'a');
        await flush();
        expect(input.call.body.props.initialValue).toBeUndefined();
        await input.answer(false);
        await done;
        expect(h.mocks.setTransition).not.toHaveBeenCalled();
    });
});

describe('useSlideTransition', () => {
    function ProbeComp({
        filePath,
        id,
    }: Readonly<{ filePath: string; id: number }>) {
        const state = useSlideTransition(filePath, id);
        return (
            <span
                data-own={state.own ?? '-'}
                data-document={state.documentOwn ?? '-'}
            />
        );
    }

    function readProbe() {
        const span = container.querySelector('span')!;
        return [span.dataset.own, span.dataset.document];
    }

    test('reads the sidecar in the presenter and re-reads it on its update', async () => {
        h.mocks.getAllTransitions.mockResolvedValue({
            self: 'move',
            2: 'none',
        });
        await render(<ProbeComp filePath="/d/a.slides" id={2} />);
        await flush();
        expect(readProbe()).toEqual(['none', 'move']);
        const [registration] = Array.from(h.state.fileSourceRegistrations);
        expect(registration.events).toEqual(['update']);
        expect(registration.filePath).toBe('/d/a.slides.transition.json');
        h.mocks.getAllTransitions.mockResolvedValue({ 2: 'fade' });
        await act(async () => {
            registration.fire();
        });
        await flush();
        expect(readProbe()).toEqual(['fade', '-']);
        expect(h.mocks.getAllTransitions).toHaveBeenCalledTimes(2);
    });

    test('reads nothing outside the presenter, update events included', async () => {
        h.state.isPagePresenter = false;
        h.mocks.getAllTransitions.mockResolvedValue({ self: 'move' });
        await render(<ProbeComp filePath="/d/a.slides" id={2} />);
        await flush();
        expect(readProbe()).toEqual(['-', '-']);
        const [registration] = Array.from(h.state.fileSourceRegistrations);
        await act(async () => {
            registration.fire();
        });
        await flush();
        expect(h.mocks.getAllTransitions).not.toHaveBeenCalled();
    });
});

describe('transition menu rows', () => {
    test('a slide card row is presenter-only and opens the slide dialog', async () => {
        h.state.isPagePresenter = false;
        expect(
            genSlideTransitionMenuItems('/d/a.slides', 5, {
                own: 'zoom',
                documentOwn: undefined,
            }),
        ).toEqual([]);
        h.state.isPagePresenter = true;
        const items = genSlideTransitionMenuItems('/d/a.slides', 5, {
            own: undefined,
            documentOwn: 'move',
        });
        expect(items).toHaveLength(1);
        expect(items[0].menuElement).toBe(
            'Transition: Slide In (Slides preview)',
        );
        h.mocks.getAllTransitions.mockResolvedValue({ self: 'move' });
        const input = armAppInput();
        items[0].onSelect!(undefined as any);
        await flush();
        expect(h.mocks.getAllTransitions).toHaveBeenCalledWith('/d/a.slides');
        expect(input.call.title).toBe('Slide transition');
        await input.answer(false);
    });

    test('a slides preview row reads the current state first', async () => {
        h.state.isPagePresenter = false;
        await expect(
            genDocumentTransitionMenuItems('/d/a.slides'),
        ).resolves.toEqual([]);
        expect(h.mocks.getAllTransitions).not.toHaveBeenCalled();
        h.state.isPagePresenter = true;
        h.mocks.getAllTransitions.mockResolvedValue({ self: 'none' });
        const items = await genDocumentTransitionMenuItems('/d/a.slides');
        expect(items).toHaveLength(1);
        expect(items[0].menuElement).toBe('Transition: No Transition');
        const input = armAppInput();
        items[0].onSelect!(undefined as any);
        await flush();
        expect(input.call.title).toBe('Slides preview transition');
        await input.answer(false);
    });
});

describe('transition badges', () => {
    test('the document badge shows its own override in the presenter only', async () => {
        h.mocks.getAllTransitions.mockResolvedValue({ self: 'zoom' });
        const cardClick = vi.fn();
        await render(
            <div onClick={cardClick}>
                <DocumentTransitionIconComp filePath="/d/a.slides" />
            </div>,
        );
        await flush();
        const badge = container.querySelector('button')!;
        expect(badge.title).toBe('Slides preview transition: Zoom');
        expect(badge.getAttribute('aria-label')).toBe(
            'Slides preview transition: Zoom',
        );
        expect(badge.querySelector('i')!.className).toBe(
            'bi bi-arrows-fullscreen',
        );
        const input = armAppInput();
        const isNotPrevented = await press(badge);
        expect(isNotPrevented).toBe(false);
        expect(cardClick).not.toHaveBeenCalled();
        await flush();
        expect(input.call.title).toBe('Slides preview transition');
        await input.answer(false);

        h.mocks.getAllTransitions.mockResolvedValue({});
        await render(<DocumentTransitionIconComp filePath="/d/b.slides" />);
        await flush();
        expect(container.innerHTML).toBe('');

        h.state.isPagePresenter = false;
        await render(<DocumentTransitionIconComp filePath="/d/c.slides" />);
        await flush();
        expect(container.innerHTML).toBe('');
    });

    test("a slide badge opens that slide's dialog on a right-click too", async () => {
        h.mocks.getAllTransitions.mockResolvedValue({ 4: 'move' });
        await render(
            <SlideTransitionIconComp
                filePath="/d/a.slides"
                id={4}
                effect="move"
            />,
        );
        const badge = container.querySelector('button')!;
        expect(badge.title).toBe('Slide transition: Slide In');
        const input = armAppInput();
        await press(badge, 'contextmenu');
        await flush();
        expect(input.call.title).toBe('Slide transition');
        expect(input.call.body.props.initialValue).toBe('move');
        await input.answer(false);
        await render(
            <SlideTransitionIconComp
                filePath="/d/a.slides"
                id={4}
                effect={undefined}
            />,
        );
        expect(container.innerHTML).toBe('');
    });
});
