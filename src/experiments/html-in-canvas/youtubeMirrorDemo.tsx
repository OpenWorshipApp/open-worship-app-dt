/**
 * Mirroring the real YouTube player's pixels out of its iframe.
 *
 * The draw refuses a cross-origin frame and nothing in the platform will hand
 * its pixels over — except a capture of your own page. Chromium's Region
 * Capture (`CropTarget` + `track.cropTo`) and Element Capture
 * (`RestrictionTarget` + `track.restrictTo`) narrow a self tab-capture down to
 * one element, and they accept an `<iframe>` as that element. The result is an
 * ordinary `MediaStreamTrack`, so the player's picture becomes a `<video>` —
 * which the draw *does* capture.
 *
 * So this is the third route onto a canvas-rendered slide, and the only one
 * that keeps the real player: its chrome, its captions, its ads, and a live
 * broadcast that `yt-dlp` cannot seek two copies of into alignment.
 *
 * The capture needs `initDisplayMediaHandler` (`electron/displayMediaHelpers`)
 * to have answered the `getDisplayMedia` request, otherwise Electron rejects it
 * with `NotSupportedError: Not supported`.
 */
import { useRef, useState } from 'react';

import { useAppCurrentRef, useAppEffect } from '../../helper/appHooks';

import {
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    COLOR,
    getHicContext,
    runDrawGuarded,
    toErrorMessage,
    withSlideSpace,
} from './htmlInCanvasHelpers';
import {
    useHicCanvas,
    useAfterRenderingUpdate,
    useThrottledCounter,
} from './htmlInCanvasHooks';
import {
    DemoFrameComp,
    ButtonComp,
    BadgeComp,
    CANVAS_STYLE,
    SlideComp,
} from './htmlInCanvasUiComps';
import type { CaptureTrackType } from './htmlInCanvasTypes';

const DEFAULT_URL =
    'https://www.youtube.com/embed/aqz-KE-bpKQ?rel=0&autoplay=1&mute=1';

/** Where the mirrored picture sits on the 1920x1080 slide. */
const VIDEO_BOX = { left: 400, top: 300, width: 1120, height: 630 };

/**
 * The source player is laid out at half slide width because a mirror can only
 * ever be as sharp as the pixels on the screen: a tab capture rasterizes the
 * viewport at device pixels and the crop is a crop, so the mirrored track is
 * the element's CSS size x devicePixelRatio. Shrink this box and the projected
 * picture gets soft — that is the ceiling, not a setting.
 */
const SOURCE_BOX = { width: 480, height: 270 };

const PREVIEW_SIZE = { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT };

/**
 * Full-viewport backing stores are allocated in device pixels, so a hi-dpi
 * window asks for a lot of memory for what is only a bigger look at the same
 * frames. Cap the long edge; `withSlideSpace` scales to whatever it gets.
 */
const MAX_FULL_VIEWPORT_WIDTH = 3840;

type MirrorModeType = 'element' | 'region';

/**
 * `cropTo`/`restrictTo` resolve before the pipeline is actually narrowed — read
 * `getSettings()` on the next line and it still reports the whole viewport, so
 * a check there fails a capture that was about to be perfectly fine. Wait for
 * the track to report a size that could only be the element; `null` means it
 * never did.
 */
async function waitForNarrowing(
    track: MediaStreamTrack,
    iframe: HTMLIFrameElement,
) {
    // Generous, because the capture picks its own pixel ratio: the same element
    // has measured anywhere from 1.5x to 3x its CSS width across runs.
    const widthCeiling = iframe.clientWidth * 4;
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const { width = 0 } = track.getSettings();
        if (width > 0 && width <= widthCeiling) {
            return width;
        }
        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
    }
    return null;
}

/**
 * Element Capture takes the element's own subtree and leaves out anything
 * stacked over it, so the player can sit *under* the UI and still mirror clean.
 * Region Capture only crops to its box, so occluders come along — but it has
 * been in Chromium since 104 where Element Capture landed in 132.
 *
 * Neither is reliably sharper, whatever an earlier note here said. Both mirror
 * a 480x270 source at 1440x810 on a `devicePixelRatio` 3 window — but Region
 * Capture has also come back at half that on the same source, so read
 * `getSettings()` instead of predicting the factor. Element Capture has
 * measured full device pixel ratio every time.
 *
 * **Element Capture fails open, not loud.** Its target must form a stacking
 * context, and a bare `<iframe>` does not: `restrictTo` still resolves, the
 * track simply never narrows and you go on mirroring the whole page. Measured
 * on the same iframe, back to back — bare: 2241x1401 (the viewport), with
 * `isolation: isolate`: 1440x810 (the element). That is why the source below
 * carries `isolation`, and why this checks the result instead of trusting it.
 */
async function startMirror(
    iframe: HTMLIFrameElement,
    mode: MirrorModeType,
): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
    });
    const track = stream.getVideoTracks()[0] as CaptureTrackType;
    try {
        if (mode === 'element') {
            await track.restrictTo(await RestrictionTarget.fromElement(iframe));
        } else {
            await track.cropTo(await CropTarget.fromElement(iframe));
        }
        const width = await waitForNarrowing(track, iframe);
        if (width === null) {
            throw new Error(
                `narrowing did not take: the track stayed ` +
                    `${track.getSettings().width}px wide for a ` +
                    `${iframe.clientWidth}px element — the target is probably ` +
                    'not a stacking context',
            );
        }
    } catch (error) {
        // A capture of the whole page would be a privacy surprise, not a
        // degraded demo, so a failed narrowing takes the stream down with it.
        for (const each of stream.getTracks()) {
            each.stop();
        }
        throw error;
    }
    return stream;
}

function toTrackSize(stream: MediaStream | null) {
    if (stream === null) {
        return '-';
    }
    const [track] = stream.getVideoTracks();
    const { width, height } = track?.getSettings() ?? {};
    if (width === undefined || height === undefined) {
        return 'starting…';
    }
    return `mirror: ${width}x${height}`;
}

export function YouTubeMirrorComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const slideRef = useRef<HTMLDivElement | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [mode, setMode] = useState<MirrorModeType>('element');
    const [isHidingPointer, setIsHidingPointer] = useState(false);
    const [isMirroring, setIsMirroring] = useState(false);
    const [isFullViewport, setIsFullViewport] = useState(false);
    const [canvasSize, setCanvasSize] = useState(PREVIEW_SIZE);
    const [status, setStatus] = useState('not mirroring');
    const [trackSize, setTrackSize] = useState('-');
    const [paintCount, paintCountRef] = useThrottledCounter();

    const draw = () => {
        const canvas = canvasRef.current;
        const context = getHicContext(canvas);
        if (canvas === null || context === null || slideRef.current === null) {
            return;
        }
        const slide = slideRef.current;
        context.reset();
        withSlideSpace(context, canvas, () => {
            context.drawElementImage(slide, 0, 0);
        });
    };
    const drawRef = useAppCurrentRef(draw);
    const isMirroringRef = useAppCurrentRef(isMirroring);

    useAfterRenderingUpdate(draw, [
        isMirroring,
        canvasSize.width,
        canvasSize.height,
    ]);

    // Full viewport tracks the window and takes Escape, because a canvas over
    // the whole page with its own button underneath it would be a trap.
    useAppEffect(() => {
        if (!isFullViewport) {
            setCanvasSize(PREVIEW_SIZE);
            return;
        }
        const applySize = () => {
            const ratio = globalThis.devicePixelRatio || 1;
            const scale = Math.min(
                ratio,
                MAX_FULL_VIEWPORT_WIDTH / globalThis.innerWidth,
            );
            setCanvasSize({
                width: Math.round(globalThis.innerWidth * scale),
                height: Math.round(globalThis.innerHeight * scale),
            });
        };
        applySize();
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsFullViewport(false);
            }
        };
        globalThis.addEventListener('resize', applySize);
        globalThis.addEventListener('keydown', handleKeyDown);
        return () => {
            globalThis.removeEventListener('resize', applySize);
            globalThis.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFullViewport]);

    useAppEffect(() => {
        const canvas = canvasRef.current;
        if (canvas === null) {
            return;
        }
        // The mirrored `<video>` invalidates the subtree per delivered frame,
        // exactly like a local clip would.
        canvas.onpaint = () => {
            paintCountRef.current += 1;
            if (!isMirroringRef.current) {
                return;
            }
            runDrawGuarded(() => {
                drawRef.current();
            });
        };
        canvas.requestPaint();
        return () => {
            canvas.onpaint = null;
        };
    }, []);

    const stopMirror = () => {
        const stream = streamRef.current;
        if (stream !== null) {
            for (const track of stream.getTracks()) {
                track.stop();
            }
            streamRef.current = null;
        }
        if (videoRef.current !== null) {
            videoRef.current.srcObject = null;
        }
        setIsMirroring(false);
        setTrackSize('-');
        setStatus('not mirroring');
    };

    // A capture left running would keep reading the operator's page after the
    // demo is gone.
    useAppEffect(() => {
        return () => {
            const stream = streamRef.current;
            if (stream !== null) {
                for (const track of stream.getTracks()) {
                    track.stop();
                }
            }
        };
    }, []);

    const toggleMirror = async () => {
        if (isMirroring) {
            stopMirror();
            return;
        }
        const iframe = iframeRef.current;
        const video = videoRef.current;
        if (iframe === null || video === null) {
            return;
        }
        setStatus('requesting capture…');
        try {
            const stream = await startMirror(iframe, mode);
            streamRef.current = stream;
            video.srcObject = stream;
            setIsMirroring(true);
            setStatus(`mirroring via ${mode} capture`);
            setTrackSize(toTrackSize(stream));
            // Not awaited: a play() that never settles would otherwise strand
            // the whole demo on "requesting capture…" with a live capture
            // running and no way to see it or stop it.
            video.play().catch((error: unknown) => {
                setStatus(toErrorMessage(error));
            });
        } catch (error) {
            setStatus(toErrorMessage(error));
        }
    };

    return (
        <DemoFrameComp
            summary={
                'The real player, mirrored. A self tab-capture narrowed to the ' +
                'YouTube iframe by Element Capture (or Region Capture) comes ' +
                'back as a MediaStreamTrack, and that track played in a ' +
                '<video> inside the slide is content the draw captures. This ' +
                'is the only route that keeps the actual player — chrome, ' +
                'captions and all — and the only one that works for a live ' +
                'broadcast.'
            }
            controls={
                <>
                    <ButtonComp
                        label={isMirroring ? 'stop mirroring' : 'mirror out'}
                        onClick={() => {
                            void toggleMirror();
                        }}
                        isActive={isMirroring}
                    />
                    <ButtonComp
                        label={
                            mode === 'element'
                                ? 'Element Capture'
                                : 'Region Capture'
                        }
                        onClick={() => {
                            stopMirror();
                            setMode(mode === 'element' ? 'region' : 'element');
                        }}
                    />
                    <ButtonComp
                        label={
                            isHidingPointer
                                ? 'pointer hidden over source'
                                : 'hide pointer over source'
                        }
                        onClick={() => {
                            setIsHidingPointer(!isHidingPointer);
                        }}
                        isActive={isHidingPointer}
                    />
                    <ButtonComp
                        label={
                            isFullViewport
                                ? 'exit full viewport'
                                : 'full viewport'
                        }
                        onClick={() => {
                            setIsFullViewport(!isFullViewport);
                        }}
                        isActive={isFullViewport}
                    />
                    <BadgeComp label={`paints: ${paintCount}`} />
                    <BadgeComp label={trackSize} />
                    <BadgeComp
                        label={status}
                        tone={isMirroring ? 'good' : 'muted'}
                    />
                </>
            }
            notes={
                <>
                    Two things decide whether this is usable. The player must be
                    genuinely <em>painted</em> — the iframe inside a{' '}
                    <code>layoutsubtree</code> canvas is laid out but never
                    painted, so it cannot be a capture source, and neither can{' '}
                    <code>display: none</code> or a scrolled-away element. And
                    the mirror is only as sharp as the pixels on screen: the
                    track is the source element&apos;s CSS size × the
                    capture&apos;s device pixel ratio, so projecting 720p needs
                    a source laid out near 1280×720. Element Capture excludes
                    occluding content, which is what lets a full-size player sit
                    under the UI and still mirror clean — but its target has to
                    form a stacking context, and on a bare{' '}
                    <code>&lt;iframe&gt;</code> it resolves and then quietly
                    mirrors the whole page, so the source here carries{' '}
                    <code>isolation: isolate</code>. The mouse pointer{' '}
                    <em>is</em> captured, but only while it moves — the track
                    reports <code>cursor: &quot;motion&quot;</code> and means it
                    literally, so a scan taken while the pointer rests looks
                    clean and proves nothing. No API turns it off: Chromium 150
                    has dropped the <code>cursor</code> constraint from{' '}
                    <code>getSupportedConstraints()</code> and from the
                    track&apos;s capabilities, and{' '}
                    <code>
                        applyConstraints({'{'}cursor: &apos;never&apos;{'}'})
                    </code>{' '}
                    is accepted and ignored. What is left is to make the pointer
                    not exist over the source: <em>hide pointer</em> lays a{' '}
                    <code>cursor: none</code> layer in front of the player,
                    since the capture composites whatever cursor the hovered
                    element asks for and the parent cannot set that inside a
                    cross-origin frame. The layer swallows clicks to the player
                    — that is the price. DRM titles (YouTube rentals) capture as
                    black frames. The same track is what a{' '}
                    <code>RTCPeerConnection</code> would carry to the screen
                    windows, which is where this beats resolving a stream: two
                    players cannot be seeked into alignment on a live feed, but
                    one mirrored track is frame-identical by construction.
                </>
            }
        >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/*
                    The canvas covers the controls when it goes full viewport,
                    so the way back has to sit above it. Escape works too.
                */}
                {isFullViewport ? (
                    <div
                        style={{
                            position: 'fixed',
                            top: 12,
                            right: 12,
                            zIndex: 61,
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                        }}
                    >
                        <BadgeComp label={trackSize} />
                        <ButtonComp
                            label="exit full viewport (Esc)"
                            onClick={() => {
                                setIsFullViewport(false);
                            }}
                            isActive
                        />
                    </div>
                ) : null}
                <div>
                    <div
                        style={{
                            fontSize: 11,
                            color: COLOR.muted,
                            marginBottom: 4,
                        }}
                    >
                        the mirror, drawn through the canvas
                    </div>
                    <canvas
                        ref={setCanvasRef}
                        width={canvasSize.width}
                        height={canvasSize.height}
                        style={
                            isFullViewport
                                ? {
                                      ...CANVAS_STYLE,
                                      position: 'fixed',
                                      inset: 0,
                                      width: '100vw',
                                      height: '100vh',
                                      border: 'none',
                                      borderRadius: 0,
                                      zIndex: 60,
                                  }
                                : CANVAS_STYLE
                        }
                    >
                        <SlideComp
                            elementRef={slideRef}
                            background="linear-gradient(160deg, #123a5e, #06141f)"
                            heading="YouTube on a slide"
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    left: VIDEO_BOX.left,
                                    top: VIDEO_BOX.top,
                                    width: VIDEO_BOX.width,
                                    height: VIDEO_BOX.height,
                                    background: '#000',
                                }}
                            >
                                <video
                                    ref={videoRef}
                                    muted
                                    playsInline
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain',
                                        display: 'block',
                                    }}
                                />
                            </div>
                        </SlideComp>
                    </canvas>
                </div>
                <div>
                    <div
                        style={{
                            fontSize: 11,
                            color: COLOR.good,
                            marginBottom: 4,
                        }}
                    >
                        the capture source — a real, painted player
                    </div>
                    <div
                        style={{
                            position: 'relative',
                            width: SOURCE_BOX.width,
                            height: SOURCE_BOX.height,
                        }}
                    >
                        <iframe
                            ref={iframeRef}
                            src={DEFAULT_URL}
                            title="youtube-mirror-source"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allow="autoplay; encrypted-media; picture-in-picture"
                            style={{
                                width: '100%',
                                height: '100%',
                                // Or the border pushes the frame past the
                                // wrapper and the `cursor: none` layer below
                                // leaves a 1px ring of live pointer around it.
                                boxSizing: 'border-box',
                                border: `1px solid ${COLOR.border}`,
                                borderRadius: 4,
                                display: 'block',
                                // Load-bearing for Element Capture: without a
                                // stacking context here `restrictTo` resolves
                                // and quietly mirrors the whole page instead.
                                isolation: 'isolate',
                            }}
                        />
                        {/*
                            The capture composites whatever cursor bitmap the
                            hovered element asks for, so the way to keep the
                            pointer out of the mirror is to make it not exist
                            over the source rather than to ask the capture to
                            omit it — there is no constraint left that does.
                            The parent cannot reach inside a cross-origin frame
                            to set this, but it can put its own hit-testable
                            layer in front of it. That layer takes the clicks,
                            which is the cost. It is not a descendant of the
                            iframe, so Element Capture leaves it out of the
                            mirror entirely; under Region Capture it is
                            transparent anyway.
                        */}
                        {isHidingPointer ? (
                            <div
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    cursor: 'none',
                                }}
                            />
                        ) : null}
                    </div>
                    <div
                        style={{
                            fontFamily: 'monospace',
                            fontSize: 11,
                            color: COLOR.muted,
                            marginTop: 6,
                            maxWidth: SOURCE_BOX.width,
                        }}
                    >
                        {`source: ${SOURCE_BOX.width}x${SOURCE_BOX.height} css`}
                    </div>
                </div>
            </div>
        </DemoFrameComp>
    );
}
