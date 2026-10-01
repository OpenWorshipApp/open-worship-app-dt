import type { CSSProperties, ReactNode } from 'react';

import type { OptionalPromise } from '../helper/typeHelpers';
import appProvider from '../server/appProvider';
import { tran } from '../lang/langHelpers';
import { genLabelIcon } from '../others/labelIconHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';

export type TabOptionType = {
    title: ReactNode;
    routePath: string;
    preCheck?: () => OptionalPromise<boolean>;
    // Replaces navigating to `routePath` when the tab is pressed.
    onOpen?: () => void;
    // The "open in a new window" icon beside the tab. Rendered as its own
    // button NEXT to the tab, never inside it: nested in the tab's button it
    // was invalid markup, absent from the accessibility tree and unreachable
    // by keyboard.
    externalOpen?: {
        title: string;
        color?: string;
        onOpen: () => void;
    };
};

export enum WindowModEnum {
    Editor = 0,
    presenter = 1,
    reader = 2,
}

export function toTitleExternal(title: string, style?: CSSProperties) {
    return (
        <span style={style}>
            {genLabelIcon(title)}
            {tran(title) + ' '}
        </span>
    );
}

const PATH_NAME_SETTING_NAME = 'last-page-location';
export function goToPath(pathname?: string) {
    if (!pathname) {
        pathname =
            getSetting(PATH_NAME_SETTING_NAME) || appProvider.presenterHomePage;
    }
    if (pathname.startsWith(appProvider.currentHomePage)) {
        pathname = appProvider.presenterHomePage;
    }
    const url = new URL(globalThis.location.href);
    url.pathname = pathname;
    setSetting(PATH_NAME_SETTING_NAME, appProvider.currentHomePage);
    globalThis.location.href = url.href;
}
