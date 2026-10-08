import { useSyncExternalStore } from 'react';
import appProvider from '../server/appProvider';
import { electronSendAsync } from '../server/electronSendHelpers';
import { tran } from '../lang/langHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import type { MirrorState } from '../../electron/screenMirrorProtocol';

// The service's reasons are English sentences; only these are worth showing
// as they are, anything else reads as a plain failure.
export function toMirrorErrorText(message: string) {
    if (message === 'Connection code is incorrect')
        return tran('Connection code is incorrect');
    if (message === 'Disconnected by host') return tran('Disconnected by host');
    if (message === 'Incompatible or duplicate connection')
        return tran('Incompatible or duplicate connection');
    if (message === 'Invalid host or port') return tran('Invalid host or port');
    if (message === 'Too many hosts') return tran('Too many hosts');
    if (message === 'Too many wrong codes. Try again later.')
        return tran('Too many wrong codes. Try again later.');
    if (message === 'Too many connection requests. Try again later.')
        return tran('Too many connection requests. Try again later.');
    return tran('Connection failed');
}

let state: MirrorState | null = null;
// The Virtual Screens Manager panel: whether it is open and on which tab,
// both kept across reloads and launches. Read on first ask, not at import.
export type VirtualScreensManagerTabType = 'mirror' | 'virtual';
const PANEL_SHOWING_SETTING_NAME = 'virtual-screens-manager-showing';
const PANEL_TAB_SETTING_NAME = 'virtual-screens-manager-tab';
let panelShowing: boolean | null = null;
let panelTab: VirtualScreensManagerTabType | null = null;
const listeners = new Set<() => void>();
let listening = false;
function notify() {
    for (const listener of listeners) listener();
}
export function getMirrorState() {
    if (!listening) {
        listening = true;
        appProvider.messageUtils.listenForData(
            'mirror:state',
            (_, value: MirrorState) => {
                state = value;
                notify();
            },
        );
        state = appProvider.messageUtils.sendDataSync('mirror:state') ?? null;
    }
    return state;
}
function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
export function useMirrorState() {
    return useSyncExternalStore(subscribe, getMirrorState, () => null);
}
export function getMirrorPanelShowing() {
    panelShowing ??= getSetting(PANEL_SHOWING_SETTING_NAME) === 'true';
    return panelShowing;
}
export function getMirrorPanelTab(): VirtualScreensManagerTabType {
    panelTab ??=
        getSetting(PANEL_TAB_SETTING_NAME) === 'virtual' ? 'virtual' : 'mirror';
    return panelTab;
}
export function setMirrorPanelTab(tab: VirtualScreensManagerTabType) {
    panelTab = tab;
    setSetting(PANEL_TAB_SETTING_NAME, tab);
    notify();
}
// Opens or closes the panel, on a given tab when one is named.
export function setMirrorPanelShowing(
    value: boolean,
    tab?: VirtualScreensManagerTabType,
) {
    panelShowing = value;
    setSetting(PANEL_SHOWING_SETTING_NAME, value ? 'true' : 'false');
    if (tab !== undefined) {
        setMirrorPanelTab(tab);
        return;
    }
    notify();
}
export function useMirrorPanelTab() {
    return useSyncExternalStore(
        subscribe,
        getMirrorPanelTab,
        (): VirtualScreensManagerTabType => 'mirror',
    );
}
export function useMirrorPanelShowing() {
    return useSyncExternalStore(subscribe, getMirrorPanelShowing, () => false);
}
export function mirrorCommand<T = MirrorState>(
    action: string,
    options: Record<string, any> = {},
) {
    return electronSendAsync<T>('mirror:command', { action, ...options });
}
