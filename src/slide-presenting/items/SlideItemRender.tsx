import './SlideItemRender.scss';

import { ContextMenuEventType } from '../../others/AppContextMenu';
import SlideItem from '../../slide-list/SlideItem';
import SlideItemIFrame from './SlideItemIFrame';
import RenderIsEditing from '../RenderIsEditing';
import { useSlideItemDim } from '../../slide-list/slideHelpers';

export default function SlideItemRender({
    width, index,
    slideItem,
    onContextMenu,
    onCopy,
    onDragStart,
    onDragEnd,
}: {
    width: number,
    index: number;
    slideItem: SlideItem;
    onContextMenu: (e: ContextMenuEventType) => void,
    onCopy: () => void,
    onDragStart: (e: React.DragEvent<HTMLDivElement>) => void,
    onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void,
}) {
    const canvasDim = useSlideItemDim(slideItem);
    return (
        <div className={`slide-item card ${slideItem.isSelected ? 'active' : ''} pointer`}
            draggable
            onDragStart={(e) => {
                const path = slideItem.toSelectedItemSetting();
                if (path !== null) {
                    e.dataTransfer.setData('text/plain', path);
                    onDragStart(e);
                }
            }}
            onDragEnd={(e) => {
                onDragEnd(e);
            }}
            style={{
                width: `${width}px`,
            }}
            onClick={() => {
                slideItem.isSelected = !slideItem.isSelected;
            }}
            onContextMenu={(e) => onContextMenu(e)}
            onCopy={onCopy}>
            <div className="card-header d-flex">
                <div>
                    {index + 1} {slideItem.isSelected && <span>
                        <i className="bi bi-collection" />
                    </span>}
                </div>
                <div className='flex-fill d-flex justify-content-end'>
                    <small className='pe-2'>
                        {canvasDim.width}x{canvasDim.height}
                    </small>
                    <RenderIsEditing index={index}
                        slideItem={slideItem} />
                </div>
            </div>
            <div className="card-body w-100 h-100 overflow-hidden"
                style={{ width, padding: '0px' }} >
                <SlideItemIFrame id={slideItem.id}
                    width={width} canvasDim={canvasDim} />
            </div>
        </div>
    );
}
