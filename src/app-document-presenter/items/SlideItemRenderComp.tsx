import './VaryAppDocumentItem.scss';

import { CSSProperties, ReactNode, MouseEvent, useMemo } from 'react';

import Slide from '../../app-document-list/Slide';
import { useScreenVaryAppDocumentManagerEvents } from '../../_screen/managers/screenEventHelpers';
import {
    genRemovingAttachedBackgroundMenu,
    handleDragStart,
    handleAttachBackgroundDrop,
    useAttachedBackgroundData,
    extractDropData,
} from '../../helper/dragHelpers';
import ShowingScreenIcon from '../../_screen/preview/ShowingScreenIcon';
import appProvider from '../../server/appProvider';
import { changeDragEventStyle } from '../../helper/helpers';
import { DragTypeEnum } from '../../helper/DragInf';
import { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import AppDocument from '../../app-document-list/AppDocument';
import AttachBackgroundIconComponent from '../../others/AttachBackgroundIconComponent';
import { VaryAppDocumentItemType } from '../../app-document-list/appDocumentTypeHelpers';
import RenderSlideIndexComp from './RenderSlideIndexComp';
import { SLIDE_ITEMS_CONTAINER_CLASS_NAME } from './varyAppDocumentHelpers';
import { getColorNoteFilePathSetting } from '../../helper/FileSourceMetaManager';
import {
    genAttachBackgroundComponent,
    genChooseColorNoteOption,
    toClassNameHighlight,
    useScale,
} from './slideItemRenderHelpers';

function RenderScreenInfoComp({
    varyAppDocumentItem,
}: Readonly<{ varyAppDocumentItem: VaryAppDocumentItemType }>) {
    if (!appProvider.isPagePresenter) {
        return null;
    }
    const { selectedList } = toClassNameHighlight(varyAppDocumentItem);
    if (selectedList.length === 0) {
        return null;
    }
    return (
        <div className="d-flex app-border-white-round px-1">
            {selectedList.map(([key]) => {
                const screenId = Number.parseInt(key);
                return <ShowingScreenIcon key={key} screenId={screenId} />;
            })}
        </div>
    );
}

function RenderItemHeaderComp({
    varyAppDocumentItem,
    viewIndex,
    name,
}: Readonly<{
    varyAppDocumentItem: VaryAppDocumentItemType;
    viewIndex: number;
    name?: string;
}>) {
    const isChanged =
        Slide.checkIsThisType(varyAppDocumentItem) &&
        (varyAppDocumentItem as Slide).isChanged;
    const colorNote = getColorNoteFilePathSetting(
        varyAppDocumentItem.filePath,
        varyAppDocumentItem.id,
    );
    return (
        <div
            className="card-header vary-app-document-item-header d-flex"
            style={{
                borderColor: colorNote || undefined,
            }}
        >
            <div className="d-flex w-100 overflow-hidden">
                <div className="d-flex overflow-hidden flex-grow-1">
                    <RenderSlideIndexComp viewIndex={viewIndex} />
                    <span className="mx-1 app-ellipsis">{name}</span>
                </div>
                <div className="d-flex justify-content-end">
                    <RenderScreenInfoComp
                        varyAppDocumentItem={varyAppDocumentItem}
                    />
                    <AttachBackgroundIconComponent
                        filePath={varyAppDocumentItem.filePath}
                        id={varyAppDocumentItem.id}
                    />
                    <span
                        title={
                            `width:${varyAppDocumentItem.width}, ` +
                            `height:${varyAppDocumentItem.height}`
                        }
                    >
                        <small className="pe-2">
                            {varyAppDocumentItem.width}x
                            {varyAppDocumentItem.height}
                        </small>
                    </span>
                    {isChanged && <span style={{ color: 'red' }}>*</span>}
                </div>
            </div>
        </div>
    );
}

export default function SlideItemRenderComp({
    slide,
    width,
    index,
    onClick,
    onContextMenu,
    onCopy,
    selectedItem,
    children,
}: Readonly<{
    slide: VaryAppDocumentItemType;
    width: number;
    index: number;
    onClick?: (event: MouseEvent<HTMLDivElement>) => void;
    onContextMenu: (event: any, extraMenuItems: ContextMenuItemType[]) => void;
    onCopy?: () => void;
    selectedItem?: VaryAppDocumentItemType | null;
    children: ReactNode;
}>) {
    const { scale, setTargetDiv } = useScale(slide, width);
    useScreenVaryAppDocumentManagerEvents(['update']);
    const { activeCN: activeClassName, presenterCN: presenterClassName } =
        toClassNameHighlight(slide, selectedItem);
    const attachedBackgroundData = useAttachedBackgroundData(
        slide.filePath,
        slide.id,
    );
    const attachedBackgroundElement = useMemo(() => {
        return genAttachBackgroundComponent(attachedBackgroundData);
    }, [attachedBackgroundData]);
    const style: CSSProperties = useMemo(() => {
        return {
            padding: 0,
            margin: 0,
            height: `${Math.round(slide.height * scale)}px`,
        };
    }, [slide.height, scale]);
    const handleDataDropping = async (event: any) => {
        changeDragEventStyle(event, 'opacity', '1');
        const droppedData = extractDropData(event);
        if (droppedData?.type === DragTypeEnum.SLIDE) {
            if (droppedData.item.filePath !== slide.filePath) {
                return;
            }
            const appDocument = AppDocument.getInstance(slide.filePath);
            const toIndex = await appDocument.getSlideIndex(slide as Slide);
            appDocument.moveSlideToIndex(droppedData.item as Slide, toIndex);
        } else {
            handleAttachBackgroundDrop(event, slide);
        }
    };
    const handleContextMenuOpening = (event: any) => {
        const menuItems: ContextMenuItemType[] = [];
        if (attachedBackgroundData) {
            menuItems.push(
                ...genRemovingAttachedBackgroundMenu(slide.filePath, slide.id),
            );
        }
        menuItems.push(...genChooseColorNoteOption(slide.filePath, slide.id));
        onContextMenu(event, menuItems);
    };
    return (
        <div
            className={
                'data-vary-app-document-item card' +
                ` app-caught-hover-pointer ${activeClassName} ` +
                `${presenterClassName} app-overflow-hidden`
            }
            ref={setTargetDiv}
            style={{ width: `${width}px` }}
            data-vary-app-document-item-id={slide.id}
            data-scroll-container-selector={`.${SLIDE_ITEMS_CONTAINER_CLASS_NAME}`}
            draggable
            onDragOver={(event) => {
                event.preventDefault();
                changeDragEventStyle(event, 'opacity', '0.5');
            }}
            onDragLeave={(event) => {
                event.preventDefault();
                changeDragEventStyle(event, 'opacity', '1');
            }}
            onDrop={handleDataDropping}
            onDragStart={(event) => {
                handleDragStart(event, slide);
                event.stopPropagation();
            }}
            onDragEnd={(event) => {
                changeDragEventStyle(event, 'opacity', '1');
            }}
            onClick={onClick}
            onContextMenu={handleContextMenuOpening}
            onCopy={onCopy ?? (() => {})}
        >
            <RenderItemHeaderComp
                varyAppDocumentItem={slide}
                viewIndex={index + 1}
                name={slide.name}
            />
            <div className="card-body app-overflow-hidden w-100" style={style}>
                {attachedBackgroundElement && (
                    <div
                        className="w-100"
                        style={{
                            ...style,
                            position: 'absolute',
                        }}
                    >
                        {attachedBackgroundElement}
                    </div>
                )}
                <div
                    className="w-100 overflow-hidden"
                    style={{
                        ...style,
                        position: 'absolute',
                        pointerEvents: 'none',
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
