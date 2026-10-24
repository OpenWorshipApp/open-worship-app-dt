import { type JSX } from 'react';

import ToastEventListener from '../event/ToastEventListener';
import appProvider from '../server/appProvider';
import type { SimpleToastType } from './SimpleToastComp';

function emitSimpleToast(toast: SimpleToastType) {
    ToastEventListener.showSimpleToast(toast);
}

/**
 * `timeout` is for a toast that carries a control of its own (an Undo): the
 * default four seconds is not enough time to reach it. Hovering still holds any
 * toast open.
 */
export function showSimpleToast(
    title: string,
    message: string | JSX.Element,
    timeout?: number,
) {
    emitSimpleToast(
        timeout === undefined
            ? { title, message }
            : { title, message, timeout },
    );
}

/**
 * Returns a function whose later calls replace its previous toast. This is for
 * one operation that changes state (for example, downloading -> downloaded),
 * so a toast held open by hover cannot keep showing stale progress.
 */
export function createSimpleToastUpdater() {
    const replacementKey = Symbol('simple-toast-replacement');
    return (title: string, message: string | JSX.Element, timeout?: number) => {
        emitSimpleToast({ title, message, timeout, replacementKey });
    };
}

if (appProvider.systemUtils.isDev) {
    // `globalThis`, not Node's `global`: a page with no Node (a Screen Show
    // copy in its iframe) loads this too.
    (globalThis as any).testSimpleToasts = async () => {
        showSimpleToast('1: Test Title', 'This is a test message');
        await new Promise((resolve) => setTimeout(resolve, 500)); // wait 500ms between toasts
        showSimpleToast(
            '2: Another Test Title',
            'This is another test message',
        );
        await new Promise((resolve) => setTimeout(resolve, 500)); // wait 500ms between toasts
        showSimpleToast(
            '3: Yet Another Test Title',
            'This is yet another test message',
        );
    };
}
