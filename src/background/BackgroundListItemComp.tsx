import './BackgroundListItemComp.scss';

import type { ReactNode } from 'react';

import ShowingScreenIcon from '../_screen/preview/ShowingScreenIcon';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';

const backgroundTypeIconMap: { [key: string]: string } = {
    image: 'file-earmark-image',
    video: 'file-earmark-play',
    web: 'globe2',
    audio: 'file-earmark-music',
    camera: 'camera-video',
};

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
            data-file-item-file-src={src}
            draggable={isDraggable}
            onDragStart={onDragStart}
            onContextMenu={onContextMenu}
            onClick={onClick}
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
            {colorNoteChild}
        </div>
    );
}
