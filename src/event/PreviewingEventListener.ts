import type { DependencyList } from 'react';

import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
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
    const listenerRef = useAppCurrentRef(listener);
    useAppEffect(() => {
        const event = previewingEventListener.registerEventListener(
            ['update-lyric'],
            (lyric: Lyric, time: number) => {
                listenerRef.current(lyric, time);
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
    const listenerRef = useAppCurrentRef(listener);
    useAppEffect(() => {
        const event = previewingEventListener.registerEventListener(
            ['select-app-document'],
            (varyAppDocument: AppDocument | null, time: number) => {
                listenerRef.current(varyAppDocument, time);
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
    const listenerRef = useAppCurrentRef(listener);
    useAppEffect(() => {
        const event = previewingEventListener.registerEventListener(
            ['update-app-document'],
            (varyAppDocument: AppDocument, time: number) => {
                listenerRef.current(varyAppDocument, time);
            },
        );
        return () => {
            previewingEventListener.unregisterEventListener(event);
        };
    }, []);
}

export default PreviewingEventListener;
