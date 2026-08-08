import {
    PREVIEW_ONLY_ATTR,
    WEBSITE_CAPTURE_SIZE_ATTR,
    WEBSITE_IFRAME_REFERRER_POLICY,
    WEBSITE_IFRAME_SANDBOX,
    WEBSITE_URL_ATTR,
} from '../../helper/constants';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';
import { parseWebsiteCaptureSize } from '../../helper/websiteCaptureHelpers';
import { handleError } from '../../helper/errorHelpers';

// Loaded on demand. `capturingHelpers` reaches React hooks, the settings chain
// and the display IPC, and only the two screenshot paths below ever need it —
// a projected screen goes straight to a live iframe. Keeping it out of the
// static graph keeps it out of every screen window's initial load.
async function importCapturing() {
    return await import('../../helper/capturingHelpers');
}

// How long the pointer must rest on a website box before its page is loaded.
// Matches the slide editor's own hover preview so the two feel the same.
const HOVER_LIVE_DELAY = 1e3;

function genWebsiteIframe(url: string, isInteractive: boolean) {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.title = url;
    // The same sandbox the editor's hover preview uses, so what the operator
    // previewed is what gets projected.
    iframe.setAttribute('sandbox', WEBSITE_IFRAME_SANDBOX);
    iframe.referrerPolicy = WEBSITE_IFRAME_REFERRER_POLICY;
    Object.assign(iframe.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
        backgroundColor: 'transparent',
        pointerEvents: isInteractive ? 'auto' : 'none',
    });
    return iframe;
}

function setPlaceholderVisibility(frame: HTMLElement, isVisible: boolean) {
    const placeholder = frame.querySelector(`[${PREVIEW_ONLY_ATTR}]`);
    if (placeholder instanceof HTMLElement) {
        // Hidden rather than removed: it is all that stands between the
        // operator and a blank box if the page fails to load, and the hover
        // preview has to put it straight back.
        placeholder.style.display = isVisible ? '' : 'none';
    }
}

/**
 * Paints the screenshot the React renderer could not. `genSlideHtml` runs the
 * whole tree through `renderToStaticMarkup`, which runs no effects, so the
 * markup that reaches a screen always carries the bare globe-and-url fallback.
 * The projected screen replaces it with the live page; the mini screen only
 * ever shows the shot, so it has to be fetched here.
 *
 * The size comes off `WEBSITE_CAPTURE_SIZE_ATTR`, never from layout: this runs
 * on a DETACHED div (`cleanupSlideContent` is called before the content is
 * appended), so every `offsetWidth` here is 0. Reading the stamped size also
 * makes this share one cache entry with the editor's own capture.
 */
async function fillScreenShot(frame: HTMLElement, url: string) {
    const size = parseWebsiteCaptureSize(
        frame.getAttribute(WEBSITE_CAPTURE_SIZE_ATTR),
    );
    if (size === null) {
        return;
    }
    try {
        const { captureWebScreenShot } = await importCapturing();
        const imageData = await captureWebScreenShot(url, {
            ...size,
            delay: 3000,
        });
        const placeholder = frame.querySelector(`[${PREVIEW_ONLY_ATTR}]`);
        if (!imageData || !(placeholder instanceof HTMLElement)) {
            // Leave the globe-and-url fallback rather than a blank box.
            return;
        }
        const image = document.createElement('img');
        image.alt = '';
        image.src = imageData;
        Object.assign(image.style, {
            width: '100%',
            height: '100%',
            // The capture is taken at the box's own aspect ratio, so filling it
            // distorts nothing.
            objectFit: 'fill',
            display: 'block',
        });
        placeholder.replaceChildren(image);
    } catch (error) {
        handleError(error);
    }
}

/**
 * Wires a mini screen's website box to load its page only while the pointer
 * rests on it. The mini screen is a PREVIEW: it renders every slide the
 * operator scrolls past, so eagerly loading those pages costs exactly what the
 * screenshot placeholder was introduced to avoid.
 */
function attachHoverPreview(frame: HTMLElement, url: string) {
    // PER-FRAME timer. A module-level one would collapse every website box in
    // the document into a single pending swap.
    const attemptTimeout = genTimeoutAttempt(HOVER_LIVE_DELAY);
    const setLive = (isLive: boolean) => {
        const existing = frame.querySelector('iframe');
        if (isLive === (existing !== null)) {
            return;
        }
        if (isLive) {
            frame.appendChild(genWebsiteIframe(url, true));
            setPlaceholderVisibility(frame, false);
        } else {
            existing?.remove();
            setPlaceholderVisibility(frame, true);
        }
    };
    frame.addEventListener('mouseover', () => {
        // Trailing edge only: dragging the pointer across a slide list must not
        // load a page for every box it crosses.
        attemptTimeout(() => {
            setLive(true);
        });
    });
    frame.addEventListener('mouseout', (event) => {
        // The live iframe is interactive here, so moving the pointer ONTO it
        // fires a bubbling `mouseout` on the frame. Tearing down on that would
        // flicker forever; only a move to somewhere outside the box counts.
        const relatedTarget = (event as MouseEvent).relatedTarget;
        if (relatedTarget instanceof Node && frame.contains(relatedTarget)) {
            return;
        }
        attemptTimeout(() => {
            setLive(false);
        }, true);
    });
}

/**
 * A website canvas item ships as a STATIC screenshot placeholder
 * (`BoxEditorNormalWebsiteRender`). The editor canvas, the tool item list,
 * slide thumbnails and print never load a live page: an iframe keeps that
 * page's scripts, timers and media running for as long as it is in the DOM, and
 * a document full of website slides would run all of them at once.
 *
 * This is the one place it becomes real, and only for the PROJECTED screen —
 * the audience has to see the live page. The presenter's mini screen is still
 * only a preview, so there it stays a screenshot until the operator hovers it.
 *
 * No teardown counterpart is needed, unlike the camera attachment: the whole
 * content div is replaced on a slide swap, and an iframe (and its listeners)
 * dies with its element.
 *
 * Takes the already-queried frames rather than the content div: the deep
 * (shadow-piercing) query lives in `ScreenVaryAppDocumentManager`, and
 * importing it here would close a cycle.
 */
export function hydrateWebsiteFrames(frames: Element[], isPageScreen: boolean) {
    for (const frame of frames) {
        if (frame instanceof HTMLElement === false) {
            continue;
        }
        const url = frame.getAttribute(WEBSITE_URL_ATTR) ?? '';
        // A second pass over the same node would double-load the page.
        if (url === '' || frame.dataset.websiteHydrated !== undefined) {
            continue;
        }
        frame.dataset.websiteHydrated = '';
        if (!isPageScreen) {
            attachHoverPreview(frame, url);
            // Fire and forget: the operator sees the globe-and-url fallback
            // until the shot lands, and a slide swap just discards this frame.
            void fillScreenShot(frame, url);
            continue;
        }
        // Held non-interactive on the projected output, exactly like a slide
        // video: the operator drives it from the mini screen. Set explicitly
        // rather than inherited — the placeholder's frame is a live hit target
        // now, so there is no `pointer-events: none` wrapper above it.
        frame.appendChild(genWebsiteIframe(url, false));
        setPlaceholderVisibility(frame, false);
    }
}

/**
 * The same rule for a web BACKGROUND: live only on the projected screen, a
 * screenshot on the presenter's mini screen. A background covers the whole
 * output, so an eagerly-loaded one is the most expensive live page in the app —
 * and every mini screen previewing it loaded its own copy.
 *
 * There is no hover-to-live counterpart here, unlike a website canvas item: the
 * whole `#background` container is `pointer-events: none`
 * (`ScreenBackgroundManager.containerStyle`), so it never sees a pointer.
 *
 * The projected screen's iframe is left exactly as it was — no sandbox, no
 * referrer policy. Tightening what is already being projected for real
 * services is a separate decision from not loading it in a preview.
 */
export function genWebBackgroundElement(url: string, isPageScreen: boolean) {
    if (isPageScreen) {
        const iframe = document.createElement('iframe');
        Object.assign(iframe.style, {
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: 'transparent',
        });
        iframe.src = url;
        return iframe;
    }
    const container = document.createElement('div');
    Object.assign(container.style, {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'transparent',
    });
    void (async () => {
        try {
            // Captured at the default display bounds with the same delay
            // `useWebCapturing` uses, so this lands on the cache entry the Webs
            // panel and the slide thumbnails already populated rather than
            // opening its own hidden window.
            const [{ captureWebScreenShot }, { getDefaultScreenDisplay }] =
                await Promise.all([
                    importCapturing(),
                    import('./screenHelpers'),
                ]);
            const screenDisplay = getDefaultScreenDisplay();
            const imageData = await captureWebScreenShot(url, {
                width: screenDisplay.bounds.width,
                height: screenDisplay.bounds.height,
                delay: 3000,
            });
            if (!imageData) {
                return;
            }
            const image = document.createElement('img');
            image.alt = '';
            image.src = imageData;
            Object.assign(image.style, {
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
            });
            container.replaceChildren(image);
        } catch (error) {
            handleError(error);
        }
    })();
    return container;
}
