import { useEffect, useState } from 'react';
import fullTextPresentHelper from '../full-text-present/previewingHelper';
import { getPresentRendered } from '../helper/appHelper';
import { getAllDisplays } from '../helper/displayHelper';
import { clearBackground, clearForeground } from '../helper/presentingHelpers';
import { useStateSettingBoolean } from '../helper/settingHelper';
import SlideItem from '../slide-list/SlideItem';
import EventHandler from './EventHandler';

export type PresentEventType =
    'hide'
    | 'render-bg'
    | 'clear-bg'
    | 'render-fg'
    | 'clear-fg'
    | 'render-ft'
    | 'clear-ft'
    | 'ctrl-scrolling'
    | 'change-bible'
    | 'display-changed';

type AsyncListenerType<T> = ((data: T) => Promise<void>) | (() => Promise<void>);
type ListenerType<T> = ((data: T) => void) | (() => void);
export type RegisteredEventType<T> = {
    type: PresentEventType,
    listener: ListenerType<T>,
}

export default class PresentEventListener extends EventHandler<PresentEventType> {
    fireHideEvent() {
        this._addPropEvent('hide');
    }
    renderBG() {
        this._addPropEvent('render-bg');
    }
    clearBG() {
        clearBackground();
        this._addPropEvent('clear-bg');
    }
    renderFG() {
        this._addPropEvent('render-fg');
    }
    clearFG() {
        SlideItem.setSelectedItem(null);
        clearForeground();
        this._addPropEvent('clear-fg');
    }
    renderFT() {
        this._addPropEvent('render-fg');
    }
    clearFT(isEvent?: boolean) {
        if (!isEvent) {
            fullTextPresentHelper.hide();
        }
        this._addPropEvent('clear-ft');
    }
    presentCtrlScrolling(isUp: boolean) {
        const fontSize = fullTextPresentHelper.textFontSize + (isUp ? 1 : -1);
        fullTextPresentHelper.setStyle({ fontSize });
        this._addPropEvent('ctrl-scrolling', isUp);
    }
    changeBible(isNext: boolean) {
        this._addPropEvent('change-bible', isNext);
    }
    displayChanged() {
        this._addPropEvent('display-changed');
    }
    registerPresentEventListener(type: PresentEventType,
        listener: ListenerType<any>): RegisteredEventType<any> {
        this._addOnEventListener(type, listener);
        return {
            type,
            listener,
        };
    }
    unregisterPresentEventListener({ type, listener }: RegisteredEventType<any>) {
        this._removeOnEventListener(type, listener);
    }
}

export const presentEventListener = new PresentEventListener();

export function usePresentHiding(listener: ListenerType<void>) {
    useEffect(() => {
        const event = presentEventListener.registerPresentEventListener(
            'hide', listener);
        return () => {
            presentEventListener.unregisterPresentEventListener(event);
        };
    });
}
export function usePresentBGRendering() {
    const [isPresenting, setIsShowing] = useStateSettingBoolean('bgfg-control-bg');
    getPresentRendered().then((rendered) => {
        setIsShowing(!!rendered.background);
    });
    useEffect(() => {
        const eventRender = presentEventListener.registerPresentEventListener(
            'render-bg', () => setIsShowing(true));
        const eventClear = presentEventListener.registerPresentEventListener(
            'clear-bg', () => setIsShowing(false));
        return () => {
            presentEventListener.unregisterPresentEventListener(eventRender);
            presentEventListener.unregisterPresentEventListener(eventClear);
        };
    });
    return isPresenting;
}
export function usePresentBGClearing(listener: ListenerType<boolean>) {
    useEffect(() => {
        const eventClear = presentEventListener.registerPresentEventListener(
            'clear-bg', listener);
        return () => {
            presentEventListener.unregisterPresentEventListener(eventClear);
        };
    });
}
export function usePresentFGRendering() {
    const [isPresenting, setIsShowing] = useStateSettingBoolean('bgfg-control-fg');
    getPresentRendered().then((rendered) => {
        setIsShowing(!!rendered.foreground);
    });
    useEffect(() => {
        const eventRender = presentEventListener.registerPresentEventListener(
            'render-fg', () => setIsShowing(true));
        const eventClear = presentEventListener.registerPresentEventListener(
            'clear-fg', () => setIsShowing(false));
        return () => {
            presentEventListener.unregisterPresentEventListener(eventRender);
            presentEventListener.unregisterPresentEventListener(eventClear);
        };
    });
    return isPresenting;
}
export function usePresentFGClearing(listener: ListenerType<boolean>) {
    useEffect(() => {
        const eventClear = presentEventListener.registerPresentEventListener(
            'clear-fg', listener);
        return () => {
            presentEventListener.unregisterPresentEventListener(eventClear);
        };
    });
}
export function usePresentFTRendering() {
    const [isPresenting, setIsShowing] = useStateSettingBoolean('bgfg-control-ft');
    getPresentRendered().then((rendered) => {
        setIsShowing(!!rendered.fullText);
    });
    useEffect(() => {
        const eventRender = presentEventListener.registerPresentEventListener(
            'render-fg', () => setIsShowing(true));
        const eventClear = presentEventListener.registerPresentEventListener(
            'clear-ft', () => setIsShowing(false));
        return () => {
            presentEventListener.unregisterPresentEventListener(eventRender);
            presentEventListener.unregisterPresentEventListener(eventClear);
        };
    });
    return isPresenting;
}
export function usePresentFTClearing(listener: ListenerType<boolean>) {
    useEffect(() => {
        const eventClear = presentEventListener.registerPresentEventListener(
            'clear-ft', listener);
        return () => {
            presentEventListener.unregisterPresentEventListener(eventClear);
        };
    });
}
export function usePresentCtrlScrolling(listener: ListenerType<boolean>) {
    useEffect(() => {
        const event = presentEventListener.registerPresentEventListener(
            'ctrl-scrolling', listener);
        return () => {
            presentEventListener.unregisterPresentEventListener(event);
        };
    });
}
export function useChangingBible(listener: AsyncListenerType<boolean>) {
    useEffect(() => {
        const event = presentEventListener.registerPresentEventListener(
            'change-bible', listener);
        return () => {
            presentEventListener.unregisterPresentEventListener(event);
        };
    });
}
export function useDisplay() {
    const [displays, setDisplays] = useState(getAllDisplays());
    useEffect(() => {
        const event = presentEventListener.registerPresentEventListener(
            'display-changed', () => setDisplays(getAllDisplays()));
        return () => {
            presentEventListener.unregisterPresentEventListener(event);
        };
    });
    return displays;
}
