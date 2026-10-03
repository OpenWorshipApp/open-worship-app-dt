import { type JSX } from 'react';

import ToastEventListener from '../event/ToastEventListener';
import appProvider from '../server/appProvider';

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
    ToastEventListener.showSimpleToast(
        timeout === undefined
            ? { title, message }
            : { title, message, timeout },
    );
}

if (appProvider.systemUtils.isDev) {
    (global as any).testSimpleToasts = async () => {
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
