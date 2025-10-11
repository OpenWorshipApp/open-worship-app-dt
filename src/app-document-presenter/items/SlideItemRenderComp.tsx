import './VaryAppDocumentItem.scss';

import { CSSProperties, ReactNode, MouseEvent, useState, useMemo } from 'react';

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
import { useAppEffect } from '../../helper/debuggerHelpers';
import ScreenVaryAppDocumentManager from '../../_screen/managers/ScreenVaryAppDocumentManager';
import AppDocument from '../../app-document-list/AppDocument';
import AttachBackgroundIconComponent from '../../others/AttachBackgroundIconComponent';
import { VaryAppDocumentItemType } from '../../app-document-list/appDocumentTypeHelpers';
import RenderSlideIndexComp from './RenderSlideIndexComp';

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
    name,
}: Readonly<{
    varyAppDocumentItem: VaryAppDocumentItemType;
    viewIndex: number;
    name?: string;
}>) {
    const isChanged =
        Slide.checkIsThisType(varyAppDocumentItem) &&
        (varyAppDocumentItem as Slide).isChanged;
    return (
        <div className="card-header vary-app-document-item-header d-flex">
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
                style={{
                    objectFit: 'cover',
                    objectPosition: 'center center',
                }}
                onMouseEnter={(event) => {
                    event.currentTarget.play();
                }}
                onMouseLeave={(event) => {
                    event.currentTarget.pause();
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
    onClick?: (event: MouseEvent<HTMLDivElement>) => void;
    onContextMenu: (event: any, extraMenuItems: ContextMenuItemType[]) => void;
    onCopy?: () => void;
    selectedItem?: VaryAppDocumentItemType | null;
    children: ReactNode;
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
            height: `${Math.round(slide.height * scale)}px`,
        } as CSSProperties;
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
                ' app-overflow-hidden'
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
