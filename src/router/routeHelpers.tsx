import { CSSProperties, ReactNode } from 'react';

import type { OptionalPromise } from '../helper/typeHelpers';
import appProvider from '../server/appProvider';
import { tran } from '../lang/langHelpers';

export type TabOptionType = {
    title: ReactNode;
    routePath: string;
    preCheck?: () => OptionalPromise<boolean>;
};

export enum WindowModEnum {
    Editor = 0,
    presenter = 1,
    reader = 2,
}

export function toTitleExternal(title: string, style?: CSSProperties) {
    return (
        <span style={style}>
            {tran(title) + ' '}
            <i className="bi bi-box-arrow-up-right" />
        </span>
    );
}

const PATH_NAME_SETTING_NAME = 'last-page-location';
export function goToPath(pathname?: string) {
    if (!pathname) {
        pathname =
            globalThis.localStorage.getItem(PATH_NAME_SETTING_NAME) ||
            appProvider.presenterHomePage;
    }
    if (pathname.startsWith(appProvider.currentHomePage)) {
        pathname = appProvider.presenterHomePage;
    }
    const url = new URL(globalThis.location.href);
    url.pathname = pathname;
    globalThis.localStorage.setItem(
        PATH_NAME_SETTING_NAME,
        appProvider.currentHomePage,
    );
    globalThis.location.href = url.href;
}
