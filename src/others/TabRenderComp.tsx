import type { ReactNode, LazyExoticComponent, MouseEvent } from 'react';
import { useCallback } from 'react';

import AppSuspenseComp from './AppSuspenseComp';
import { useAppStateAsync, useAppCurrentRef } from '../helper/appHooks';
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
    const setActiveTabRef = useAppCurrentRef(setActiveTab);
    const tabRef = useAppCurrentRef(tab);
    const handleClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
        setActiveTabRef.current?.(tabRef.current.key, event);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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
    className = '',
    isVertical = false,
}: Readonly<{
    tabs: TabHeaderPropsType<T>[];
    activeTabs: T[];
    setActiveTab?: (key: T, event: MouseEvent<HTMLButtonElement>) => void;
    className?: string;
    isVertical?: boolean;
}>) {
    return (
        <ul
            className={
                'nav d-flex flex-nowrap ' +
                (isVertical ? 'flex-column' : 'nav-tabs') +
                ` ${className}`
            }
            style={
                isVertical
                    ? { overflowY: 'auto', overflowX: 'hidden' }
                    : { overflowY: 'hidden', overflowX: 'auto' }
            }
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
