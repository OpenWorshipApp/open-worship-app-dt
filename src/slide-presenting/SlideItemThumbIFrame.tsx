import './SlideItemThumb.scss';

import { ContextMenuEventType } from '../others/AppContextMenu';
import SlideItem from './SlideItem';
import { useEffect, useState } from 'react';
import HTML2React from '../slide-editing/HTML2React';
import FileSource from '../helper/FileSource';

export function SlideItemThumbIFrame({
    id, width, html2React,
}: { id: string, width: number, html2React: HTML2React }) {
    const height = width * html2React.height / html2React.width;
    const scaleX = width / html2React.width;
    const scaleY = height / html2React.height;
    return (
        <div style={{
            width, height,
            transform: `scale(${scaleX},${scaleY}) translate(50%, 50%)`,
        }}>
            <iframe title={id}
                frameBorder="0"
                style={{
                    pointerEvents: 'none',
                    borderStyle: 'none',
                    width: `${html2React.width}px`,
                    height: `${html2React.height}px`,
                    transform: 'translate(-50%, -50%)',
                }}
                srcDoc={`<style>html,body {overflow: hidden;}</style>${html2React.htmlString}`}
            />
        </div>
    );
}

type SlideItemThumbnailProps = {
    width: number,
    index: number;
    isActive: boolean;
    slideItemThumb: SlideItem;
    fileSource: FileSource,
    onItemClick: () => void,
    onContextMenu: (e: ContextMenuEventType) => void,
    onCopy: () => void,
    onDragStart: (e: React.DragEvent<HTMLDivElement>) => void,
    onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void,
};
export default function SlideItemThumbRender({
    width, isActive, index,
    slideItemThumb, fileSource,
    onItemClick,
    onContextMenu,
    onCopy,
    onDragStart,
    onDragEnd,
}: SlideItemThumbnailProps) {
    const html2React = HTML2React.parseHTML(slideItemThumb.html);
    return (
        <div className={`slide-item-thumb card ${isActive ? 'active' : ''} pointer`}
            draggable
            onDragStart={(e) => {
                const path = SlideItem.toSlideItemThumbSelected(fileSource, slideItemThumb.id) || '';
                e.dataTransfer.setData('text/plain', path);
                onDragStart(e);
            }}
            onDragEnd={(e) => {
                onDragEnd(e);
            }}
            style={{
                width: `${width}px`,
            }}
            onClick={() => {
                onItemClick();
            }}
            onContextMenu={(e) => onContextMenu(e)}
            onCopy={onCopy}>
            <div className="card-header d-flex">
                <div>
                    {index + 1} {isActive && <span>
                        <i className="bi bi-collection" />
                    </span>}
                </div>
                <div className='flex-fill d-flex justify-content-end'>
                    <small className='pe-2'>
                        {html2React.width}x{html2React.height}
                    </small>
                    <RenderIsEditing slideItemThumb={slideItemThumb} />
                </div>
            </div>
            <div className="card-body overflow-hidden"
                style={{ width, padding: '0px' }} >
                <SlideItemThumbIFrame
                    id={slideItemThumb.id}
                    width={width}
                    html2React={html2React} />
            </div>
        </div>
    );
}
function RenderIsEditing({ slideItemThumb }: { slideItemThumb: SlideItem }) {
    const [isEditing, setIsEditing] = useState(false);
    useEffect(() => {
        slideItemThumb.isEditing().then(setIsEditing);
    }, [slideItemThumb]);
    if (!isEditing) {
        return null;
    }
    return (
        <span style={{ color: 'red' }}>*</span>
    );
}
export function DragReceiver({ onDrop }: {
    onDrop: (id: string) => void,
}) {
    return (
        <div className='slide-item-thumb-drag-receiver'
            onDragOver={(event) => {
                event.preventDefault();
                (event.currentTarget as HTMLDivElement).style.opacity = '0.5';
            }}
            onDragLeave={(event) => {
                event.preventDefault();
                (event.currentTarget as HTMLDivElement).style.opacity = '0.1';
            }}
            onDrop={(event) => {
                const path = event.dataTransfer.getData('text');
                const result = SlideItem.extractSlideItemThumbSelected(path);
                onDrop(result.id);
            }}></div>
    );
}
export function ItemThumbGhost({ width }: { width: number }) {
    return (
        <div className='slide-item-thumb' style={{
            width: `${width}px`,
            visibility: 'hidden',
        }}></div>
    );
}