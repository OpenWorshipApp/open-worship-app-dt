import { useCallback, type CSSProperties } from 'react';

import ScreenVaryAppDocumentManager from '../../_screen/managers/ScreenVaryAppDocumentManager';
import { checkIsVarySlideOnScreen } from '../../app-document-list/appDocumentHelpers';
import type { VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import RenderBackgroundWebIframeComp from '../../background/RenderBackgroundWebIframeComp';
import RenderCameraVideoComp from '../../background/RenderCameraVideoComp';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import type { DroppedDataType } from '../../helper/DragInf';
import { DragTypeEnum } from '../../helper/DragInf';
import {
    getColorNoteFilePathSetting,
    setColorNoteFilePathSetting,
} from '../../helper/FileSourceMetaManager';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../../helper/helpers';
import { chooseColorNote } from '../../others/ItemColorNoteComp';
import appProvider from '../../server/appProvider';
import BackgroundRenderOnHoverComp from './BackgroundRenderOnHoverComp';
import type FileSource from '../../helper/FileSource';
import { useWebCapturing } from '../../helper/domHelpers';
import { tran } from '../../lang/langHelpers';

const CAMERA_BACKGROUND_SRC = '/assets/background-camera.png';
const WEB_BACKGROUND_SRC = '/assets/background-web.png';
const BROKEN_IMAGE_SRC = '/assets/broken-image.png';
const BROKEN_VIDEO_SRC = '/assets/broken-video.mp4';

export const DOCX_PREVIEW_BACKGROUND_COLOR_VAR_NAME =
    '--app-docx-preview-background';

function RenderBackgroundWebComp({
    src,
}: Readonly<{
    src: Pick<FileSource, 'src' | 'fullName'>;
}>) {
    const imageData = useWebCapturing(src);
    const genChildrenRender = useCallback(
        (dim: { width: number; height: number }) => {
            const { width, height } = dim;
            return (
                <RenderBackgroundWebIframeComp
                    src={src}
                    width={width}
                    height={height}
                />
            );
        },
        [src],
    );
    return (
        <BackgroundRenderOnHoverComp
            src={imageData ?? WEB_BACKGROUND_SRC}
            opacity={1}
            genChildren={genChildrenRender}
        />
    );
}
const fillingParentStyle: CSSProperties = {
    width: '100%',
    height: '100%',
};
export function genAttachBackgroundComponent(
    droppedData: DroppedDataType | null | undefined,
) {
    if (!droppedData) {
        return (
            <div
                className="attached-virtual-bg-color"
                style={{
                    ...fillingParentStyle,
                    backgroundColor: `var(${DOCX_PREVIEW_BACKGROUND_COLOR_VAR_NAME}, transparent)`,
                }}
            ></div>
        );
    }
    if (droppedData.type === DragTypeEnum.BACKGROUND_COLOR) {
        return (
            <div
                style={{
                    ...fillingParentStyle,
                    backgroundColor: droppedData.item,
                }}
            />
        );
    }
    if (droppedData.type === DragTypeEnum.BACKGROUND_CAMERA) {
        return (
            <BackgroundRenderOnHoverComp
                src={CAMERA_BACKGROUND_SRC}
                genChildren={({ width }) => {
                    return (
                        <RenderCameraVideoComp
                            deviceId={droppedData.item.src}
                            width={width}
                        />
                    );
                }}
            />
        );
    }
    if (droppedData.type === DragTypeEnum.BACKGROUND_WEB) {
        return <RenderBackgroundWebComp src={droppedData.item} />;
    }
    if (droppedData.type === DragTypeEnum.BACKGROUND_IMAGE) {
        const src = droppedData.item.src;
        return (
            <img
                style={fillingParentStyle}
                alt={src}
                src={src}
                onError={(event) => {
                    if (!event.currentTarget.src.endsWith(BROKEN_IMAGE_SRC)) {
                        event.currentTarget.src = BROKEN_IMAGE_SRC;
                    }
                }}
            />
        );
    }
    if (droppedData.type === DragTypeEnum.BACKGROUND_VIDEO) {
        return (
            <video
                style={{
                    ...fillingParentStyle,
                    objectFit: 'cover',
                    objectPosition: 'center center',
                }}
                onMouseOver={(event) => {
                    event.currentTarget.play();
                }}
                onMouseOut={(event) => {
                    event.currentTarget.pause();
                }}
                loop
                muted
                src={droppedData.item.src}
                onError={(event) => {
                    if (!event.currentTarget.src.endsWith(BROKEN_VIDEO_SRC)) {
                        event.currentTarget.src = BROKEN_VIDEO_SRC;
                    }
                }}
            />
        );
    }
    return null;
}

export function toClassNameHighlight(
    varySlide: VarySlideType,
    selectedVarySlide: VarySlideType | null,
    holdingVarySlides: VarySlideType[],
) {
    const activeClassname =
        appProvider.isPageAppDocumentEditor &&
        selectedVarySlide &&
        varySlide.checkIsSame(selectedVarySlide)
            ? 'active'
            : '';
    const isOnScreen = checkIsVarySlideOnScreen(varySlide);
    const presenterClassname =
        appProvider.isPageAppDocumentEditor || !isOnScreen
            ? ''
            : `${HIGHLIGHT_SELECTED_CLASSNAME} animation`;
    let holdingClassname = '';
    if (
        !(
            selectedVarySlide !== null &&
            varySlide.checkIsSame(selectedVarySlide)
        ) &&
        holdingVarySlides.some((holdingItem) =>
            varySlide.checkIsSame(holdingItem),
        )
    ) {
        holdingClassname = 'holding';
    }
    return {
        selectedList: ScreenVaryAppDocumentManager.getDataList(
            varySlide.filePath,
            varySlide.id,
        ),
        activeCN: activeClassname,
        presenterCN: presenterClassname,
        holdingCN: holdingClassname,
    };
}

export function genChooseColorNoteOption(
    filePath: string,
    id: number,
): ContextMenuItemType[] {
    const colorCode = getColorNoteFilePathSetting(filePath, id);
    return [
        {
            menuElement: tran('Choose Color'),
            childBefore: (
                <i
                    className="bi bi-record-circle px-1"
                    style={{ color: colorCode || undefined }}
                />
            ),
            onSelect: (event) => {
                chooseColorNote(
                    colorCode,
                    (newColorCode) => {
                        setColorNoteFilePathSetting(filePath, id, newColorCode);
                        ScreenVaryAppDocumentManager.fireUpdateEvent();
                    },
                    event,
                );
            },
        },
    ];
}

const shadowingStyleText = `
.shadow-blank-bg[data-shadow-theme='dark'] {
    --color1: #495057;
    --color2: #343a40;
}
.shadow-blank-bg[data-shadow-theme='light'] {
    --color1: #dee2e6;
    --color2: #ced4da;
}
.shadow-blank-bg {
    background-size: 30px 30px;
    background-position: 0 0, 0 15px, 15px -15px, -15px 0px;

    background-image:
    linear-gradient(45deg, var(--color1) 25%, var(--color2) 25%),
    linear-gradient(-45deg, var(--color1) 25%, var(--color2) 25%),
    linear-gradient(45deg, var(--color2) 75%, var(--color1) 75%),
    linear-gradient(-45deg, var(--color2) 75%, var(--color1) 75%);
}`;
export function getSlideItemShadowingStyle() {
    return <style>{shadowingStyleText}</style>;
}
