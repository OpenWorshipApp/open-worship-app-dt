import { useSyncExternalStore } from 'react';

import appProvider from '../server/appProvider';
import { electronSendAsync } from '../server/electronSendHelpers';
import { tran } from '../lang/langHelpers';
import type { VirtualDisplayState } from '../../electron/virtualDisplayProtocol';

// The Virtual Displays tab's view of the main process, read the first time the
// tab asks and kept current by `vd:state` pushes after that.
let state: VirtualDisplayState | null = null;
let isListening = false;
const listeners = new Set<() => void>();

function notify() {
    for (const listener of listeners) {
        listener();
    }
}

export function getVirtualDisplayState() {
    if (!isListening) {
        isListening = true;
        appProvider.messageUtils.listenForData(
            'vd:state',
            (_event, value: VirtualDisplayState) => {
                state = value;
                notify();
            },
        );
        state = appProvider.messageUtils.sendDataSync('vd:state') ?? null;
    }
    return state;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function useVirtualDisplayState() {
    return useSyncExternalStore(subscribe, getVirtualDisplayState, () => null);
}

export async function virtualDisplayCommand(
    action: string,
    options: Record<string, unknown> = {},
) {
    const value = await electronSendAsync<VirtualDisplayState>('vd:command', {
        action,
        ...options,
    });
    state = value;
    notify();
    return value;
}

// The service's reasons are English sentences; these read as they are.
export function toVirtualDisplayErrorText(message: string) {
    if (message === 'Too many virtual displays') {
        return tran('Too many virtual displays');
    }
    if (message === 'Virtual display not found') {
        return tran('Virtual display not found');
    }
    if (message === 'TV not found') {
        return tran('That TV was not found. Search again.');
    }
    if (message === 'Let other devices watch is off') {
        return tran('Turn on “Let other devices watch” to cast to a TV.');
    }
    if (message === 'This computer cannot make MP4 video') {
        return tran('This computer cannot make MP4 video');
    }
    if (message === 'The virtual display stopped recording') {
        return tran('The virtual display stopped recording');
    }
    if (message === 'Unable to turn on HTTPS') {
        return tran('Unable to turn on HTTPS');
    }
    return tran('The virtual display stopped');
}
