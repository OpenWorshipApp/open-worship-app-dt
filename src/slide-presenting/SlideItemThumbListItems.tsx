import {
    KeyEnum,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { WindowEnum } from '../event/WindowEventListener';
import {
    slideListEventListenerGlobal,
    useThumbSizing,
} from '../event/SlideListEventListener';
import { isWindowEditingMode } from '../App';
import { Fragment, useState } from 'react';
import SlideThumbsController, { DEFAULT_THUMB_SIZE, THUMB_WIDTH_SETTING_NAME } from './SlideThumbsController';
import SlideItemThumb from './SlideItemThumb';
import SlideItemThumbRender, { DragReceiver, ItemThumbGhost } from './SlideItemThumbIFrame';

export default function SlideItemThumbListItems({ controller }: {
    controller: SlideThumbsController,
}) {
    const [thumbSize] = useThumbSizing(THUMB_WIDTH_SETTING_NAME, DEFAULT_THUMB_SIZE);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    if (!isWindowEditingMode()) {
        const arrows = [KeyEnum.ArrowRight, KeyEnum.ArrowLeft];
        const arrowListener = (e: KeyboardEvent) => {
            const selectedIndex = controller.selectedIndex;
            if (selectedIndex === null) {
                return;
            }
            const length = controller.items.length;
            if (length) {
                let ind = e.key === KeyEnum.ArrowLeft ? selectedIndex - 1 : selectedIndex + 1;
                if (ind >= length) {
                    ind = 0;
                } else if (ind < 0) {
                    ind = length - 1;
                }
                controller.select((controller.getItemByIndex(+ind) as SlideItemThumb).id);
            }
        };
        const useCallback = (key: KeyEnum) => {
            useKeyboardRegistering({
                key,
                layer: WindowEnum.Root,
            }, arrowListener);
        };
        arrows.forEach(useCallback);
    }
    return (
        <div className='d-flex flex-wrap justify-content-center'>
            {controller.items.map((item, i) => {
                const shouldReceiveAtLeft = draggingIndex !== null && draggingIndex !== 0 && i === 0;
                const shouldReceiveAtRight = draggingIndex !== null && draggingIndex !== i && draggingIndex !== i + 1;
                return (
                    <Fragment key={`${i}`}>
                        {shouldReceiveAtLeft && <DragReceiver onDrop={(id) => {
                            controller.move(id, i);
                        }} />}
                        <SlideItemThumbRender
                            isActive={i === controller.selectedIndex}
                            index={i}
                            slideItemThumb={item}
                            slideFilePath={controller.filePath}
                            onItemClick={() => {
                                slideListEventListenerGlobal.selectSlideItemThumb(item);
                                controller.select(item.id);
                            }}
                            onContextMenu={(e) => controller.showItemThumbnailContextMenu(e, i)}
                            onCopy={() => {
                                controller.copiedIndex = i;
                            }}
                            width={thumbSize}
                            onDragStart={() => {
                                setDraggingIndex(i);
                            }}
                            onDragEnd={() => {
                                setDraggingIndex(null);
                            }}
                        />
                        {shouldReceiveAtRight && <DragReceiver onDrop={(id) => {
                            controller.move(id, i);
                        }} />}
                    </Fragment>
                );
            })}
            {Array.from({ length: 2 }, (_, i) => <ItemThumbGhost key={`${i}`}
                width={thumbSize} />)}
        </div>
    );
}
