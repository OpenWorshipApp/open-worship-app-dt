import { createContext } from 'react';
import {
    useLocation, useNavigate, NavigateFunction, Location,
} from 'react-router-dom';
import { getSetting, setSetting } from '../helper/settingHelper';
import appProvider from '../server/appProvider';

export type TabCheckPropsType = {
    navigate: NavigateFunction,
    location: Location,
}

export type TabOptionType = {
    title: string,
    tabClassName?: string,
    routePath: string,
    checkIsActive?: (_: TabCheckPropsType) => boolean,
}

export enum WindowModEnum {
    'editing' = 0,
    'presenting' = 1,
    'reading' = 2,
}

function checkIsActive(routePath: string, routeProps: TabCheckPropsType) {
    const { location } = routeProps;
    const pathArray = location.pathname.split('/').filter((item) => {
        return item !== '';
    });
    routePath = routePath.split('/').filter((item) => {
        return item !== '';
    }).join('/');
    const isActive = pathArray.indexOf(routePath) === 0;
    return isActive;
}
function genTabItem(title: string, routePath: string): TabOptionType {
    return {
        title, routePath,
        checkIsActive: checkIsActive.bind(null, routePath),
    };
}

export const home: TabOptionType = {
    title: 'Home',
    routePath: '/',
};
export const editingTab = genTabItem('Editing', '/edit');
export const presentingTab = genTabItem('Presenting', '/present');
export const readingTab = genTabItem('Read', '/reading');

export function goEditingMode(navigate: NavigateFunction) {
    navigate(editingTab.routePath);
}

export const WindowModeContext = createContext<WindowModEnum | null>(null);
export const DefaultTabContext = createContext<TabOptionType[] | null>(null);

export function genWindowMode(props?: TabCheckPropsType): WindowModEnum | null {
    if (props === undefined) {
        props = {
            location: window.location as any as Location,
            navigate: window.navigator as any as NavigateFunction,
        };
    }
    if (editingTab.checkIsActive?.(props)) {
        return WindowModEnum.editing;
    } else if (presentingTab.checkIsActive?.(props)) {
        return WindowModEnum.presenting;
    } else if (readingTab.checkIsActive?.(props)) {
        return WindowModEnum.reading;
    }
    return null;
}
export function useWindowMode(): WindowModEnum | null {
    let location = useLocation();
    location = location.state?.backgroundLocation || location;
    const props = {
        location,
        navigate: useNavigate(),
    };
    return genWindowMode(props);
}

function checkIsWindowMode(
    targetMode: WindowModEnum,
    mode?: WindowModEnum | null,
) {
    mode = mode || genWindowMode();
    return mode === targetMode;
}
export function checkIsWindowEditingMode(mode?: WindowModEnum | null) {
    return checkIsWindowMode(WindowModEnum.editing, mode);
}
export function useWindowIsEditingMode() {
    const windowType = useWindowMode();
    return checkIsWindowEditingMode(windowType);
}
export function checkIsWindowPresentingMode(mode?: WindowModEnum | null) {
    return checkIsWindowMode(WindowModEnum.presenting, mode);
}
export function useWindowIsPresentingMode() {
    const windowType = useWindowMode();
    return checkIsWindowPresentingMode(windowType);
}
export function checkIsWindowReadingMode(mode?: WindowModEnum | null) {
    return checkIsWindowMode(WindowModEnum.reading, mode);
}
export function useWindowIsReadingMode() {
    const windowType = useWindowMode();
    return checkIsWindowReadingMode(windowType);
}

export function goToPath(pathname: string) {
    const url = new URL(window.location.href);
    url.pathname = pathname;
    window.location.href = url.href;
}
export function goHomeBack() {
    goToPath(presentingTab.routePath);
}

const ROUTE_PATHNAME_KEY = 'route-pathname';

export function checkHome() {
    const url = new URL(window.location.href);
    if (url.pathname === '/') {
        if (appProvider.isDesktop) {
            const savePathname = getSetting(ROUTE_PATHNAME_KEY);
            if (savePathname !== '') {
                return goToPath(savePathname);
            }
        }
        goHomeBack();
    }
}

export function savePathname(location: { pathname: string }) {
    if (appProvider.isDesktop) {
        setSetting(ROUTE_PATHNAME_KEY, location.pathname);
    }
}
