import type { CanvasItemUrlPropsType } from './canvasHelpers';
import {
    genMediaDefaultBoxStyle,
    validateUrlProps,
    YOUTUBE_EMBED_HEIGHT,
    YOUTUBE_EMBED_WIDTH,
} from './canvasHelpers';
import type { CanvasItemPropsType } from './CanvasItem';
import CanvasItem, { CanvasItemError } from './CanvasItem';
import { handleError } from '../../helper/errorHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';

export type CanvasItemYouTubePropsType = CanvasItemPropsType &
    CanvasItemUrlPropsType;

class CanvasItemYouTube extends CanvasItem<CanvasItemYouTubePropsType> {
    static gegStyle(_props: CanvasItemYouTubePropsType) {
        return {};
    }
    getStyle() {
        return CanvasItemYouTube.gegStyle(this.props);
    }
    // A YouTube video is 16:9; keep that ratio when the box is resized, the
    // same way a video item locks to its media's ratio.
    get shouldLockAspectRatio() {
        return true;
    }
    // Convert any of the common YouTube URL forms (watch, youtu.be, shorts,
    // live, embed) into an embeddable `/embed/<id>` URL. An unrecognized URL is
    // returned unchanged on the assumption it is already embeddable.
    static toEmbedUrl(url: string): string {
        try {
            const parsed = new URL(url);
            const host = parsed.hostname.replace(/^www\./, '');
            let videoId = '';
            if (host === 'youtu.be') {
                videoId = parsed.pathname.slice(1);
            } else if (
                host === 'youtube.com' ||
                host.endsWith('.youtube.com')
            ) {
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
                // `enablejsapi=1` lets the presenter/screen drive playback and
                // read the current time over postMessage so a YouTube embed
                // group-syncs the same way a slide video does.
                return (
                    `https://www.youtube.com/embed/${videoId}` +
                    '?rel=0&enablejsapi=1'
                );
            }
        } catch (error) {
            handleError(error);
        }
        return url;
    }
    get embedUrl() {
        return CanvasItemYouTube.toEmbedUrl(this.props.url);
    }
    static genCanvasItem(url: string, x: number, y: number) {
        const props: CanvasItemYouTubePropsType = {
            url,
            ...genMediaDefaultBoxStyle(
                YOUTUBE_EMBED_WIDTH,
                YOUTUBE_EMBED_HEIGHT,
            ),
            left: x - YOUTUBE_EMBED_WIDTH / 2,
            top: y - YOUTUBE_EMBED_HEIGHT / 2,
            width: YOUTUBE_EMBED_WIDTH,
            height: YOUTUBE_EMBED_HEIGHT,
            type: 'youtube',
        };
        return this.fromJson(props);
    }
    static genFromUrl(x: number, y: number, url: string) {
        return this.genCanvasItem(url, x, y);
    }
    toJson(): CanvasItemYouTubePropsType {
        return {
            url: this.props.url,
            ...super.toJson(),
        };
    }
    static fromJson(json: CanvasItemYouTubePropsType) {
        try {
            this.validate(json);
            return new CanvasItemYouTube(json);
        } catch (error) {
            handleError(error);
            return CanvasItemError.fromJsonError(json);
        }
    }
    static validate(json: AnyObjectType) {
        super.validate(json);
        validateUrlProps(json);
    }
}

export default CanvasItemYouTube;
