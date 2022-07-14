import './SlideItemEditorPreviewer.scss';

import { useEffect, useState } from 'react';
import { useSlideItemSelecting } from '../event/SlideListEventListener';
import SlideItem from '../slide-list/SlideItem';
import SlideItemEditor from './SlideItemEditor';
import { useSlideSelecting } from '../event/PreviewingEventListener';

export default function SlideItemEditorGround() {
    const [slideItem, setSlideItem] = useState<SlideItem | null | undefined>(null);
    const reloadSlide = async () => {
        const newSlide = await SlideItem.getSelectedItem();
        setSlideItem(newSlide || undefined);
    };
    useEffect(() => {
        if (slideItem === null) {
            reloadSlide();
        }
        if (slideItem) {
            const registerEvent = slideItem.fileSource.registerEventListener(
                ['select', 'delete'], reloadSlide);
            return () => {
                slideItem.fileSource.unregisterEventListener(registerEvent);
            };
        }
    }, [slideItem]);
    useSlideSelecting(() => setSlideItem(null));
    useSlideItemSelecting(setSlideItem);
    if (!slideItem) {
        return (
            <div className='slide-item-editor empty'
                style={{ fontSize: '3em', padding: '20px' }}>
                No Slide Item Selected 😐
            </div>
        );
    }
    return (
        <SlideItemEditor slideItem={slideItem} />
    );
}
