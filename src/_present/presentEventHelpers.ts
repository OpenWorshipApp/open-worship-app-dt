import { useState, useEffect } from 'react';
import appProviderPresent from './appProviderPresent';
import PresentBGManager, {
    PresentBGManagerEventType,
} from './PresentBGManager';
import {
    PresentMessageType,
    sendPresentMessage,
} from './presentHelpers';
import PresentManager, {
    PresentManagerEventType,
} from './PresentManager';

export function usePMEvents(events: PresentManagerEventType[],
    presentManager?: PresentManager,
    callback?: () => void) {
    const [n, setN] = useState(0);
    useEffect(() => {
        const update = () => {
            setN(n + 1);
            callback?.();
        };
        const instanceEvents = presentManager?.registerEventListener(events, update) || [];
        const staticEvents = PresentManager.registerEventListener(events, update);
        return () => {
            presentManager?.unregisterEventListener(instanceEvents);
            PresentManager.unregisterEventListener(staticEvents);
        };
    }, [presentManager, n]);
}

export function usePBGMEvents(events: PresentBGManagerEventType[],
    presentBGManager?: PresentBGManager,
    callback?: () => void) {
    const [n, setN] = useState(0);
    useEffect(() => {
        const update = () => {
            setN(n + 1);
            callback?.();
        };
        const instanceEvents = presentBGManager?.registerEventListener(events, update) || [];
        const staticEvents = PresentBGManager.registerEventListener(events, update);
        return () => {
            presentBGManager?.unregisterEventListener(instanceEvents);
            PresentBGManager.unregisterEventListener(staticEvents);
        };
    }, [presentBGManager, n]);
}

const messageUtils = appProviderPresent.messageUtils;
const channel = messageUtils.channels.presentMessageChannel;
messageUtils.listenForData(channel,
    (_, message: PresentMessageType) => {
        PresentManager.receiveSyncPresent(message);
    });
if (appProviderPresent.isPresent) {
    const presentId = PresentManager.getAllInstances()[0]?.presentId || 0;
    sendPresentMessage({
        presentId,
        type: 'init',
        data: null,
    });
}