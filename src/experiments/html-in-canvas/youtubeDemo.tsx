/**
 * YouTube inside the canvas.
 *
 * A YouTube embed is a cross-origin `<iframe>`, the one kind of content element
 * draws exclude for privacy (README 4.4), so `CanvasItemYouTube` is the app's
 * real functional regression if slides are ever rendered through this API.
 *
 * The first demo measures the hole instead of asserting it — it samples the
 * pixel where the player was drawn and reports what actually landed there. The
 * second demo shows the only way to keep a live player on a canvas-rendered
 * slide: leave the player in the DOM, on top of the canvas, and drive its
 * position from the matrix the draw returns.
 */
import { useRef, useState, type RefObject } from 'react';

import { useAppEffect } from '../../helper/appHooks';

import {
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    SLIDE_WIDTH,
    SLIDE_HEIGHT,
    COLOR,
    centeredScale,
    getHicContext,
    toErrorMessage,
    withSlideSpace,
} from './htmlInCanvasHelpers';
import {
    useHicCanvas,
    useAfterRenderingUpdate,
    useAnimationLoop,
    useThrottledCounter,
} from './htmlInCanvasHooks';
import {
    DemoFrameComp,
    ButtonComp,
    BadgeComp,
    CANVAS_STYLE,
    SlideComp,
} from './htmlInCanvasUiComps';
import type { HicContextType } from './htmlInCanvasTypes';

/** Big Buck Bunny — Creative Commons, and a long clip to sample from. */
const DEFAULT_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';

/** Where the player sits on the 1920x1080 slide. 16:9, like the app's item. */
const VIDEO_BOX = { left: 400, top: 300, width: 1120, height: 630 };

/**
 * `drawElementImage` returns the matrix that puts an element on its own drawn
 * pixels when assigned to its `style.transform` — measured against the element's
 * DEFAULT transform-origin (its centre), not `0 0`. So an overlay that copies
 * the drawn element's box and starts at the canvas origin takes the matrix
 * verbatim, and anything positioned inside that overlay lands correctly too.
 *
 * `canvas.getElementTransform` cannot do this job. It throws InvalidStateError
 * for anything that is not an immediate child of the canvas, and for a *scaled*
 * draw it returns exactly twice the draw matrix's translation — it applies the
 * centre-origin correction a second time — which lands the element
 * `(1 - scale) x its own size` away under any transform-origin. At scale 1 the
 * two agree, which is why the hit-testing demo (README 4.3) works.
 *
 * `BASE_TRANSFORM` is what the plain slide-space draw returns; the overlay needs
 * a transform on the frames before the first draw lands.
 */
const BASE_SCALE = PREVIEW_WIDTH / SLIDE_WIDTH;
const BASE_TRANSFORM =
    `matrix(${BASE_SCALE}, 0, 0, ${BASE_SCALE}, ` +
    `${(-(1 - BASE_SCALE) * SLIDE_WIDTH) / 2}, ` +
    `${(-(1 - BASE_SCALE) * SLIDE_HEIGHT) / 2})`;

/**
 * The colour behind the player. A cross-origin frame is not blanked to
 * transparent, it is blanked to whatever is painted underneath, so the probe
 * needs a colour that cannot be mistaken for video pixels.
 */
const HOLE_COLOR = { red: 39, green: 174, blue: 96 };
const HOLE_COLOR_CSS = `rgb(${HOLE_COLOR.red}, ${HOLE_COLOR.green}, ${HOLE_COLOR.blue})`;

/**
 * Mirrors `CanvasItemYouTube.toEmbedUrl`. Kept local on purpose: importing the
 * slide-editor class would drag its whole module graph into an experiment page
 * for one string transform.
 */
export function toEmbedUrl(url: string) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '');
        let videoId = '';
        if (host === 'youtu.be') {
            videoId = parsed.pathname.slice(1);
        } else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
            if (parsed.pathname === '/watch') {
                videoId = parsed.searchParams.get('v') ?? '';
            } else {
                const match = parsed.pathname.match(
                    /^\/(?:embed|shorts|live|v)\/([^/?#]+)/,
                );
                if (match !== null) {
                    videoId = match[1];
                }
            }
        }
        if (videoId !== '') {
            return `https://www.youtube.com/embed/${videoId}?rel=0&enablejsapi=1`;
        }
    } catch {
        // an unparseable URL is handed over as-is, like the app does
    }
    return url;
}

type ProbeType = { text: string; isHole: boolean };

/**
 * What colour is at the middle of the drawn player. `getImageData` also answers
 * the second question worth asking — whether drawing cross-origin content
 * tainted the canvas — because a tainted canvas throws SecurityError here.
 */
function readPixel(context: HicContextType, x: number, y: number): ProbeType {
    try {
        const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data;
        const isHole =
            Math.abs(red - HOLE_COLOR.red) < 8 &&
            Math.abs(green - HOLE_COLOR.green) < 8 &&
            Math.abs(blue - HOLE_COLOR.blue) < 8;
        return { text: `rgba(${red}, ${green}, ${blue}, ${alpha})`, isHole };
    } catch (error) {
        return { text: toErrorMessage(error), isHole: false };
    }
}

/**
 * `loading="lazy"` (what the app's item uses) is deliberately left off: inside a
 * `layoutsubtree` canvas the frame is laid out but never painted to the screen,
 * so a lazy frame can sit unloaded forever and look like the draw failed.
 */
function YouTubeEmbedComp({
    embedUrl,
    elementRef,
    onLoad,
}: {
    embedUrl: string;
    elementRef?: RefObject<HTMLIFrameElement | null>;
    onLoad?: () => void;
}) {
    return (
        <iframe
            ref={elementRef}
            src={embedUrl}
            title="youtube-embed"
            referrerPolicy="strict-origin-when-cross-origin"
            allow={
                'accelerometer; autoplay; clipboard-write; encrypted-media; ' +
                'gyroscope; picture-in-picture; web-share'
            }
            allowFullScreen
            onLoad={onLoad}
            style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
            }}
        />
    );
}

/** Applied on Enter or blur — retyping a URL must not reload on every key. */
function UrlInputComp({
    defaultUrl,
    onApply,
}: {
    defaultUrl: string;
    onApply: (url: string) => void;
}) {
    const [text, setText] = useState(defaultUrl);
    return (
        <input
            type="url"
            value={text}
            spellCheck={false}
            placeholder="YouTube URL"
            onChange={(event) => {
                setText(event.target.value);
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    onApply(text);
                }
            }}
            onBlur={() => {
                onApply(text);
            }}
            style={{
                width: 300,
                background: COLOR.panel,
                border: `1px solid ${COLOR.border}`,
                borderRadius: 4,
                color: COLOR.text,
                font: 'inherit',
                fontSize: 11,
                padding: '4px 6px',
                outline: 'none',
            }}
        />
    );
}

export function YouTubeComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const slideRef = useRef<HTMLDivElement | null>(null);
    const [embedUrl, setEmbedUrl] = useState(() => {
        return toEmbedUrl(DEFAULT_URL);
    });
    const [loadCount, setLoadCount] = useState(0);
    const [isControlShown, setIsControlShown] = useState(false);
    const [probe, setProbe] = useState<ProbeType | null>(null);
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
        const scale = canvas.width / SLIDE_WIDTH;
        setProbe(
            readPixel(
                context,
                Math.round((VIDEO_BOX.left + VIDEO_BOX.width / 2) * scale),
                Math.round((VIDEO_BOX.top + VIDEO_BOX.height / 2) * scale),
            ),
        );
    };

    // The player loads asynchronously, so the mount-time draw says nothing.
    // Redrawing on the frame's `load` is what makes the reading honest.
    useAfterRenderingUpdate(draw, [embedUrl, loadCount]);

    useAppEffect(() => {
        const canvas = canvasRef.current;
        if (canvas === null) {
            return;
        }
        canvas.onpaint = () => {
            paintCountRef.current += 1;
        };
        canvas.requestPaint();
        return () => {
            canvas.onpaint = null;
        };
    }, []);

    return (
        <DemoFrameComp
            summary={
                'A real YouTube embed drawn as part of a slide. The frame is ' +
                'cross-origin, so the draw leaves the parent background where ' +
                'the video should be — no error, no warning. The probe reads ' +
                'the pixel at the middle of the player instead of taking my ' +
                'word for it.'
            }
            controls={
                <>
                    <UrlInputComp
                        defaultUrl={DEFAULT_URL}
                        onApply={(url) => {
                            setEmbedUrl(toEmbedUrl(url));
                        }}
                    />
                    <ButtonComp label="Redraw + probe" onClick={draw} />
                    <ButtonComp
                        label={
                            isControlShown
                                ? 'hide DOM control'
                                : 'show DOM control'
                        }
                        onClick={() => {
                            setIsControlShown(!isControlShown);
                        }}
                        isActive={isControlShown}
                    />
                    <BadgeComp label={`paints: ${paintCount}`} />
                    {probe === null ? null : (
                        <BadgeComp
                            label={probe.isHole ? 'blank hole' : 'video pixels'}
                            tone={probe.isHole ? 'bad' : 'good'}
                        />
                    )}
                </>
            }
            notes={
                <>
                    The probe compares against <code>{HOLE_COLOR_CSS}</code>,
                    the colour painted behind the player — reading exactly that
                    back means the frame contributed nothing. The DOM control
                    renders the same URL as an ordinary iframe, so a blank
                    canvas next to a playing control is the API, not a dead
                    link. Note the canvas is <em>not</em> tainted by the
                    attempt:
                    <code> getImageData</code> keeps working, which is the whole
                    point of excluding the content in the first place.
                </>
            }
        >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div>
                    <div
                        style={{
                            fontSize: 11,
                            color: COLOR.muted,
                            marginBottom: 4,
                        }}
                    >
                        drawn through the canvas
                    </div>
                    <canvas
                        ref={setCanvasRef}
                        width={PREVIEW_WIDTH}
                        height={PREVIEW_HEIGHT}
                        style={CANVAS_STYLE}
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
                                    background: HOLE_COLOR_CSS,
                                }}
                            >
                                <YouTubeEmbedComp
                                    embedUrl={embedUrl}
                                    onLoad={() => {
                                        setLoadCount((count) => {
                                            return count + 1;
                                        });
                                    }}
                                />
                            </div>
                        </SlideComp>
                    </canvas>
                    <div
                        style={{
                            fontFamily: 'monospace',
                            fontSize: 11,
                            color: probe?.isHole ? COLOR.bad : COLOR.muted,
                            marginTop: 6,
                        }}
                    >
                        {`centre pixel: ${probe?.text ?? '-'}`}
                    </div>
                </div>
                {isControlShown ? (
                    <div>
                        <div
                            style={{
                                fontSize: 11,
                                color: COLOR.good,
                                marginBottom: 4,
                            }}
                        >
                            same URL, plain DOM
                        </div>
                        <div
                            style={{
                                width: 280,
                                height: 158,
                                background: HOLE_COLOR_CSS,
                                border: `1px solid ${COLOR.border}`,
                                borderRadius: 4,
                                overflow: 'hidden',
                            }}
                        >
                            <YouTubeEmbedComp embedUrl={embedUrl} />
                        </div>
                    </div>
                ) : null}
            </div>
        </DemoFrameComp>
    );
}

/**
 * The player never enters the canvas subtree. The slide is drawn with a hole
 * reserved for it, and an overlay layer — an ordinary DOM sibling stacked over
 * the canvas, in slide coordinates, holding the real iframe — is moved onto the
 * drawn slide by the matrix `drawElementImage` returns. That keeps a live,
 * clickable, audible player on a canvas-rendered slide, and it is the shape the
 * app would need: one overlay layer per screen holding every live item.
 */
export function YouTubeOverlayComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const slideRef = useRef<HTMLDivElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const [embedUrl, setEmbedUrl] = useState(() => {
        return toEmbedUrl(DEFAULT_URL);
    });
    const [isOverlayShown, setIsOverlayShown] = useState(true);
    const [isZooming, setIsZooming] = useState(false);
    const [matrixText, setMatrixText] = useState('-');

    const drawFrame = (zoom: number) => {
        const canvas = canvasRef.current;
        const context = getHicContext(canvas);
        if (canvas === null || context === null || slideRef.current === null) {
            return null;
        }
        const slide = slideRef.current;
        const drawn: { matrix: DOMMatrix | null } = { matrix: null };
        context.reset();
        withSlideSpace(context, canvas, () => {
            context.save();
            centeredScale(context, zoom);
            drawn.matrix = context.drawElementImage(slide, 0, 0);
            context.restore();
        });
        const overlay = overlayRef.current;
        if (overlay === null || drawn.matrix === null) {
            return null;
        }
        // The overlay layer is a copy of the drawn root's box, so the matrix
        // goes on unchanged and everything positioned inside the layer lands on
        // its own drawn pixels for free.
        overlay.style.transform = drawn.matrix.toString();
        return drawn.matrix;
    };

    useAfterRenderingUpdate(() => {
        const matrix = drawFrame(1);
        if (matrix !== null) {
            setMatrixText(
                `scale ${matrix.a.toFixed(3)} · offset ` +
                    `${matrix.e.toFixed(1)}, ${matrix.f.toFixed(1)}`,
            );
        }
    }, [embedUrl, isOverlayShown, isZooming]);

    useAnimationLoop((elapsedMillisecond) => {
        const wave = (Math.sin(elapsedMillisecond / 700) + 1) / 2;
        drawFrame(0.72 + 0.28 * wave);
    }, isZooming);

    return (
        <DemoFrameComp
            summary={
                'The workaround for the blank hole: draw the slide without the ' +
                'player, and stack an overlay layer in slide coordinates over ' +
                'the canvas carrying the real iframe. The layer wears the ' +
                'matrix drawElementImage returned, so the player is live and ' +
                'clickable and tracks whatever the draw does — including a ' +
                'canvas-space zoom.'
            }
            controls={
                <>
                    <UrlInputComp
                        defaultUrl={DEFAULT_URL}
                        onApply={(url) => {
                            setEmbedUrl(toEmbedUrl(url));
                        }}
                    />
                    <ButtonComp
                        label={isOverlayShown ? 'overlay: on' : 'overlay: off'}
                        onClick={() => {
                            setIsOverlayShown(!isOverlayShown);
                        }}
                        isActive={isOverlayShown}
                    />
                    <ButtonComp
                        label={isZooming ? 'stop zoom' : 'animate zoom'}
                        onClick={() => {
                            setIsZooming(!isZooming);
                        }}
                        isActive={isZooming}
                    />
                    <BadgeComp label={matrixText} />
                </>
            }
            notes={
                <>
                    Turn the overlay off to see the hole the drawn slide leaves.
                    What the overlay costs: those pixels are DOM, not canvas, so
                    nothing done in canvas space touches them —{' '}
                    <code>ctx.filter</code>, <code>ctx.clip()</code> wipes and
                    per-slide <code>globalAlpha</code> all stop at the player’s
                    edge, and the overlay has to be re-synced every frame of a
                    transition (that is what the zoom button exercises). It also
                    sits above <em>everything</em> drawn afterwards, so a slide
                    item overlapping the player cannot paint over it.
                </>
            }
        >
            {/*
                The frame carries the border so the wrapper's content box is
                exactly the canvas's: the overlay is positioned at 0,0 of it and
                the draw transform then needs no border fudge.
            */}
            <div
                style={{
                    position: 'relative',
                    width: PREVIEW_WIDTH,
                    height: PREVIEW_HEIGHT,
                    background: '#000',
                    border: `1px solid ${COLOR.border}`,
                    borderRadius: 4,
                    overflow: 'hidden',
                }}
            >
                <canvas
                    ref={setCanvasRef}
                    width={PREVIEW_WIDTH}
                    height={PREVIEW_HEIGHT}
                    style={{ ...CANVAS_STYLE, border: 'none', borderRadius: 0 }}
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
                                border: '6px dashed rgba(255,255,255,0.35)',
                                boxSizing: 'border-box',
                                color: 'rgba(255,255,255,0.55)',
                                font: '48px sans-serif',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            player mounts here
                        </div>
                    </SlideComp>
                </canvas>
                <div
                    ref={overlayRef}
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: SLIDE_WIDTH,
                        height: SLIDE_HEIGHT,
                        // The layer only carries the player, so it must not
                        // swallow clicks over the rest of the slide.
                        pointerEvents: 'none',
                        // Replaced by the draw transform on the first draw;
                        // this is what the frames before it use.
                        transform: BASE_TRANSFORM,
                        visibility: isOverlayShown ? 'visible' : 'hidden',
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            left: VIDEO_BOX.left,
                            top: VIDEO_BOX.top,
                            width: VIDEO_BOX.width,
                            height: VIDEO_BOX.height,
                            pointerEvents: 'auto',
                        }}
                    >
                        <YouTubeEmbedComp embedUrl={embedUrl} />
                    </div>
                </div>
            </div>
        </DemoFrameComp>
    );
}
