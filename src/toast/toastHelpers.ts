import { JSX } from 'react';

import ToastEventListener from '../event/ToastEventListener';

export function showSimpleToast(title: string, message: string | JSX.Element) {
    ToastEventListener.showSimpleToast({ title, message });
}
