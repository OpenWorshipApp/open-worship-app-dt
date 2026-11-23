// @vitest-environment jsdom

// The popups are single-slot and chained: `HandleAlertComp` holds one confirm,
// one input and one alert, and a popup's close runs `openX(null)`. Every popup
// closes FIRST and only then runs the callback that may open the next one, so
// the next popup -- of the same type above all -- takes the slot after the
// close has gone through. Run the other way round, the close lands last and
// tears the popup just opened down, leaving its slot held and its question
// unanswerable. These walk real chains, through the real host, the real
// popups and the real `show*` calls, the way the app's callers `await` them.

import {
    act,
    createElement,
    Suspense,
    useEffect,
    useRef,
    type ReactNode,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: {
            isWindows: true,
            isMac: false,
            isLinux: false,
            isDev: false,
        },
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/appHooks', () => ({
    useAppEffect: useEffect,
    useAppCurrentRef: (value: unknown) => {
        const ref = useRef(value);
        ref.current = value;
        return ref;
    },
}));
vi.mock('../helper/helpers', () => ({
    cloneJson: <T,>(value: T) => structuredClone(value),
}));
vi.mock('../others/AppSuspenseComp', () => ({
    default: ({ children }: { children: ReactNode }) => {
        return createElement(Suspense, { fallback: null }, children);
    },
}));

type PopupHelpersType = typeof import('./popupWidgetHelpers');

const CONFIRM_ID = 'app-confirm-popup';
const INPUT_ID = 'app-input-popup';
const ALERT_ID = 'app-alert-popup';

let helpers: PopupHelpersType;
let container: HTMLDivElement;
let root: Root;

function nextTask() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

async function settle() {
    await act(async () => {
        await nextTask();
    });
}

function getPopup(id: string) {
    return document.getElementById(id);
}

function getTitle(id: string) {
    return getPopup(`${id}-title`)?.textContent ?? null;
}

// Every popup title on screen, whichever slot it is in.
function listShownTitles() {
    return [...document.querySelectorAll('.app-popup-header-title')].map(
        (element) => {
            return element.textContent;
        },
    );
}

// The one popup on screen is `title`, in the `id` slot, and nothing else is.
async function expectOnlyPopup(id: string, title: string) {
    for (let i = 0; i < 40 && getTitle(id) !== title; i++) {
        await settle();
    }
    expect(listShownTitles()).toEqual([title]);
    expect(getTitle(id)).toBe(title);
    return getPopup(id) as HTMLElement;
}

function expectNoPopup() {
    expect(listShownTitles()).toEqual([]);
    expect(getPopup(CONFIRM_ID)).toBeNull();
    expect(getPopup(INPUT_ID)).toBeNull();
    expect(getPopup(ALERT_ID)).toBeNull();
    expect(document.getElementById('modal-container')).toBeNull();
}

function buttonOf(popup: HTMLElement, text: string) {
    const button = [
        ...popup.querySelectorAll<HTMLButtonElement>(
            '.app-popup-footer button',
        ),
    ].find((element) => {
        return element.textContent === text;
    });
    expect(button).toBeDefined();
    return button as HTMLButtonElement;
}

async function click(element: HTMLElement) {
    await act(async () => {
        element.click();
        await nextTask();
    });
    await settle();
}

async function press(key: string) {
    await act(async () => {
        document.dispatchEvent(
            new KeyboardEvent('keydown', {
                key,
                code: key,
                bubbles: true,
                cancelable: true,
            }),
        );
        await nextTask();
    });
    await settle();
}

function track<T>(promise: Promise<T>) {
    const state: { isSettled: boolean; value?: T } = { isSettled: false };
    promise.then((value) => {
        state.isSettled = true;
        state.value = value;
    });
    return state;
}

beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    // A fresh copy of the popup modules per test: the slot lock is module
    // state, and a chain torn down leaves it held, which would wedge every
    // test after the one that failed instead of failing it alone.
    vi.resetModules();
    const { default: HandleAlertComp } = await import('./HandleAlertComp');
    // Loaded up front, so the host's lazy imports resolve at once.
    await Promise.all([
        import('./ConfirmPopupComp'),
        import('./InputPopupComp'),
        import('./AlertPopupComp'),
    ]);
    helpers = await import('./popupWidgetHelpers');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root.render(<HandleAlertComp />);
    });
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
    helpers.popupWidgetManager.openConfirm = null;
    helpers.popupWidgetManager.openInput = null;
    helpers.popupWidgetManager.openAlert = null;
});

describe('HandleAlertComp chains popups', () => {
    test('an alert whose Ok opens another alert hands it the slot', async () => {
        const { showAppAlert } = helpers;
        const chain = track(
            showAppAlert('First alert', 'One').then(() => {
                return showAppAlert('Second alert', 'Two');
            }),
        );

        let popup = await expectOnlyPopup(ALERT_ID, 'First alert');
        await click(buttonOf(popup, 'Ok'));

        // The first alert's own close must not take the second one with it.
        popup = await expectOnlyPopup(ALERT_ID, 'Second alert');
        expect(getPopup(`${ALERT_ID}-body`)?.textContent).toBe('Two');
        expect(chain.isSettled).toBe(false);

        await click(buttonOf(popup, 'Ok'));
        expect(chain.isSettled).toBe(true);
        expectNoPopup();
    });

    test('a confirm and alert chain shows each popup in turn, then none', async () => {
        const { showAppAlert, showAppConfirm } = helpers;
        const chain = track(
            (async () => {
                const answers: boolean[] = [];
                answers.push(await showAppConfirm('1: Confirm', 'Body'));
                answers.push(await showAppConfirm('2: Confirm', 'Body'));
                answers.push(await showAppConfirm('3: Confirm', 'Body'));
                await showAppAlert('4: Alert', 'Message');
                await showAppAlert('5: Alert', 'Message');
                answers.push(await showAppConfirm('6: Confirm', 'Body'));
                await showAppAlert('7: Alert', 'Message');
                return answers;
            })(),
        );

        // A confirm right after a confirm, answered by each of its buttons.
        let popup = await expectOnlyPopup(CONFIRM_ID, '1: Confirm');
        await click(buttonOf(popup, 'Ok'));
        popup = await expectOnlyPopup(CONFIRM_ID, '2: Confirm');
        await click(buttonOf(popup, 'Cancel'));
        await expectOnlyPopup(CONFIRM_ID, '3: Confirm');
        await press('Enter');

        // An alert right after an alert, then across to a confirm and back.
        popup = await expectOnlyPopup(ALERT_ID, '4: Alert');
        await click(buttonOf(popup, 'Ok'));
        await expectOnlyPopup(ALERT_ID, '5: Alert');
        await press('Enter');
        await expectOnlyPopup(CONFIRM_ID, '6: Confirm');
        await press('Escape');
        expect(chain.isSettled).toBe(false);

        popup = await expectOnlyPopup(ALERT_ID, '7: Alert');
        await click(popup.querySelector('.app-popup-close') as HTMLElement);
        expect(chain).toEqual({
            isSettled: true,
            value: [true, false, true, false],
        });
        expectNoPopup();
    });

    test('an input whose answer opens another input hands it the slot', async () => {
        const { showAppInput } = helpers;
        const chain = track(
            (async () => {
                const answers: boolean[] = [];
                answers.push(await showAppInput('1: Input', <input />));
                answers.push(await showAppInput('2: Input', <input />));
                answers.push(await showAppInput('3: Input', <input />));
                return answers;
            })(),
        );

        let popup = await expectOnlyPopup(INPUT_ID, '1: Input');
        await click(buttonOf(popup, 'Ok'));
        popup = await expectOnlyPopup(INPUT_ID, '2: Input');
        await click(buttonOf(popup, 'Cancel'));
        await expectOnlyPopup(INPUT_ID, '3: Input');
        await press('Escape');
        expect(chain).toEqual({
            isSettled: true,
            value: [true, false, false],
        });
        expectNoPopup();
    });
});
