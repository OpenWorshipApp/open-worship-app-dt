import './BackgroundListItemComp.scss';

import type { KeyboardEvent, ReactNode } from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import ShowingScreenIcon from '../_screen/preview/ShowingScreenIcon';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import { pressElementLikeButton } from '../helper/helpers';

const backgroundTypeIconMap: { [key: string]: string } = {
    image: 'file-earmark-image',
    video: 'file-earmark-play',
    web: 'globe2',
    audio: 'file-earmark-music',
    camera: 'camera-video',
};

// Enter/Space on a media tile or row press it the way a click does. Only a
// key aimed at the tile itself: an audio tile holds a real <audio controls>
// and every tile a ⋮ and a colour note, whose own keys are their own.
export function handleBackgroundTileKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target === event.currentTarget) {
        pressElementLikeButton(event);
    }
}

// Name-only row used by the "List View" mode. It deliberately renders no
// thumbnail: on a folder of hundreds of files that keeps every <img>/<video>
// out of memory, which is the whole point of the mode on low-spec machines.
export default function BackgroundListItemComp({
    backgroundType,
    name,
    title,
    selectedCN,
    src,
    isDraggable,
    selectedBackgroundSrcList,
    onDragStart,
    onContextMenu,
    onClick,
    colorNoteChild,
}: Readonly<{
    backgroundType: string;
    name: string;
    title: string;
    selectedCN: string;
    src: string;
    isDraggable: boolean;
    selectedBackgroundSrcList: [string, BackgroundSrcType][];
    onDragStart?: (event: any) => void;
    onContextMenu: (event: any) => void;
    onClick: (event: any) => void;
    colorNoteChild: ReactNode;
}>) {
    const iconName = backgroundTypeIconMap[backgroundType] ?? 'file-earmark';
    return (
        <div
            className={`app-background-list-item card w-100 ${selectedCN}`}
            title={title}
            // A div you could only click: no keyboard reached a file, and
            // nothing but its caption named it.
            role="button"
            tabIndex={0}
            aria-label={name}
            data-file-item-file-src={src}
            draggable={isDraggable}
            onDragStart={onDragStart}
            onContextMenu={onContextMenu}
            onClick={onClick}
            onKeyDown={handleBackgroundTileKeyDown}
        >
            <i className={`bi bi-${iconName} px-1`} />
            <div className="app-ellipsis flex-fill app-background-list-item-name">
                {name}
            </div>
            {selectedBackgroundSrcList.map(([key]) => {
                return (
                    <ShowingScreenIcon
                        key={key}
                        screenId={Number.parseInt(key)}
                    />
                );
            })}
            <ContextMenuDotsButtonComp onOpening={onContextMenu} />
            {colorNoteChild}
        </div>
    );
}
