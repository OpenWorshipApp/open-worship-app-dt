import { ReactNode, LazyExoticComponent, useMemo } from 'react';

import { tran } from '../lang/langHelpers';
import AppSuspenseComp from './AppSuspenseComp';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import { useScreenUpdateEvents } from '../_screen/managers/screenManagerHooks';
import { OptionalPromise } from '../helper/typeHelpers';

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
    activeTab,
}: Readonly<{
    tab: TabHeaderPropsType<T>;
    setActiveTab?: (key: T) => void;
    activeTab: T;
}>) {
    const activeClass = useMemo(() => {
        return activeTab === tab.key ? 'active' : '';
    }, [activeTab, tab.key]);
    const isOnScreen = useIsOnScreen(tab);
    return (
        <li key={tab.title} className={'nav-item ' + (tab.className ?? '')}>
            <button
                className={
                    `btn btn-link nav-link ${activeClass}` +
                    (isOnScreen ? ' app-on-screen' : '')
                }
                onClick={() => {
                    setActiveTab?.(tab.key);
                }}
            >
                {tran(tab.title)}
            </button>
        </li>
    );
}

export default function TabRenderComp<T extends string>({
    tabs,
    activeTab,
    setActiveTab,
    className,
}: Readonly<{
    tabs: TabHeaderPropsType<T>[];
    activeTab: T;
    setActiveTab?: (key: T) => void;
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
                        activeTab={activeTab}
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
