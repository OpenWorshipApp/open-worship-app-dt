import {
    CAMERA_DEVICE_ID_ATTR,
    CAMERA_DEVICE_LABEL_ATTR,
    CAMERA_ITEM_ATTR,
    PREVIEW_ONLY_ATTR,
} from '../../helper/constants';
import {
    acquireCameraStream,
    releaseCameraStream,
    resolveCameraDeviceId,
} from '../../helper/cameraHelpers';
import { handleError } from '../../helper/errorHelpers';
import { playMediaElement } from '../../helper/mediaHelpers';

/**
 * A camera canvas item's `<video>`, as emitted by
 * `BoxEditorNormalViewCameraModeComp`. A live device feed must stay OUT of the
 * slide media sync path entirely: `getMediaSyncSrc` would key it by a `blob:`
 * url that differs per stream and per window, native controls would offer a
 * scrub bar for something with no timeline, and a group pause would freeze the
 * picture on every screen.
 */
export function checkIsCameraMediaElement(element: Element) {
    return element.hasAttribute(CAMERA_ITEM_ATTR);
}

/**
 * Hide the placeholder badge once the feed is actually up. The projected screen
 * already hides every preview-only element wholesale, but the presenter's mini
 * screen does not — mirrors `setSlideVideoBadgeVisibility`.
 */
export function setCameraBadgeVisibility(
    videoElement: HTMLVideoElement,
    isVisible: boolean,
) {
    const badge = videoElement.parentElement?.querySelector(
        `[${PREVIEW_ONLY_ATTR}]`,
    );
    if (badge instanceof HTMLElement || badge instanceof SVGElement) {
        badge.style.display = isVisible ? '' : 'none';
    }
}

/**
 * Owns the camera streams of ONE screen manager's currently-rendered slide.
 *
 * `cleanupSlideContent` is synchronous but opening a device is not, so every
 * attach records the generation it started in. `releaseAll` bumps the
 * generation, and a stream that lands afterwards is released immediately
 * instead of leaving the device light on for ever.
 */
export class SlideCameraAttachment {
    private generation = 0;
    private readonly acquiredDeviceIds: string[] = [];

    attach(videoElement: HTMLVideoElement) {
        // `renderToStaticMarkup` drops React's `muted` prop, and Chromium's
        // autoplay policy rejects `play()` on an unmuted element. This is the
        // same reason the regular slide video path sets it in JS.
        videoElement.muted = true;
        videoElement.playsInline = true;
        void this.open(videoElement, this.generation);
    }

    private async open(videoElement: HTMLVideoElement, generation: number) {
        try {
            const deviceId =
                videoElement.getAttribute(CAMERA_DEVICE_ID_ATTR) ?? '';
            const label =
                videoElement.getAttribute(CAMERA_DEVICE_LABEL_ATTR) ?? '';
            const resolvedId = await resolveCameraDeviceId(deviceId, label);
            if (generation !== this.generation) {
                return;
            }
            if (resolvedId === null) {
                // The camera is not on this machine right now. Say nothing: the
                // placeholder is already the correct "not here" UI, and this
                // runs once per screen per render — a toast would be a storm.
                return;
            }
            const mediaStream = await acquireCameraStream(resolvedId);
            if (generation !== this.generation) {
                // Released while the device was opening.
                releaseCameraStream(resolvedId);
                return;
            }
            this.acquiredDeviceIds.push(resolvedId);
            videoElement.srcObject = mediaStream;
            videoElement.onloadedmetadata = () => {
                void playMediaElement(videoElement);
                setCameraBadgeVisibility(videoElement, false);
            };
        } catch (error) {
            handleError(error);
        }
    }

    releaseAll() {
        this.generation += 1;
        for (const deviceId of this.acquiredDeviceIds) {
            releaseCameraStream(deviceId);
        }
        this.acquiredDeviceIds.length = 0;
    }
}
