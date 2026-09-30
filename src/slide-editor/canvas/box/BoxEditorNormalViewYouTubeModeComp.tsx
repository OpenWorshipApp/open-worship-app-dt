import { use, useState } from 'react';

import type { CanvasItemYouTubePropsType } from '../CanvasItemYouTube';
import CanvasItemYouTube from '../CanvasItemYouTube';
import { BoxEditorNormalViewErrorRenderComp } from './BoxEditorNormalViewErrorComp';
import { handleError } from '../../../helper/errorHelpers';
import { useCanvasItemPropsContext } from '../CanvasItem';
import { SlideThumbnailContext } from './slideThumbnailContext';
import { extractYouTubeVideoId } from '../youtubeUrlHelpers';

/**
 * A YouTube item in a thumbnail: YouTube's own still for the video, or -- when
 * that cannot load (offline, a removed video) -- a play mark and the address.
 * Never a player: see `SlideThumbnailContext`.
 */
function BoxEditorNormalYouTubeThumbnailComp({
    url,
}: Readonly<{
    url: string;
}>) {
    const [isImageFailed, setIsImageFailed] = useState(false);
    const videoId = extractYouTubeVideoId(url);
    const isImageShown = videoId !== '' && !isImageFailed;
    return (
        <div
            title={url}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                backgroundColor: '#000000',
                pointerEvents: 'none',
            }}
        >
            {isImageShown ? (
                <img
                    src={`https://i.ytimg.com/vi/${encodeURIComponent(
                        videoId,
                    )}/hqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    onError={() => {
                        setIsImageFailed(true);
                    }}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                    }}
                />
            ) : null}
            {/* Inline SVG, not the icon font: the font is not loaded
                everywhere a slide is drawn. */}
            <svg
                viewBox="0 0 68 48"
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: '20%',
                    maxWidth: 136,
                    transform: 'translate(-50%, -50%)',
                }}
            >
                <path
                    d={
                        'M66.5 7.7a8.5 8.5 0 0 0-6-6C55.2 0 34 0 34 0S12.8 0' +
                        ' 7.5 1.7a8.5 8.5 0 0 0-6 6C0 13 0 24 0 24s0 11' +
                        ' 1.5 16.3a8.5 8.5 0 0 0 6 6C12.8 48 34 48 34 48s21.2' +
                        ' 0 26.5-1.7a8.5 8.5 0 0 0 6-6C68 35 68 24 68 24s0-11' +
                        '-1.5-16.3z'
                    }
                    fill="#ff0000"
                />
                <path d="M27 34l18-10-18-10z" fill="#ffffff" />
            </svg>
            {isImageShown ? null : (
                <div
                    className="app-ellipsis"
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        padding: '2%',
                        color: '#ffffff',
                        fontSize: '4vmin',
                        textAlign: 'center',
                    }}
                >
                    {url}
                </div>
            )}
        </div>
    );
}

export function BoxEditorNormalYouTubeRender() {
    const props = useCanvasItemPropsContext<CanvasItemYouTubePropsType>();
    const isThumbnail = use(SlideThumbnailContext);
    try {
        CanvasItemYouTube.validate(props);
    } catch (error) {
        handleError(error);
        return <BoxEditorNormalViewErrorRenderComp />;
    }
    if (isThumbnail) {
        return <BoxEditorNormalYouTubeThumbnailComp url={props.url} />;
    }
    const embedUrl = CanvasItemYouTube.toEmbedUrl(props.url);
    return (
        <div
            title={props.id.toString()}
            style={{
                width: '100%',
                height: '100%',
                // Keep the box draggable in the editor: clicks must reach the
                // box editor, not the iframe (same as the video render). The
                // presenter re-enables pointer events on its mini screen.
                pointerEvents: 'none',
            }}
        >
            <iframe
                src={embedUrl}
                title={`youtube-${props.id}`}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow={
                    'accelerometer; autoplay; clipboard-write; ' +
                    'encrypted-media; gyroscope; picture-in-picture; web-share'
                }
                allowFullScreen
                style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    display: 'block',
                    backgroundColor: 'transparent',
                }}
            />
        </div>
    );
}
