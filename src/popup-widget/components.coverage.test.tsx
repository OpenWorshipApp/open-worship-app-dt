// @vitest-environment jsdom

// The popups end to end through their real host: `HandleAlertComp` mounts the
// confirm / input / alert a `show*` call asks for, the popup takes the
// keyboard from the app underneath, and the promise resolves to what the
// button or key said. The keys go through the REAL `KeyboardEventListener`
// (a keydown on the document), so the layer a popup claims is the one tested.

import {
    act,
    createElement,
    Suspense,
    useEffect,
    useRef,
    type ReactNode,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterAll,
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: {
            isWindows: true,
            isMac: false,
            isLinux: false,
            isDev: true,
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

import HandleAlertComp from './HandleAlertComp';
// Loaded up front, so the host's lazy imports resolve at once.
import './ConfirmPopupComp';
import './InputPopupComp';
import './AlertPopupComp';
import {
    popupWidgetManager,
    showAppAlert,
    showAppConfirm,
    showAppInput,
} from './popupWidgetHelpers';
import {
    askForArchivePassword,
    askForNewArchivePassword,
} from './ArchivePasswordComp';
import KeyboardEventListener, {
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { checkIsKeyboardLayerClaimed } from '../event/keyboardLayerHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const CONFIRM_ID = 'app-confirm-popup';
const INPUT_ID = 'app-input-popup';
const ALERT_ID = 'app-alert-popup';

const rootShortcut = vi.fn();

// An app shortcut registered the ordinary way, on the layer on top at mount.
function RootShortcutComp() {
    useKeyboardRegistering(
        [{ key: 'F6' }],
        () => {
            rootShortcut();
        },
        [],
    );
    return null;
}

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

async function waitFor(check: () => boolean) {
    for (let i = 0; i < 40 && !check(); i++) {
        await settle();
    }
    expect(check()).toBe(true);
}

function getPopup(id: string) {
    return document.getElementById(id);
}

async function waitForPopup(id: string, title?: string) {
    await waitFor(() => {
        const titleText = document.getElementById(`${id}-title`)?.textContent;
        return (
            getPopup(id) !== null &&
            (title === undefined || titleText === title)
        );
    });
    return getPopup(id) as HTMLElement;
}

function track<T>(promise: Promise<T>) {
    const state: { isSettled: boolean; value?: T } = { isSettled: false };
    promise.then((value) => {
        state.isSettled = true;
        state.value = value;
    });
    return state;
}

function buttonOf(popup: HTMLElement, text: string) {
    const button = [
        ...popup.querySelectorAll<HTMLButtonElement>('button'),
    ].find((element) => {
        return element.textContent === text;
    });
    expect(button).toBeDefined();
    return button as HTMLButtonElement;
}

function footerLabels(popup: HTMLElement) {
    return [...popup.querySelectorAll('.app-popup-footer button')].map(
        (element) => {
            return element.textContent;
        },
    );
}

async function click(element: HTMLElement) {
    await act(async () => {
        element.click();
        await nextTask();
    });
    await settle();
}

async function press(key: string) {
    const event = new KeyboardEvent('keydown', {
        key,
        code: key,
        bubbles: true,
        cancelable: true,
    });
    await act(async () => {
        document.dispatchEvent(event);
        await nextTask();
    });
    await settle();
    return event;
}

function typeInto(input: HTMLInputElement, value: string) {
    const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    act(() => {
        setValue.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

function fieldOf(label: string) {
    return getPopup(INPUT_ID)?.querySelector<HTMLInputElement>(
        `input[aria-label="${label}"]`,
    ) as HTMLInputElement;
}

beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root.render(
            <>
                <RootShortcutComp />
                <HandleAlertComp />
            </>,
        );
    });
});

afterEach(async () => {
    // A test that failed half way must not leave the popup slot held.
    if (getPopup(CONFIRM_ID) !== null) {
        popupWidgetManager.openConfirm?.(null);
    }
    if (getPopup(INPUT_ID) !== null) {
        popupWidgetManager.openInput?.(null);
    }
    if (getPopup(ALERT_ID) !== null) {
        popupWidgetManager.openAlert?.(null);
    }
    await settle();
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

afterAll(() => {
    popupWidgetManager.openConfirm = null;
    popupWidgetManager.openInput = null;
    popupWidgetManager.openAlert = null;
    delete (globalThis as any).tryPopup;
});

describe('a confirm', () => {
    test('shows its question clean, holds the keyboard, and answers Ok', async () => {
        const answer = track(
            showAppConfirm(
                'Delete the slide?',
                '<b>It goes</b><script>window.hacked = 1</script>',
                {
                    confirmButtonLabel: 'Delete',
                    cancelButtonLabel: 'Keep',
                    extraStyles: { color: 'blue' },
                },
            ),
        );
        const popup = await waitForPopup(CONFIRM_ID);
        expect(popup.getAttribute('role')).toBe('alertdialog');
        expect(popup.style.color).toBe('blue');
        expect(getPopup(`${CONFIRM_ID}-title`)?.textContent).toBe(
            'Delete the slide?',
        );
        const body = getPopup(`${CONFIRM_ID}-body`) as HTMLElement;
        expect(body.querySelector('b')?.textContent).toBe('It goes');
        expect(body.querySelector('script')).toBeNull();
        expect(footerLabels(popup)).toEqual(['Keep', 'Delete']);
        expect(checkIsKeyboardLayerClaimed('popup')).toBe(true);
        expect(KeyboardEventListener.getLastLayer()).toBe('popup');
        // The app's own shortcut is silent while the question waits.
        await press('F6');
        expect(rootShortcut).not.toHaveBeenCalled();

        await click(buttonOf(popup, 'Delete'));
        expect(answer).toEqual({ isSettled: true, value: true });
        expect(getPopup(CONFIRM_ID)).toBeNull();
        expect(checkIsKeyboardLayerClaimed('popup')).toBe(false);
        expect(KeyboardEventListener.getLastLayer()).toBe('root');
        await press('F6');
        expect(rootShortcut).toHaveBeenCalledOnce();
    });

    test('Cancel, the header close and Escape answer no; Enter answers yes', async () => {
        const ask = async () => {
            const answer = track(showAppConfirm('Clear the screen?', 'Body'));
            const popup = await waitForPopup(CONFIRM_ID);
            return { answer, popup };
        };
        let asked = await ask();
        expect(footerLabels(asked.popup)).toEqual(['Cancel', 'Ok']);
        await click(buttonOf(asked.popup, 'Cancel'));
        expect(asked.answer).toEqual({ isSettled: true, value: false });
        expect(getPopup(CONFIRM_ID)).toBeNull();

        asked = await ask();
        const close = asked.popup.querySelector(
            '.app-popup-close',
        ) as HTMLElement;
        expect(close.getAttribute('aria-label')).toBe('Close');
        await click(close);
        expect(asked.answer).toEqual({ isSettled: true, value: false });
        expect(getPopup(CONFIRM_ID)).toBeNull();

        asked = await ask();
        const escape = await press('Escape');
        expect(escape.defaultPrevented).toBe(true);
        expect(asked.answer).toEqual({ isSettled: true, value: false });
        expect(getPopup(CONFIRM_ID)).toBeNull();

        asked = await ask();
        await press('Enter');
        expect(asked.answer).toEqual({ isSettled: true, value: true });
        expect(getPopup(CONFIRM_ID)).toBeNull();
    });

    test('that opts out of Escape and Enter waits for a button', async () => {
        const answer = track(
            showAppConfirm('Overwrite?', 'Body', {
                escToCancel: false,
                enterToOk: false,
            }),
        );
        const popup = await waitForPopup(CONFIRM_ID);
        const escape = await press('Escape');
        await press('Enter');
        expect(escape.defaultPrevented).toBe(false);
        expect(answer.isSettled).toBe(false);
        expect(getPopup(CONFIRM_ID)).toBe(popup);
        await click(buttonOf(popup, 'Ok'));
        expect(answer).toEqual({ isSettled: true, value: true });
    });

    test('a third answer runs its own step, then closes as a no', async () => {
        const onExtraButtonClick = vi.fn();
        const answer = track(
            showAppConfirm('A tip', <em id="tip-body">Read me</em>, {
                extraButtonLabel: 'Hide for 30 days',
                onExtraButtonClick,
            }),
        );
        const popup = await waitForPopup(CONFIRM_ID);
        // An element body is mounted as it is, not as HTML text.
        expect(
            getPopup(`${CONFIRM_ID}-body`)?.querySelector('#tip-body')
                ?.textContent,
        ).toBe('Read me');
        expect(footerLabels(popup)).toEqual([
            'Hide for 30 days',
            'Cancel',
            'Ok',
        ]);
        await click(buttonOf(popup, 'Hide for 30 days'));
        expect(onExtraButtonClick).toHaveBeenCalledOnce();
        expect(answer).toEqual({ isSettled: true, value: false });
        expect(getPopup(CONFIRM_ID)).toBeNull();
    });
});

describe('an input', () => {
    test('is held back by canConfirm, then Ok or Enter answers yes', async () => {
        let isReady = false;
        const canConfirm = vi.fn(() => {
            return isReady;
        });
        const answer = track(
            showAppInput(
                'Rename',
                <input id="rename-field" defaultValue="Old" />,
                { canConfirm, extraStyles: { width: '300px' } },
            ),
        );
        const popup = await waitForPopup(INPUT_ID);
        expect(popup.getAttribute('role')).toBe('dialog');
        expect(popup.style.width).toBe('300px');
        expect(getPopup(`${INPUT_ID}-title`)?.textContent).toBe('Rename');
        expect(
            popup.querySelector<HTMLInputElement>('#rename-field')?.value,
        ).toBe('Old');
        expect(footerLabels(popup)).toEqual(['Cancel', 'Ok']);
        expect(KeyboardEventListener.getLastLayer()).toBe('popup');

        await click(buttonOf(popup, 'Ok'));
        await press('Enter');
        expect(canConfirm).toHaveBeenCalledTimes(2);
        expect(answer.isSettled).toBe(false);
        expect(getPopup(INPUT_ID)).toBe(popup);

        isReady = true;
        await press('Enter');
        expect(answer).toEqual({ isSettled: true, value: true });
        expect(getPopup(INPUT_ID)).toBeNull();
        expect(KeyboardEventListener.getLastLayer()).toBe('root');
    });

    test('Cancel, the header close and Escape answer no', async () => {
        const ask = async () => {
            const answer = track(showAppInput('Name', <input />));
            const popup = await waitForPopup(INPUT_ID);
            return { answer, popup };
        };
        let asked = await ask();
        await click(buttonOf(asked.popup, 'Cancel'));
        expect(asked.answer).toEqual({ isSettled: true, value: false });

        asked = await ask();
        await click(
            asked.popup.querySelector('.app-popup-close') as HTMLElement,
        );
        expect(asked.answer).toEqual({ isSettled: true, value: false });

        asked = await ask();
        const escape = await press('Escape');
        expect(escape.defaultPrevented).toBe(true);
        expect(asked.answer).toEqual({ isSettled: true, value: false });
        expect(getPopup(INPUT_ID)).toBeNull();
    });

    test('that opts out of Escape and Enter waits for a button', async () => {
        const answer = track(
            showAppInput('Name', <input />, {
                escToCancel: false,
                enterToOk: false,
            }),
        );
        const popup = await waitForPopup(INPUT_ID);
        const escape = await press('Escape');
        await press('Enter');
        expect(escape.defaultPrevented).toBe(false);
        expect(answer.isSettled).toBe(false);
        await click(buttonOf(popup, 'Ok'));
        expect(answer).toEqual({ isSettled: true, value: true });
    });
});

describe('an alert', () => {
    test('shows its message clean and closes on Ok, Enter, Escape or its header', async () => {
        const show = async () => {
            const closed = track(
                showAppAlert(
                    'Saved',
                    'All <b>three</b> files<script>window.hacked = 1</script>',
                ),
            );
            const popup = await waitForPopup(ALERT_ID);
            return { closed, popup };
        };
        let shown = await show();
        expect(shown.popup.getAttribute('role')).toBe('alertdialog');
        expect(getPopup(`${ALERT_ID}-title`)?.textContent).toBe('Saved');
        const body = getPopup(`${ALERT_ID}-body`) as HTMLElement;
        expect(body.textContent).toBe('All three files');
        expect(body.querySelector('script')).toBeNull();
        expect(footerLabels(shown.popup)).toEqual(['Ok']);
        expect(checkIsKeyboardLayerClaimed('popup')).toBe(true);
        await click(buttonOf(shown.popup, 'Ok'));
        expect(shown.closed).toEqual({ isSettled: true, value: undefined });
        expect(getPopup(ALERT_ID)).toBeNull();
        expect(checkIsKeyboardLayerClaimed('popup')).toBe(false);

        shown = await show();
        const enter = await press('Enter');
        expect(enter.defaultPrevented).toBe(true);
        expect(shown.closed.isSettled).toBe(true);

        shown = await show();
        await press('Escape');
        expect(shown.closed.isSettled).toBe(true);

        shown = await show();
        await click(
            shown.popup.querySelector('.app-popup-close') as HTMLElement,
        );
        expect(shown.closed.isSettled).toBe(true);
        expect(getPopup(ALERT_ID)).toBeNull();
    });
});

describe('the dev tryPopup', () => {
    test('walks a confirm, two alerts, a confirm and an alert in turn', async () => {
        const tryPopup = (globalThis as any).tryPopup as () => Promise<void>;
        expect(typeof tryPopup).toBe('function');
        const done = track(tryPopup());

        let popup = await waitForPopup(CONFIRM_ID, '1: Confirm Title');
        expect(popup.style.color).toBe('blue');
        expect(footerLabels(popup)).toEqual(['Cancel', 'Yes, proceed']);
        await click(buttonOf(popup, 'Yes, proceed'));

        // The same kind of popup asked right after the last one closed.
        popup = await waitForPopup(ALERT_ID, '2: Alert Title');
        await click(buttonOf(popup, 'Ok'));
        popup = await waitForPopup(ALERT_ID, '3: Alert Title');
        await press('Enter');

        popup = await waitForPopup(CONFIRM_ID, '4: Confirm Title');
        await press('Escape');
        expect(done.isSettled).toBe(false);

        popup = await waitForPopup(ALERT_ID, '5: Alert Title');
        await click(popup.querySelector('.app-popup-close') as HTMLElement);
        expect(done.isSettled).toBe(true);
        expect(getPopup(CONFIRM_ID)).toBeNull();
        expect(getPopup(ALERT_ID)).toBeNull();
    });
});

describe('the archive password questions', () => {
    test('a new password is asked twice and given back once both agree', async () => {
        const answer = track(askForNewArchivePassword('Export Data'));
        const popup = await waitForPopup(INPUT_ID, 'Export Data');
        expect(popup.textContent).toContain(
            'Leave empty to export without a password',
        );
        typeInto(fieldOf('Password'), 'secret');
        typeInto(fieldOf('Confirm Password'), 'secret');
        expect(popup.textContent).not.toContain('Passwords do not match');
        await click(buttonOf(popup, 'Ok'));
        expect(answer).toEqual({ isSettled: true, value: 'secret' });
        expect(getPopup(INPUT_ID)).toBeNull();
    });

    test('a mismatch asks again, and fixing the confirmation alone is enough', async () => {
        const answer = track(askForNewArchivePassword('Export Data'));
        let popup = await waitForPopup(INPUT_ID);
        typeInto(fieldOf('Password'), 'secret');
        typeInto(fieldOf('Confirm Password'), 'secert');
        expect(popup.textContent).toContain('Passwords do not match');
        await click(buttonOf(popup, 'Ok'));
        expect(answer.isSettled).toBe(false);

        popup = await waitForPopup(INPUT_ID);
        // The dialog comes back with what was typed still in it.
        expect(fieldOf('Password').value).toBe('secret');
        expect(fieldOf('Confirm Password').value).toBe('secert');
        expect(popup.textContent).toContain('Passwords do not match');
        typeInto(fieldOf('Confirm Password'), 'secret');
        expect(popup.textContent).not.toContain('Passwords do not match');
        await click(buttonOf(popup, 'Ok'));
        expect(answer).toEqual({ isSettled: true, value: 'secret' });
    });

    test('three mismatches give up, Cancel gives up, and both empty means none', async () => {
        let answer = track(askForNewArchivePassword('Export Data'));
        for (let attempt = 0; attempt < 3; attempt++) {
            const popup = await waitForPopup(INPUT_ID);
            expect(answer.isSettled).toBe(false);
            typeInto(fieldOf('Password'), `one-${attempt}`);
            typeInto(fieldOf('Confirm Password'), `two-${attempt}`);
            await click(buttonOf(popup, 'Ok'));
        }
        expect(answer).toEqual({ isSettled: true, value: null });
        expect(getPopup(INPUT_ID)).toBeNull();

        answer = track(askForNewArchivePassword('Export Data'));
        await waitForPopup(INPUT_ID);
        typeInto(fieldOf('Password'), 'secret');
        await press('Escape');
        expect(answer).toEqual({ isSettled: true, value: null });

        answer = track(askForNewArchivePassword('Export Data'));
        await waitForPopup(INPUT_ID);
        await press('Enter');
        expect(answer).toEqual({ isSettled: true, value: '' });
    });

    test('an archive being read asks once, under its default or own complaint', async () => {
        let answer = track(askForArchivePassword('Import Data'));
        let popup = await waitForPopup(INPUT_ID, 'Import Data');
        expect(fieldOf('Confirm Password')).toBeNull();
        expect(popup.textContent).toContain(
            'This archive is password protected',
        );
        expect(popup.textContent).not.toContain('Leave empty');
        typeInto(fieldOf('Password'), 'open sesame');
        await press('Enter');
        expect(answer).toEqual({ isSettled: true, value: 'open sesame' });

        answer = track(
            askForArchivePassword('Import Data', 'Wrong password, try again'),
        );
        popup = await waitForPopup(INPUT_ID);
        expect(popup.textContent).toContain('Wrong password, try again');
        expect(popup.textContent).not.toContain(
            'This archive is password protected',
        );
        // Nothing typed is no password to try.
        await click(buttonOf(popup, 'Ok'));
        expect(answer).toEqual({ isSettled: true, value: null });

        answer = track(askForArchivePassword('Import Data'));
        popup = await waitForPopup(INPUT_ID);
        typeInto(fieldOf('Password'), 'open sesame');
        await click(buttonOf(popup, 'Cancel'));
        expect(answer).toEqual({ isSettled: true, value: null });
    });
});
