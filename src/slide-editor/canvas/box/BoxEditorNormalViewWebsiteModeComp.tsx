import type { MouseEvent } from 'react';
import { use, useCallback, useMemo, useRef, useState } from 'react';

import type { CanvasItemWebsitePropsType } from '../CanvasItemWebsite';
import CanvasItemWebsite from '../CanvasItemWebsite';
import { BoxEditorNormalViewErrorRenderComp } from './BoxEditorNormalViewErrorComp';
import { handleError } from '../../../helper/errorHelpers';
import { useCanvasItemPropsContext } from '../CanvasItem';
import BoxEditorNormalWebsitePlaceHolderComp from './BoxEditorNormalWebsitePlaceHolderComp';
import { CanvasControllerContext } from '../CanvasController';
import { useWebCapturing } from '../../../helper/capturingHelpers';
import { useAppEffect } from '../../../helper/appHooks';
import { genTimeoutAttempt } from '../../../helper/timeoutHelpers';
import { genWebsiteCaptureSize } from '../../../helper/websiteCaptureHelpers';
import {
    WEBSITE_CAPTURE_SIZE_ATTR,
    WEBSITE_IFRAME_REFERRER_POLICY,
    WEBSITE_IFRAME_SANDBOX,
    WEBSITE_ITEM_ATTR,
    WEBSITE_URL_ATTR,
} from '../../../helper/constants';

function BoxEditorNormalWebsiteFrameComp({
    itemProps,
}: Readonly<{
    itemProps: CanvasItemWebsitePropsType;
}>) {
    const frameRef = useRef<HTMLDivElement | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    // Capturing opens a hidden BrowserWindow, loads the page and sleeps for
    // seconds. A document's slide list mounts EVERY slide at once, so hold off
    // until the box is actually scrolled into view — otherwise opening a file
    // fires one capture per website item in it. Same lazy-mount shape as
    // `BackgroundVideosComp`.
    useAppEffect(() => {
        const frame = frameRef.current;
        if (isVisible || frame === null) {
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            if (
                entries.some((entry) => {
                    return entry.isIntersecting;
                })
            ) {
                setIsVisible(true);
            }
        });
        observer.observe(frame);
        return () => {
            observer.disconnect();
        };
    }, [isVisible]);

    const { width: captureWidth, height: captureHeight } = useMemo(() => {
        return genWebsiteCaptureSize(itemProps.width, itemProps.height);
    }, [itemProps.width, itemProps.height]);
    const imageData = useWebCapturing(itemProps.url, {
        width: captureWidth,
        height: captureHeight,
        isEnabled: isVisible,
    });

    // Only the slide editor goes live on hover. The presenter's slide list
    // renders this same component for every slide of the document, and a
    // hovered thumbnail must not start loading a page there; the screen and
    // print never run effects at all (`renderToStaticMarkup`). The bible item
    // uses this same null-context test for the same "am I in the editor?"
    // question.
    const canvasController = use(CanvasControllerContext);
    const isHoverable = canvasController !== null;
    const [isLive, setIsLive] = useState(false);
    // PER-INSTANCE (see CLAUDE.md): a module-level timer would collapse every
    // website box on the canvas into one, so hovering box B would cancel box
    // A's pending swap.
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(1e3);
    }, []);
    const handleMouseOver = useCallback(() => {
        // Trailing edge ONLY. Dragging the pointer across the canvas must not
        // load a page for every box it crosses.
        attemptTimeout(() => {
            setIsLive(true);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleMouseOut = useCallback((event: MouseEvent<HTMLDivElement>) => {
        // Only a move to somewhere OUTSIDE the box counts. Every descendant is
        // `pointer-events: none` today so this cannot fire for a child, but
        // that invariant is easy to break by adding a badge later — and then
        // the bubbling mouseover/mouseout pair would flicker forever.
        const { relatedTarget } = event;
        if (
            relatedTarget instanceof Node &&
            event.currentTarget.contains(relatedTarget)
        ) {
            return;
        }
        // `isImmediate` cancels a pending "go live" AND tears down now.
        attemptTimeout(() => {
            setIsLive(false);
        }, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handlePointerDown = useCallback(() => {
        // A drag keeps the pointer inside the box, so no `mouseout` ever
        // arrives and the iframe would pop in mid-gesture.
        attemptTimeout(() => {
            setIsLive(false);
        }, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div
            ref={frameRef}
            title={itemProps.url}
            // The screen manager finds this element by these marks and hangs a
            // live iframe inside it. Everywhere else it stays a screenshot, so
            // opening a document full of website slides loads no pages.
            {...{
                [WEBSITE_ITEM_ATTR]: '',
                [WEBSITE_URL_ATTR]: itemProps.url,
                // The mini screen and print fill the screenshot in themselves,
                // off a DETACHED div where no element has a layout box. This
                // is how they learn the size — and how they end up sharing one
                // cache entry with the capture requested just above.
                [WEBSITE_CAPTURE_SIZE_ATTR]: `${captureWidth}x${captureHeight}`,
            }}
            // Bubbling variants, NOT enter/leave: both the editor canvas and
            // the slide previews render into a shadow root through
            // `ShadowingFillParentWidthComp`, where React cannot synthesize
            // mouseenter/mouseleave.
            onMouseOver={isHoverable ? handleMouseOver : undefined}
            onMouseOut={isHoverable ? handleMouseOut : undefined}
            onPointerDown={isHoverable ? handlePointerDown : undefined}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                // NO `pointerEvents: 'none'` here, unlike the old iframe
                // wrapper. This element has to stay a hit target or the hover
                // handlers never fire; the box stays draggable anyway because
                // `pointerdown` bubbles out of a plain div — only an iframe
                // swallowed it. Every descendant below is `none` so that this
                // stays the ONLY hit target in the box: anything else in here
                // makes the bubbling mouseover/mouseout pair flap.
            }}
        >
            <BoxEditorNormalWebsitePlaceHolderComp
                url={itemProps.url}
                imageData={imageData}
                boxWidth={itemProps.width}
                boxHeight={itemProps.height}
            />
            {isLive ? (
                <iframe
                    src={itemProps.url}
                    title={`website-${itemProps.id}`}
                    sandbox={WEBSITE_IFRAME_SANDBOX}
                    referrerPolicy={WEBSITE_IFRAME_REFERRER_POLICY}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        display: 'block',
                        backgroundColor: 'transparent',
                        // Mandatory. An iframe swallows every pointer event, so
                        // without this the box stops dragging the moment it
                        // appears and the frame fires a spurious `mouseout`.
                        pointerEvents: 'none',
                    }}
                />
            ) : null}
        </div>
    );
}

export function BoxEditorNormalWebsiteRender() {
    const props = useCanvasItemPropsContext<CanvasItemWebsitePropsType>();
    try {
        CanvasItemWebsite.validate(props);
    } catch (error) {
        handleError(error);
        return <BoxEditorNormalViewErrorRenderComp />;
    }
    // The hooks live one level down so this early return cannot make them
    // conditional — and so an invalid item never triggers a capture.
    return <BoxEditorNormalWebsiteFrameComp itemProps={props} />;
}
