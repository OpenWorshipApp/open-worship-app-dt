import { PREVIEW_ONLY_ATTR } from '../../../helper/constants';

// Inline svg rather than `<i className="bi bi-globe">`: the icon font is not
// loaded in the print document, and this markup also has to survive
// `renderToStaticMarkup` into the screen window. Same reason the camera item's
// badge and the video item's play badge are inline svg — and the reason
// `BackgroundWebPlaceHolderComp`, which uses the icon font, cannot be reused
// here. Path copied from bootstrap-icons' `globe.svg`.
function genWebsiteIcon(width: number) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={width}
            filter="drop-shadow(3px 5px 2px rgb(0 0 0 / 0.4))"
            viewBox="0 0 16 16"
            fill="white"
            stroke="black"
            strokeWidth={0.5}
            paintOrder="stroke"
        >
            <path
                d={
                    'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m7.5-6.923c-.67.204-1.335' +
                    '.82-1.887 1.855A8 8 0 0 0 5.145 4H7.5zM4.09 4a9.3 9.3 0 0 ' +
                    '1 .64-1.539 7 7 0 0 1 .597-.933A7.03 7.03 0 0 0 2.255 ' +
                    '4zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a7 7 0 0 ' +
                    '0-.656 2.5zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5zM8.5 ' +
                    '5v2.5h2.99a12.5 12.5 0 0 0-.337-2.5zM4.51 8.5a12.5 12.5 0 ' +
                    '0 0 .337 2.5H7.5V8.5zm3.99 0V11h2.653c.187-.765.306-1.608' +
                    '.338-2.5zM5.145 12q.208.58.468 1.068c.552 1.035 1.218 ' +
                    '1.65 1.887 1.855V12zm.182 2.472a7 7 0 0 1-.597-.933A9.3 ' +
                    '9.3 0 0 1 4.09 12H2.255a7 7 0 0 0 3.072 2.472M3.82 ' +
                    '11a13.7 13.7 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 ' +
                    '2.5zm6.853 3.472A7 7 0 0 0 13.745 12H11.91a9.3 9.3 0 0 ' +
                    '1-.64 1.539 7 7 0 0 1-.597.933M8.5 12v2.923c.67-.204 ' +
                    '1.335-.82 1.887-1.855q.26-.487.468-1.068zm3.68-1h2.146c' +
                    '.365-.767.594-1.61.656-2.5h-2.49a13.7 13.7 0 0 1-.312 ' +
                    '2.5m2.802-3.5a7 7 0 0 0-.656-2.5H12.18c.174.782.282 ' +
                    '1.623.312 2.5zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7 ' +
                    '7 0 0 0-3.072-2.472c.218.284.418.598.597.933M10.855 4a8 8 ' +
                    '0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4z'
                }
            />
        </svg>
    );
}

/**
 * The static face of a website canvas item: its screenshot, or a globe and the
 * url while there isn't one (not captured yet, capture failed, or the surface
 * never runs effects at all — the screen and print both render this component
 * through `renderToStaticMarkup`).
 *
 * `ScreenVaryAppDocumentManager.cleanupSlideContent` hides this whole element
 * by its `PREVIEW_ONLY_ATTR` before inserting the live iframe, so a page with a
 * transparent body does not show a stale screenshot through.
 */
export default function BoxEditorNormalWebsitePlaceHolderComp({
    url,
    imageData,
    boxWidth,
    boxHeight,
}: Readonly<{
    url: string;
    imageData?: string | null;
    boxWidth: number;
    boxHeight: number;
}>) {
    const iconSize = Math.min(boxWidth, boxHeight) / 4;
    return (
        <div
            {...{ [PREVIEW_ONLY_ATTR]: '' }}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: `${iconSize / 8}px`,
                overflow: 'hidden',
                // The frame above must stay the ONLY hit target in the box, or
                // moving the pointer onto this element fires a bubbling
                // `mouseout` and the hover state flaps. This also suppresses
                // Chromium's native image drag, which would hijack the box
                // drag.
                pointerEvents: 'none',
            }}
        >
            {imageData ? (
                <img
                    alt=""
                    src={imageData}
                    style={{
                        width: '100%',
                        height: '100%',
                        // Fill the box exactly rather than letterboxing: the
                        // capture is taken at the box's own aspect ratio, so
                        // nothing is distorted.
                        objectFit: 'fill',
                        display: 'block',
                    }}
                />
            ) : (
                <>
                    {genWebsiteIcon(iconSize)}
                    <span
                        style={{
                            color: 'white',
                            fontSize: `${iconSize / 4}px`,
                            textShadow: '0 0 3px black',
                            textAlign: 'center',
                            wordBreak: 'break-all',
                            maxWidth: '92%',
                            maxHeight: '40%',
                            overflow: 'hidden',
                        }}
                    >
                        {url}
                    </span>
                </>
            )}
        </div>
    );
}
