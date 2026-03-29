import './VarySlideComp.scss';

import type { CSSProperties, ReactNode, MouseEvent } from 'react';
import { useCallback, useMemo } from 'react';

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
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import AppDocument from '../../app-document-list/AppDocument';
import AttachBackgroundIconComponent from '../../others/AttachBackgroundIconComponent';
import type { VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import RenderSlideIndexComp from './RenderSlideIndexComp';
import { SLIDE_ITEMS_CONTAINER_CLASS_NAME } from './varyAppDocumentHelpers';
import { getColorNoteFilePathSetting } from '../../helper/FileSourceMetaManager';
import {
    genAttachBackgroundComponent,
    genChooseColorNoteOption,
    getSlideItemShadowingStyle,
    toClassNameHighlight,
} from './slideItemRenderHelpers';
import { APP_DOCUMENT_ITEM_CLASS } from './appDocumentHelpers';
import ShadowingFillParentWidthComp, {
    useShadowingParentWidth,
} from '../../others/ShadowingFillParentWidthComp';
import VaryAppDocumentScaleContainerComp from './VaryAppDocumentScaleContainerComp';
import { useThemeSource } from '../../others/initHelpers';
import { tran } from '../../lang/langHelpers';

function RenderScreenInfoComp({
    varySlide,
}: Readonly<{ varySlide: VarySlideType }>) {
    if (!appProvider.isPagePresenter) {
        return null;
    }
    const { selectedList } = toClassNameHighlight(varySlide, null, []);
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

function VarySlideHeaderComp({
    varySlide,
    viewIndex,
    name,
}: Readonly<{
    varySlide: VarySlideType;
    viewIndex: number;
    name?: string;
}>) {
    const isChanged =
        Slide.checkIsThisType(varySlide) && (varySlide as Slide).isChanged;
    const colorNote = getColorNoteFilePathSetting(
        varySlide.filePath,
        varySlide.id,
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
                    <RenderScreenInfoComp varySlide={varySlide} />
                    <AttachBackgroundIconComponent
                        filePath={varySlide.filePath}
                        id={varySlide.id}
                    />
                    <span
                        title={
                            `width:${varySlide.width}, ` +
                            `height:${varySlide.height}`
                        }
                    >
                        <small className="pe-2">
                            {varySlide.width}x{varySlide.height}
                        </small>
                    </span>
                    {isChanged && <span style={{ color: 'red' }}>*</span>}
                </div>
            </div>
        </div>
    );
}

const style: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    margin: 0,
    padding: 0,
    overflow: 'hidden',
    border: 'none',
};
function VarySlideBodyRenderComp({
    varySlideData,
    children,
}: Readonly<{
    varySlideData: VarySlideType;
    children: ReactNode;
}>) {
    const parentWidth = useShadowingParentWidth();
    const actualParentWidth = parentWidth ?? varySlideData.width;
    const attachedBackgroundData = useAttachedBackgroundData(
        varySlideData.filePath,
        varySlideData.id,
    );
    const attachedBackgroundElement = useMemo(() => {
        return genAttachBackgroundComponent(attachedBackgroundData);
    }, [attachedBackgroundData]);
    const actualStyle = useMemo(() => {
        const scale = actualParentWidth / varySlideData.width;
        const height = varySlideData.height * scale;
        return {
            ...style,
            width: `${actualParentWidth}px`,
            height: `${height}px`,
        };
    }, [actualParentWidth, varySlideData.width, varySlideData.height]);
    const { theme } = useThemeSource();
    return (
        <div
            style={{
                width: '100%',
                height: actualStyle.height,
                position: 'relative',
            }}
        >
            <div style={actualStyle}>
                <VaryAppDocumentScaleContainerComp
                    varySlide={varySlideData}
                    width={actualParentWidth}
                >
                    <div
                        className="shadow-blank-bg"
                        data-shadow-theme={theme}
                        style={{
                            width: `${varySlideData.width}px`,
                            height: `${varySlideData.height}px`,
                            margin: 0,
                            padding: 0,
                            border: 'none',
                        }}
                    >
                        {attachedBackgroundElement}
                    </div>
                </VaryAppDocumentScaleContainerComp>
            </div>
            <div style={{ ...actualStyle, pointerEvents: 'none' }}>
                <VaryAppDocumentScaleContainerComp
                    varySlide={varySlideData}
                    width={actualParentWidth}
                >
                    {children}
                </VaryAppDocumentScaleContainerComp>
            </div>
        </div>
    );
}

export default function VarySlideRenderComp({
    varySlide,
    width,
    index,
    onClick,
    onContextMenu,
    onCopy,
    selectedItemEditing,
    holdingItems,
    children,
}: Readonly<{
    varySlide: VarySlideType;
    width: number;
    index: number;
    onClick?: (event: MouseEvent<HTMLDivElement>) => void;
    onContextMenu: (event: any, extraMenuItems: ContextMenuItemType[]) => void;
    onCopy?: () => void;
    selectedItemEditing?: VarySlideType | null;
    holdingItems?: VarySlideType[];
    children: ReactNode;
}>) {
    useScreenVaryAppDocumentManagerEvents(['update']);
    const {
        activeCN: activeClassName,
        presenterCN: presenterClassName,
        holdingCN: holdingClassName,
    } = toClassNameHighlight(
        varySlide,
        selectedItemEditing ?? null,
        holdingItems ?? [],
    );
    const attachedBackgroundData = useAttachedBackgroundData(
        varySlide.filePath,
        varySlide.id,
    );
    const handleDataDropping = useCallback(
        async (event: any) => {
            changeDragEventStyle(event, 'opacity', '1');
            const droppedData = extractDropData(event);
            if (droppedData?.type === DragTypeEnum.SLIDE) {
                if (
                    !Slide.checkIsThisType(varySlide) ||
                    droppedData.item.filePath !== varySlide.filePath
                ) {
                    return;
                }
                const appDocument = AppDocument.getInstance(varySlide.filePath);
                const toIndex = await appDocument.getSlideIndex(
                    varySlide as Slide,
                );
                appDocument.moveSlideToIndex(
                    droppedData.item as Slide,
                    toIndex,
                );
            } else {
                handleAttachBackgroundDrop(event, varySlide);
            }
        },
        [varySlide],
    );
    const handleDragOver = useCallback((event: any) => {
        event.preventDefault();
        changeDragEventStyle(event, 'opacity', '0.5');
    }, []);
    const handleDragLeave = useCallback((event: any) => {
        event.preventDefault();
        changeDragEventStyle(event, 'opacity', '1');
    }, []);
    const handleDragStartEvent = useCallback(
        (event: any) => {
            handleDragStart(event, varySlide);
            event.stopPropagation();
        },
        [varySlide],
    );
    const handleDragEnd = useCallback((event: any) => {
        changeDragEventStyle(event, 'opacity', '1');
    }, []);
    const handleContextMenuOpening = useCallback(
        (event: any) => {
            const menuItems: ContextMenuItemType[] = [];
            if (attachedBackgroundData) {
                menuItems.push(
                    ...genRemovingAttachedBackgroundMenu(
                        varySlide.filePath,
                        varySlide.id,
                    ),
                );
            }
            menuItems.push(
                ...genChooseColorNoteOption(varySlide.filePath, varySlide.id),
            );
            onContextMenu(event, menuItems);
        },
        [attachedBackgroundData, varySlide, onContextMenu],
    );
    return (
        <div
            className={
                `${APP_DOCUMENT_ITEM_CLASS} card app-caught-hover-pointer` +
                ' app-overflow-hidden' +
                ` ${presenterClassName} ${activeClassName} ${holdingClassName}`
            }
            title={
                varySlide.isDisabled
                    ? tran('This slide is disabled')
                    : undefined
            }
            style={{
                width: `${width}px`,
                ...(varySlide.isDisabled
                    ? { opacity: 0.5, pointerEvents: 'none' }
                    : {}),
            }}
            data-vary-app-document-item-id={varySlide.id}
            data-scroll-container-selector={`.${SLIDE_ITEMS_CONTAINER_CLASS_NAME}`}
            draggable
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDataDropping}
            onDragStart={handleDragStartEvent}
            onDragEnd={handleDragEnd}
            onClick={onClick}
            onContextMenu={handleContextMenuOpening}
            onCopy={onCopy ?? (() => {})}
        >
            <VarySlideHeaderComp
                varySlide={varySlide}
                viewIndex={index + 1}
                name={varySlide.name}
            />
            <div className="card-body app-overflow-hidden w-100 p-0 m-0">
                <ShadowingFillParentWidthComp width={width}>
                    <VarySlideBodyRenderComp varySlideData={varySlide}>
                        {getSlideItemShadowingStyle()}
                        {children}
                    </VarySlideBodyRenderComp>
                </ShadowingFillParentWidthComp>
            </div>
        </div>
    );
}
