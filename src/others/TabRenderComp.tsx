import type { ReactNode, LazyExoticComponent, MouseEvent } from 'react';
import { useCallback } from 'react';

import AppSuspenseComp from './AppSuspenseComp';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import { useScreenUpdateEvents } from '../_screen/managers/screenManagerHooks';
import type { OptionalPromise } from '../helper/typeHelpers';

export type TabHeaderPropsType<T> = {
    key: T;
    title: string;
    className?: string;
    checkIsOnScreen?: (key: T) => OptionalPromise<boolean>;
};

function useIsOnScreen<T>(tab: TabHeaderPropsType<T>) {
    const [isOnScreen, setIsOnScreen] = useAppStateAsync(() => {
        if (tab.checkIsOnScreen === undefined) {
            return false;
        }
        return tab.checkIsOnScreen(tab.key);
    }, [tab.key]);
    useScreenUpdateEvents(undefined, async () => {
        if (tab.checkIsOnScreen === undefined) {
            return;
        }
        const isOnScreen = await tab.checkIsOnScreen(tab.key);
        setIsOnScreen(isOnScreen);
    });
    return isOnScreen;
}

function RendTabComp<T>({
    tab,
    setActiveTab,
    activeTabs,
}: Readonly<{
    tab: TabHeaderPropsType<T>;
    setActiveTab?: (key: T, event: MouseEvent<HTMLButtonElement>) => void;
    activeTabs: T[];
}>) {
    const activeClass = activeTabs.includes(tab.key) ? 'active' : '';
    const isOnScreen = useIsOnScreen(tab);
    const handleClick = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            setActiveTab?.(tab.key, event);
        },
        [setActiveTab, tab.key],
    );
    return (
        <li key={tab.title} className={'nav-item ' + (tab.className ?? '')}>
            <button
                className={
                    `btn btn-sm btn-link nav-link ${activeClass}` +
                    (isOnScreen ? ' app-on-screen' : '')
                }
                onClick={handleClick}
                onContextMenu={handleClick}
            >
                {tab.title}
            </button>
        </li>
    );
}

export default function TabRenderComp<T extends string>({
    tabs,
    activeTabs,
    setActiveTab,
    className,
}: Readonly<{
    tabs: TabHeaderPropsType<T>[];
    activeTabs: T[];
    setActiveTab?: (key: T, event: MouseEvent<HTMLButtonElement>) => void;
    className?: string;
}>) {
    return (
        <ul
            className={`nav nav-tabs ${className} d-flex flex-nowrap`}
            style={{
                overflowY: 'hidden',
                overflowX: 'auto',
            }}
        >
            {tabs.map((tab) => {
                return (
                    <RendTabComp
                        key={tab.key}
                        tab={tab}
                        activeTabs={activeTabs}
                        setActiveTab={setActiveTab}
                    />
                );
            })}
        </ul>
    );
}

export function genTabBody<T>(
    selectedTabTab: T,
    [tabTab, Element]: [T, LazyExoticComponent<() => ReactNode | null>],
) {
    return (
        <AppSuspenseComp key={`tab-${tabTab}`}>
            {selectedTabTab === tabTab ? <Element /> : null}
        </AppSuspenseComp>
    );
}
