import { useRef, type DependencyList } from 'react';

import { useAppEffect } from '../helper/debuggerHelpers';
import type Lyric from '../lyric-list/Lyric';
import type AppDocument from '../app-document-list/AppDocument';
import type { ListenerType } from './EventHandler';
import EventHandler from './EventHandler';
import type BibleItem from '../bible-list/BibleItem';
import type { VaryAppDocumentType } from '../app-document-list/appDocumentTypeHelpers';

export type PreviewingType =
    | 'select-lyric'
    | 'showing-bible-item'
    | 'update-lyric'
    | 'select-app-document'
    | 'update-app-document';

class PreviewingEventListener extends EventHandler<PreviewingType> {
    static readonly eventNamePrefix: string = 'previewing';
    showBibleItem(bibleItem: BibleItem) {
        this.addPropEvent('showing-bible-item', bibleItem);
    }
    updateLyric(lyric: Lyric) {
        this.addPropEvent('update-lyric', lyric);
    }
    showLyric(lyric: Lyric | null) {
        this.addPropEvent('select-lyric', lyric);
    }
    showVaryAppDocument(varyAppDocument: VaryAppDocumentType | null) {
        this.addPropEvent('select-app-document', varyAppDocument);
    }
    updateVaryAppDocument(varyAppDocument: VaryAppDocumentType) {
        this.addPropEvent('update-app-document', varyAppDocument);
    }
}

export const previewingEventListener = new PreviewingEventListener();

export function useLyricSelecting(
    listener: ListenerType<Lyric | null>,
    deps: DependencyList,
) {
    useAppEffect(() => {
        const event = previewingEventListener.registerEventListener(
            ['select-lyric'],
            listener,
        );
        return () => {
            previewingEventListener.unregisterEventListener(event);
        };
    }, deps);
}

export function useBibleItemShowing(
    listener: ListenerType<Lyric | null>,
    deps: DependencyList,
) {
    useAppEffect(() => {
        const event = previewingEventListener.registerEventListener(
            ['showing-bible-item'],
            listener,
        );
        return () => {
            previewingEventListener.unregisterEventListener(event);
        };
    }, deps);
}

export function useLyricUpdating(listener: ListenerType<Lyric>) {
    const listenerRef = useRef(listener);
    listenerRef.current = listener;
    useAppEffect(() => {
        const event = previewingEventListener.registerEventListener(
            ['update-lyric'],
            (lyric: Lyric) => {
                listenerRef.current(lyric);
            },
        );
        return () => {
            previewingEventListener.unregisterEventListener(event);
        };
    }, []);
}

export function useVaryAppDocumentSelecting(
    listener: ListenerType<AppDocument | null>,
) {
    const listenerRef = useRef(listener);
    listenerRef.current = listener;
    useAppEffect(() => {
        const event = previewingEventListener.registerEventListener(
            ['select-app-document'],
            (varyAppDocument: AppDocument | null) => {
                listenerRef.current(varyAppDocument);
            },
        );
        return () => {
            previewingEventListener.unregisterEventListener(event);
        };
    }, []);
}

export function useVaryAppDocumentUpdating(
    listener: ListenerType<AppDocument>,
) {
    const listenerRef = useRef(listener);
    listenerRef.current = listener;
    useAppEffect(() => {
        const event = previewingEventListener.registerEventListener(
            ['update-app-document'],
            (varyAppDocument: AppDocument) => {
                listenerRef.current(varyAppDocument);
            },
        );
        return () => {
            previewingEventListener.unregisterEventListener(event);
        };
    }, []);
}

export default PreviewingEventListener;
