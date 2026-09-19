import './CanvasItemPreviewComp.scss';

import type { RefObject } from 'react';
import { useCallback, useRef, useState } from 'react';

import { tran } from '../../../lang/langHelpers';
import { useAppEffect } from '../../../helper/appHooks';
import type { CanvasItemPropsType } from '../CanvasItem';
import CanvasItem, {
    useCanvasItemContext,
    useCanvasItemPropsContext,
    useSelectedCanvasItemsAndSetterContext,
} from '../CanvasItem';
import type { CanvasItemCameraPropsType } from '../CanvasItemCamera';
import CanvasItemRendererComp from '../../CanvasItemRendererComp';
import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';
import {
    checkIsCameraMediaElement,
    setCameraBadgeVisibility,
} from '../../../_screen/managers/slideCameraSyncHelpers';
import {
    acquireCameraStream,
    releaseCameraStream,
    resolveCameraDeviceId,
    useCameraInfoList,
} from '../../../helper/cameraHelpers';
import { CAMERA_ITEM_ATTR } from '../../../helper/constants';
import { handleError } from '../../../helper/errorHelpers';
import { playMediaElement } from '../../../helper/mediaHelpers';
import { showSimpleToast } from '../../../toast/toastHelpers';

// The well is a FIXED height with the item centred in it, never a height
// derived from the scaled item: the card body scrolls, so a derived height
// would feed back through its scrollbar (taller -> scrollbar -> narrower ->
// shorter -> no scrollbar -> ...) and would also make the whole panel jump
// every time another item is selected.
const MAX_PREVIEW_HEIGHT = 200;
const MAX_SOURCE_LENGTH = 120;
const DATA_URI_LABEL_LENGTH = 30;

/**
 * What this item actually points at, for the line above the preview. Deliberately
 * NOT translated: these are technical tokens like the card header's raw
 * `Item ID: n`, and a `tran` key per canvas item type would be nine more strings
 * that each throw in dev when missed.
 */
function toCanvasItemSourceText(props: any): string {
    switch (props.type) {
        case 'video':
        case 'audio':
            return props.filePath ?? '';
        case 'youtube':
        case 'website':
            return props.url ?? '';
        case 'camera':
            return props.label || props.deviceId || '';
        case 'image':
            // A base64 data URI is megabytes; keep only its mime prefix so it
            // never lands in a text node AND in a `title` tooltip.
            return typeof props.srcData === 'string' &&
                props.srcData.startsWith('data:')
                ? `${props.srcData.slice(0, DATA_URI_LABEL_LENGTH)}...`
                : (props.srcData ?? '');
        case 'bible':
            return (props.bibleKeys ?? []).join(', ');
        case 'text':
            return props.text ?? '';
        case 'html':
            return props.html ?? '';
        default:
            return '';
    }
}

/**
 * Only what makes the browser load something new. Text/html content is left out
 * on purpose: it changes on every edit, and re-running the interactivity pass
 * for it would be pure waste.
 */
function toCanvasItemMediaSourceKey(props: any): string {
    switch (props.type) {
        case 'video':
        case 'audio':
            return props.filePath ?? '';
        case 'youtube':
        case 'website':
            return props.url ?? '';
        default:
            return '';
    }
}

function CanvasItemPreviewCameraControlComp({
    previewRootRef,
}: Readonly<{
    previewRootRef: RefObject<HTMLDivElement | null>;
}>) {
    const props = useCanvasItemPropsContext<CanvasItemCameraPropsType>();
    const cameraInfoList = useCameraInfoList();
    const [isCameraOn, setIsCameraOn] = useState(false);
    // Opening a device is async, stopping is not: every start records the
    // generation it began in, and a stop bumps it so a stream that lands
    // afterwards is released instead of leaving the device light on. Same guard
    // `SlideCameraAttachment` uses on the screen side.
    const generationRef = useRef(0);
    const acquiredDeviceIdRef = useRef<string | null>(null);
    // Held separately from the DOM ref: React clears refs on unmount, and the
    // cleanup below still has to reach the element it attached a stream to.
    const videoElementRef = useRef<HTMLVideoElement | null>(null);
    // Match on the id OR the label, the same way `resolveCameraDeviceId` does —
    // Chromium rotates device ids, so an id-only check would call a camera that
    // is plugged in right now "not found".
    const isDeviceMissing = !cameraInfoList.some((camera) => {
        return (
            camera.deviceId === props.deviceId ||
            (props.label !== '' && camera.label === props.label)
        );
    });
    const handleStopping = useCallback(() => {
        // Drops a stream that is still opening, and ref-count-releases an open
        // one. Clicking Stop while starting is therefore a real cancel.
        generationRef.current += 1;
        const acquiredDeviceId = acquiredDeviceIdRef.current;
        acquiredDeviceIdRef.current = null;
        if (acquiredDeviceId !== null) {
            releaseCameraStream(acquiredDeviceId);
        }
        const videoElement = videoElementRef.current;
        videoElementRef.current = null;
        if (videoElement !== null) {
            videoElement.onloadedmetadata = null;
            videoElement.pause();
            // Releasing stops the tracks but leaves the element holding the
            // dead stream, which would freeze on its last frame.
            videoElement.srcObject = null;
            setCameraBadgeVisibility(videoElement, true);
        }
        setIsCameraOn(false);
    }, []);
    // Covers collapsing the section, deselecting the item, switching the tools
    // tab, the editor unmounting, and picking another device mid-stream.
    const deviceKey = `${props.deviceId}|${props.label}`;
    useAppEffect(() => {
        return handleStopping;
    }, [deviceKey, handleStopping]);
    const handleStarting = useCallback(async () => {
        const videoElement =
            previewRootRef.current?.querySelector<HTMLVideoElement>(
                `video[${CAMERA_ITEM_ATTR}]`,
            ) ?? null;
        if (videoElement === null) {
            return;
        }
        const generation = generationRef.current;
        setIsCameraOn(true);
        try {
            // The renderer emits no `muted` (React's prop does not survive
            // `renderToStaticMarkup`), and Chromium's autoplay policy rejects
            // `play()` without it.
            videoElement.muted = true;
            videoElement.playsInline = true;
            const deviceId = await resolveCameraDeviceId(
                props.deviceId,
                props.label,
            );
            if (generation !== generationRef.current) {
                return;
            }
            if (deviceId === null) {
                showSimpleToast(tran('Camera Error'), tran('Camera not found'));
                setIsCameraOn(false);
                return;
            }
            const mediaStream = await acquireCameraStream(deviceId);
            if (generation !== generationRef.current) {
                // Stopped while the device was opening.
                releaseCameraStream(deviceId);
                return;
            }
            acquiredDeviceIdRef.current = deviceId;
            videoElementRef.current = videoElement;
            videoElement.srcObject = mediaStream;
            videoElement.onloadedmetadata = () => {
                void playMediaElement(videoElement);
                setCameraBadgeVisibility(videoElement, false);
            };
        } catch (error) {
            // The screen path stays deliberately silent because it runs once per
            // render; this one only ever runs on an explicit click, so a device
            // that is listed but cannot be opened — already in use, or a virtual
            // camera whose host app is not running — has to say so instead of
            // leaving a dead placeholder under a "Stop Camera" button.
            handleError(error);
            showSimpleToast(tran('Camera Error'), `${error}`);
            setIsCameraOn(false);
        }
    }, [previewRootRef, props.deviceId, props.label]);
    return (
        <div className="cip-camera-actions d-flex align-items-center gap-2">
            <button
                type="button"
                className={
                    'btn btn-sm ' +
                    (isCameraOn ? 'btn-outline-danger' : 'btn-outline-info')
                }
                disabled={isDeviceMissing && !isCameraOn}
                onClick={
                    isCameraOn
                        ? handleStopping
                        : () => {
                              void handleStarting();
                          }
                }
            >
                {tran(isCameraOn ? 'Stop Camera' : 'Start Camera')}
            </button>
            {isDeviceMissing ? (
                <span className="text-warning app-ellipsis">
                    {tran('Camera not found')}
                </span>
            ) : null}
        </div>
    );
}

function CanvasItemPreviewBodyComp() {
    const canvasItem = useCanvasItemContext();
    // The same optimistic, `edit`-synced props the box renderers read, so the
    // frame and its content never disagree about the item's size.
    const props = useCanvasItemPropsContext<CanvasItemPropsType>();
    const fitRef = useRef<HTMLDivElement | null>(null);
    const [availableWidth, setAvailableWidth] = useState(0);
    useAppEffect(() => {
        const element = fitRef.current;
        if (element === null || typeof ResizeObserver === 'undefined') {
            return;
        }
        const readWidth = () => {
            const nextWidth = Math.floor(element.clientWidth);
            // Bailing on an unchanged width keeps a resize from looping.
            setAvailableWidth((prevWidth) => {
                return prevWidth === nextWidth ? prevWidth : nextWidth;
            });
        };
        readWidth();
        const resizeObserver = new ResizeObserver(readWidth);
        resizeObserver.observe(element);
        return () => {
            resizeObserver.disconnect();
        };
    }, []);
    // An item saved with no size at all is possible (`CanvasItem` defaults both
    // to 0), and dividing by it yields Infinity and then NaN.
    const isSizeValid = props.width > 0 && props.height > 0;
    const scale =
        !isSizeValid || availableWidth <= 0
            ? 0
            : Math.min(
                  availableWidth / props.width,
                  MAX_PREVIEW_HEIGHT / props.height,
                  // Never upscale: blowing a 40x40 item up to the panel width
                  // costs an iframe/video rasterized at 7x for no new pixels.
                  1,
              );
    const offsetLeft = Math.max(
        0,
        Math.round((availableWidth - props.width * scale) / 2),
    );
    const offsetTop = Math.max(
        0,
        Math.round((MAX_PREVIEW_HEIGHT - props.height * scale) / 2),
    );
    const isContentRendered = scale > 0;
    const mediaSourceKey = toCanvasItemMediaSourceKey(props);
    useAppEffect(() => {
        const element = fitRef.current;
        if (element === null || !isContentRendered) {
            return;
        }
        // Mirrors what the presenter's mini screen does to the same markup, minus
        // every bit of screen syncing: the preview exists to be played, scrolled
        // and clicked.
        const mediaElements: HTMLMediaElement[] = [];
        for (const media of element.querySelectorAll('video, audio')) {
            if (
                media instanceof HTMLMediaElement === false ||
                // A camera is a device, not a file: its own button owns it.
                checkIsCameraMediaElement(media)
            ) {
                continue;
            }
            media.loop = false;
            media.muted = false;
            media.controls = true;
            // Beats the renderer's INLINE `pointer-events: none`, which is there
            // so a click on the canvas reaches the box editor, not the player.
            media.style.pointerEvents = 'auto';
            // A scratch preview must not veto collapsing the tools pane or
            // leaving the page the way a slide's own media does.
            media.dataset.ignoreMediaGuarding = 'true';
            mediaElements.push(media);
        }
        for (const iframe of element.querySelectorAll('iframe')) {
            iframe.style.pointerEvents = 'auto';
        }
        return () => {
            for (const media of mediaElements) {
                // Collapsing the section detaches the element mid-playback, and
                // nothing can reach it through the document afterwards — it
                // would keep making sound for ever.
                media.pause();
                // Only on a REAL unmount. React commits the new DOM before
                // running the previous cleanup, so stripping `src` on a
                // source-key change would blank what it just wrote.
                if (!media.isConnected) {
                    media.removeAttribute('src');
                    media.load();
                }
            }
        };
    }, [canvasItem.type, mediaSourceKey, isContentRendered]);
    const sourceText = toCanvasItemSourceText(props).slice(
        0,
        MAX_SOURCE_LENGTH,
    );
    return (
        <div className="canvas-item-preview w-100">
            <div className="cip-source d-flex align-items-center gap-1">
                <span className="badge text-bg-secondary flex-shrink-0">
                    {canvasItem.type}
                </span>
                <span className="app-ellipsis flex-fill" title={sourceText}>
                    {sourceText}
                </span>
                <span className="cip-dim flex-shrink-0">
                    {`${props.width}x${props.height}`}
                </span>
            </div>
            {canvasItem.type === 'camera' ? (
                <CanvasItemPreviewCameraControlComp previewRootRef={fitRef} />
            ) : null}
            <div
                ref={fitRef}
                className="cip-fit app-inner-shadow"
                style={{ height: `${MAX_PREVIEW_HEIGHT}px` }}
            >
                {isContentRendered ? (
                    <div
                        style={{
                            // Box chrome only — background, glass, rounding and
                            // the item's own size. No position, no rotation.
                            ...CanvasItem.genShapeBoxStyle(props),
                            // Also makes this the containing block for the
                            // video/camera badges, which are absolutely
                            // positioned inside their renderers.
                            position: 'absolute',
                            left: `${offsetLeft}px`,
                            top: `${offsetTop}px`,
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left',
                        }}
                    >
                        <CanvasItemRendererComp />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default function CanvasItemPreviewComp() {
    const canvasItem = useCanvasItemContext();
    const { canvasItems: selectedCanvasItems } =
        useSelectedCanvasItemsAndSetterContext();
    return (
        <SlideEditorToolTitleComp
            title={tran('Preview')}
            isCollapsible
            // Collapsed by default is the performance contract, not a style
            // choice: the section renders no children while collapsed, so a
            // website item opens no browsing context, a video decodes nothing
            // and a camera item touches no device until it is asked for.
            isInitiallyExpanded={false}
            // A multi-selection gets ONE card per item, so a persisted
            // "expanded" flag would mount N videos / N iframes at once the next
            // time several items are picked. Remember it for a lone item only.
            persistingKey={
                selectedCanvasItems.length > 1 ? '' : 'canvas-item-preview'
            }
        >
            {/* Split out so the observer, the media and the camera device list
                only exist while the section is open. */}
            <CanvasItemPreviewBodyComp key={canvasItem.id} />
        </SlideEditorToolTitleComp>
    );
}
