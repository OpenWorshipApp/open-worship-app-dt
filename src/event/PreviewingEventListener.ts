import { useEffect } from 'react';
import BibleItem from '../bible-list/BibleItem';
import {
    setIsPreviewingBible, setIsPreviewingLyric,
} from '../full-text-present/FullTextPreviewer';
import Lyric from '../lyric-list/Lyric';
import Slide from '../slide-list/Slide';
import EventHandler, { ListenerType } from './EventHandler';

export type PreviewingType =
    'select-bible-item'
    | 'select-lyric'
    | 'update-lyric'
    | 'select-slide'
    | 'update-slide';

export default class PreviewingEventListener extends EventHandler<PreviewingType> {
    selectBibleItem(bibleItem: BibleItem | null) {
        if (bibleItem !== null) {
            setIsPreviewingBible();
        }
        this.addPropEvent('select-bible-item', bibleItem);
    }
    selectLyric(lyric: Lyric | null) {
        if (lyric !== null) {
            setIsPreviewingLyric();
        }
        this.addPropEvent('select-lyric', lyric);
    }
    updateLyric(lyric: Lyric) {
        this.addPropEvent('update-lyric', lyric);
    }
    presentSlide(slide: Slide | null) {
        this.addPropEvent('select-slide', slide);
    }
    updateSlide(slide: Slide) {
        this.addPropEvent('update-slide', slide);
    }
}

export const previewingEventListener = new PreviewingEventListener();

export function useBibleItemSelecting(listener: ListenerType<BibleItem | null>) {
    useEffect(() => {
        const event = previewingEventListener.registerEventListener(
            ['select-bible-item'], listener);
        return () => {
            previewingEventListener.unregisterEventListener(event);
        };
    });
}
export function useLyricSelecting(listener: ListenerType<Lyric | null>) {
    useEffect(() => {
        const event = previewingEventListener.registerEventListener(
            ['select-lyric'], listener);
        return () => {
            previewingEventListener.unregisterEventListener(event);
        };
    });
}
export function useLyricUpdating(listener: ListenerType<Lyric>) {
    useEffect(() => {
        const event = previewingEventListener.registerEventListener(
            ['update-lyric'], listener);
        return () => {
            previewingEventListener.unregisterEventListener(event);
        };
    });
}
export function useSlideSelecting(listener: ListenerType<Slide | null>) {
    useEffect(() => {
        const event = previewingEventListener.registerEventListener(
            ['select-slide'], listener);
        return () => {
            previewingEventListener.unregisterEventListener(event);
        };
    });
}
export function useSlideUpdating(listener: ListenerType<Slide>) {
    useEffect(() => {
        const event = previewingEventListener.registerEventListener(
            ['update-slide'], listener);
        return () => {
            previewingEventListener.unregisterEventListener(event);
        };
    });
}
export function useFullTextOpening(listener: ListenerType<void>) {
    useEffect(() => {
        const eventLyric = previewingEventListener.registerEventListener(
            ['select-lyric'], listener);
        const eventBible = previewingEventListener.registerEventListener(
            ['select-bible-item'], listener);
        return () => {
            previewingEventListener.unregisterEventListener(eventLyric);
            previewingEventListener.unregisterEventListener(eventBible);
        };
    });
}
