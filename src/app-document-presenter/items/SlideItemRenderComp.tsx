import './VaryAppDocumentItem.scss';

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
import { checkIsAppDocumentItemOnScreen } from '../../app-document-list/appDocumentHelpers';
import { changeDragEventStyle, genTimeoutAttempt } from '../../helper/helpers';
import { DragTypeEnum, DroppedDataType } from '../../helper/DragInf';
import { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { useMemo, useState } from 'react';
import { useAppEffect } from '../../helper/debuggerHelpers';
import ScreenVaryAppDocumentManager from '../../_screen/managers/ScreenVaryAppDocumentManager';
import AppDocument from '../../app-document-list/AppDocument';
import AttachBackgroundIconComponent from '../../others/AttachBackgroundIconComponent';
import { VaryAppDocumentItemType } from '../../app-document-list/appDocumentTypeHelpers';

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
                const screenId = parseInt(key);
                return <ShowingScreenIcon key={key} screenId={screenId} />;
            })}
        </div>
    );
}

function RenderHeaderInfoComp({
    varyAppDocumentItem,
    viewIndex,
}: Readonly<{
    varyAppDocumentItem: VaryAppDocumentItemType;
    viewIndex: number;
}>) {
    const isChanged =
        Slide.checkIsThisType(varyAppDocumentItem) &&
        (varyAppDocumentItem as Slide).isChanged;
    return (
        <div
            className="card-header d-flex"
            style={{
                height: '35px',
                backgroundColor: 'var(--bs-gray-800)',
            }}
        >
            <div className="d-flex w-100">
                <div className="flex-fill d-flex">
                    <div>
                        <span
                            className="badge rounded-pill text-bg-info"
                            title={`Index: ${viewIndex}`}
                        >
                            {viewIndex}
                        </span>
                    </div>
                </div>
                <div className="flex-fill d-flex justify-content-end">
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

export function toClassNameHighlight(
    varyAppDocumentItem: VaryAppDocumentItemType,
    selectedVaryAppDocumentItem?: VaryAppDocumentItemType | null,
) {
    const activeClassname =
        appProvider.isPageEditor &&
        selectedVaryAppDocumentItem &&
        varyAppDocumentItem.checkIsSame(selectedVaryAppDocumentItem)
            ? 'active'
            : '';
    const isOnScreen = checkIsAppDocumentItemOnScreen(varyAppDocumentItem);
    const presenterClassname =
        appProvider.isPageEditor || !isOnScreen
            ? ''
            : 'app-highlight-selected animation';
    return {
        selectedList: ScreenVaryAppDocumentManager.getDataList(
            varyAppDocumentItem.filePath,
            varyAppDocumentItem.id,
        ),
        activeCN: activeClassname,
        presenterCN: presenterClassname,
    };
}

function genAttachBackgroundComponent(
    droppedData: DroppedDataType | null | undefined,
) {
    if (droppedData === null || droppedData === undefined) {
        return null;
    }
    let element = null;
    if (droppedData.type === DragTypeEnum.BACKGROUND_COLOR) {
        element = (
            <div
                className="w-100 h-100"
                style={{ backgroundColor: droppedData.item }}
            />
        );
    } else if (droppedData.type === DragTypeEnum.BACKGROUND_IMAGE) {
        element = (
            <img
                className="w-100 h-100"
                alt={droppedData.item.src}
                src={droppedData.item.src}
            />
        );
    } else if (droppedData.type === DragTypeEnum.BACKGROUND_VIDEO) {
        element = (
            <video
                className="w-100 h-100"
                onMouseEnter={(event) => {
                    event.currentTarget.play();
                }}
                onMouseLeave={(event) => {
                    event.currentTarget.pause();
                    event.currentTarget.currentTime = 0;
                }}
                loop
                muted
                src={droppedData.item.src}
            />
        );
    }
    return element;
}

export function useScale(item: VaryAppDocumentItemType, thumbnailSize: number) {
    const [targetDiv, setTargetDiv] = useState<HTMLDivElement | null>(null);
    const [parentWidth, setParentWidth] = useState(0);
    useAppEffect(() => {
        setParentWidth(targetDiv?.clientWidth ?? 0);
    }, [targetDiv, thumbnailSize]);
    const scale = useMemo(() => {
        return parentWidth / item.width;
    }, [parentWidth, item]);
    const resizeAttemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const listenParentSizing = (parentDiv: HTMLElement | null) => {
        if (parentDiv !== null) {
            const resizeObserver = new ResizeObserver(() => {
                resizeAttemptTimeout(() => {
                    setParentWidth(targetDiv?.clientWidth ?? 0);
                });
            });
            resizeObserver.observe(parentDiv);
            return () => {
                resizeObserver.disconnect();
            };
        }
    };
    return {
        parentWidth,
        scale,
        setTargetDiv: (div: HTMLDivElement | null) => {
            setTargetDiv(div);
            return listenParentSizing(div?.parentElement ?? null);
        },
        setParentDiv: (parentDiv: HTMLDivElement | null) => {
            if (parentDiv === null) {
                setTargetDiv(null);
            } else {
                setTargetDiv(parentDiv.parentElement as HTMLDivElement);
            }
            return listenParentSizing(parentDiv);
        },
    };
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
    onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
    onContextMenu: (event: any, extraMenuItems: ContextMenuItemType[]) => void;
    onCopy?: () => void;
    selectedItem?: VaryAppDocumentItemType | null;
    children: React.ReactNode;
}>) {
    const { scale, setTargetDiv } = useScale(slide, width);
    useScreenVaryAppDocumentManagerEvents(['update']);
    const { activeCN, presenterCN } = toClassNameHighlight(slide, selectedItem);
    const attachedBackgroundData = useAttachedBackgroundData(
        slide.filePath,
        slide.id,
    );
    const attachedBackgroundElement = useMemo(() => {
        return genAttachBackgroundComponent(attachedBackgroundData);
    }, [attachedBackgroundData]);
    const style = useMemo(() => {
        return {
            padding: 0,
            margin: 0,
            height: `${Math.floor(slide.height * scale)}px`,
        } as React.CSSProperties;
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
    return (
        <div
            className={
                'data-vary-app-document-item card' +
                ` app-caught-hover-pointer ${activeCN} ${presenterCN}` +
                ' overflow-hidden'
            }
            ref={setTargetDiv}
            style={{ width: `${width}px` }}
            data-vary-app-document-item-id={slide.id}
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
            onContextMenu={(event) => {
                const menuItems: ContextMenuItemType[] = [];
                if (attachedBackgroundData) {
                    menuItems.push(
                        ...genRemovingAttachedBackgroundMenu(
                            slide.filePath,
                            slide.id,
                        ),
                    );
                }
                onContextMenu(event, menuItems);
            }}
            onCopy={onCopy ?? (() => {})}
        >
            <RenderHeaderInfoComp
                varyAppDocumentItem={slide}
                viewIndex={index + 1}
            />
            <div className="card-body overflow-hidden w-100" style={style}>
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
                    className="w-100"
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
