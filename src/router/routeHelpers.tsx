import { OptionalPromise } from '../helper/typeHelpers';
import appProvider from '../server/appProvider';

export type TabOptionType = {
    title: React.ReactNode;
    routePath: string;
    preCheck?: () => OptionalPromise<boolean>;
};

export enum WindowModEnum {
    Editor = 0,
    presenter = 1,
    reader = 2,
}

export function toTitleExternal(title: string, style?: React.CSSProperties) {
    return (
        <span style={style}>
            {title + ' '}
            <i className="bi bi-box-arrow-up-right" />
        </span>
    );
}

export const presenterTab: TabOptionType = {
    title: toTitleExternal('Presenter', {
        color: 'var(--app-color-presenter)',
    }),
    routePath: appProvider.presenterHomePage,
};
export const readerTab: TabOptionType = {
    title: (
        <span
            style={{
                color: 'var(--app-color-reader)',
            }}
        >
            <i className="bi bi-book px-1" />
            {toTitleExternal('Bible Reader')}
        </span>
    ),
    routePath: appProvider.readerHomePage,
};
export const experimentTab: TabOptionType = {
    title: toTitleExternal('(dev)Experiment'),
    routePath: appProvider.experimentHomePage,
};

const PATH_NAME_SETTING_NAME = 'last-page-location';
export function goToPath(pathname?: string) {
    if (!pathname) {
        pathname =
            window.localStorage.getItem(PATH_NAME_SETTING_NAME) ||
            appProvider.presenterHomePage;
    }
    if (pathname.startsWith(appProvider.currentHomePage)) {
        pathname = appProvider.presenterHomePage;
    }
    const url = new URL(window.location.href);
    url.pathname = pathname;
    window.localStorage.setItem(
        PATH_NAME_SETTING_NAME,
        appProvider.currentHomePage,
    );
    window.location.href = url.href;
}
