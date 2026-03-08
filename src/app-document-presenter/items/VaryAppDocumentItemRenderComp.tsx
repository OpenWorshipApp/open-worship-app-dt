import './VaryAppDocumentItem.scss';

import type { CSSProperties, ReactNode, MouseEvent } from 'react';
import { useMemo } from 'react';

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
import type { VaryAppDocumentItemType } from '../../app-document-list/appDocumentTypeHelpers';
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

function RenderScreenInfoComp({
    varyAppDocumentItem,
}: Readonly<{ varyAppDocumentItem: VaryAppDocumentItemType }>) {
    if (!appProvider.isPagePresenter) {
        return null;
    }
    const { selectedList } = toClassNameHighlight(
        varyAppDocumentItem,
        null,
        [],
    );
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

function VaryAppDocumentItemHeaderComp({
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

const style: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    margin: 0,
    padding: 0,
    overflow: 'hidden',
    border: 'none',
};
function VaryAppDocumentItemBodyRenderComp({
    slide,
    children,
}: Readonly<{
    slide: VaryAppDocumentItemType;
    children: ReactNode;
}>) {
    const parentWidth = useShadowingParentWidth();
    const actualParentWidth = useMemo(() => {
        return parentWidth ?? slide.width;
    }, [parentWidth, slide.width]);
    const attachedBackgroundData = useAttachedBackgroundData(
        slide.filePath,
        slide.id,
    );
    const attachedBackgroundElement = useMemo(() => {
        return genAttachBackgroundComponent(attachedBackgroundData);
    }, [attachedBackgroundData]);
    const actualStyle = useMemo(() => {
        const scale = actualParentWidth / slide.width;
        const height = slide.height * scale;
        return {
            ...style,
            width: `${actualParentWidth}px`,
            height: `${height}px`,
        };
    }, [actualParentWidth, slide.width, slide.height]);
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
                    slide={slide}
                    width={actualParentWidth}
                >
                    <div
                        className="shadow-blank-bg"
                        data-shadow-theme={theme}
                        style={{
                            width: `${slide.width}px`,
                            height: `${slide.height}px`,
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
                    slide={slide}
                    width={actualParentWidth}
                >
                    {children}
                </VaryAppDocumentScaleContainerComp>
            </div>
        </div>
    );
}

export default function VaryAppDocumentItemRenderComp({
    slide,
    width,
    index,
    onClick,
    onContextMenu,
    onCopy,
    selectedItemEditing,
    holdingItems,
    children,
}: Readonly<{
    slide: VaryAppDocumentItemType;
    width: number;
    index: number;
    onClick?: (event: MouseEvent<HTMLDivElement>) => void;
    onContextMenu: (event: any, extraMenuItems: ContextMenuItemType[]) => void;
    onCopy?: () => void;
    selectedItemEditing?: VaryAppDocumentItemType | null;
    holdingItems?: VaryAppDocumentItemType[];
    children: ReactNode;
}>) {
    useScreenVaryAppDocumentManagerEvents(['update']);
    const {
        activeCN: activeClassName,
        presenterCN: presenterClassName,
        holdingCN: holdingClassName,
    } = toClassNameHighlight(
        slide,
        selectedItemEditing ?? null,
        holdingItems ?? [],
    );
    const attachedBackgroundData = useAttachedBackgroundData(
        slide.filePath,
        slide.id,
    );
    const handleDataDropping = async (event: any) => {
        changeDragEventStyle(event, 'opacity', '1');
        const droppedData = extractDropData(event);
        if (droppedData?.type === DragTypeEnum.SLIDE) {
            if (
                !Slide.checkIsThisType(slide) ||
                droppedData.item.filePath !== slide.filePath
            ) {
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
                `${APP_DOCUMENT_ITEM_CLASS} card app-caught-hover-pointer` +
                ' app-overflow-hidden' +
                ` ${presenterClassName} ${activeClassName} ${holdingClassName}`
            }
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
            <VaryAppDocumentItemHeaderComp
                varyAppDocumentItem={slide}
                viewIndex={index + 1}
                name={slide.name}
            />
            <div className="card-body app-overflow-hidden w-100 p-0 m-0">
                <ShadowingFillParentWidthComp width={width}>
                    <VaryAppDocumentItemBodyRenderComp slide={slide}>
                        {getSlideItemShadowingStyle()}
                        {children}
                    </VaryAppDocumentItemBodyRenderComp>
                </ShadowingFillParentWidthComp>
            </div>
        </div>
    );
}
