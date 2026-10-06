import { useSyncExternalStore } from 'react';
import appProvider from '../server/appProvider';
import { electronSendAsync } from '../server/electronSendHelpers';
import { tran } from '../lang/langHelpers';
import type { MirrorState } from '../../electron/screenMirrorProtocol';

// The service's reasons are English sentences; only these are worth showing
// as they are, anything else reads as a plain failure.
export function toMirrorErrorText(message: string) {
    if (message === 'Connection code is incorrect')
        return tran('Connection code is incorrect');
    if (message === 'Disconnected by host') return tran('Disconnected by host');
    if (message === 'Incompatible or duplicate connection')
        return tran('Incompatible or duplicate connection');
    return tran('Connection failed');
}

let state: MirrorState | null = null;
let panelShowing = false;
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
    return panelShowing;
}
export function setMirrorPanelShowing(value: boolean) {
    panelShowing = value;
    notify();
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
