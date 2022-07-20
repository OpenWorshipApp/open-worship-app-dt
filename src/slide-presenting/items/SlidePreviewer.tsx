import './SlidePreviewer.scss';

import SlideItemsPreviewer from './SlideItemsPreviewer';
import { renderFG } from '../../helper/presentingHelpers';
import {
    useSlideItemSelecting,
    useSlideItemSizing,
} from '../../event/SlideListEventListener';
import { presentEventListener } from '../../event/PresentEventListener';
import {
    THUMBNAIL_WIDTH_SETTING_NAME,
    DEFAULT_THUMBNAIL_SIZE,
} from '../../slide-list/slideHelpers';
import SlidePreviewerFooter from './SlidePreviewerFooter';
import Slide from '../../slide-list/Slide';
import { useSlideSelecting } from '../../event/PreviewingEventListener';
import { useEffect, useState } from 'react';
import SlideList from '../../slide-list/SlideList';
import SlideItemsMenu from './SlideItemsMenu';
import SlideItem from '../../slide-list/SlideItem';

export default function SlidePreviewer() {
    const [thumbSize, setThumbSize] = useSlideItemSizing(THUMBNAIL_WIDTH_SETTING_NAME,
        DEFAULT_THUMBNAIL_SIZE);
    const [slide, setSlide] = useState<Slide | null | undefined>(null);
    useSlideSelecting(()=>{
        setSlide(null);
    });
    useSlideItemSelecting(() => setSlide(null));
    useSlideItemSelecting((slideItem) => {
        if (slideItem !== null) {
            renderFG(slideItem.htmlString);
            presentEventListener.renderFG();
        } else {
            presentEventListener.clearFG();
        }
    });
    const reloadSlide = async (editingItem?: SlideItem) => {
        if (editingItem && slide) {
            slide.updateItem(editingItem);
        } else {
            const newSlide = await Slide.getSelected();
            setSlide(newSlide || undefined);
        }
    };
    useEffect(() => {
        if (slide === null) {
            reloadSlide();
        }
        if (slide) {
            const registerEvent = slide.fileSource.registerEventListener(
                ['select', 'update', 'edit', 'delete', 'refresh-dir'], ()=>{
                    setSlide(null);
                });
            return () => {
                slide.fileSource.unregisterEventListener(registerEvent);
            };
        }
    }, [slide]);
    if (!slide) {
        return (
            <SlideList />
        );
    }
    return (
        <div id='slide-previewer' className='card w-100 h-100'>
            <div className='card-body w-100 h-100 overflow-hidden'>
                <SlideItemsMenu slide={slide} />
                <SlideItemsPreviewer slide={slide} />
            </div>
            <SlidePreviewerFooter thumbnailSize={thumbSize}
                setThumbnailSize={(s) => setThumbSize(s)} />
        </div>
    );
}
