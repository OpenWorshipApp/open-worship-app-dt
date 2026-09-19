import type { CanvasItemUrlPropsType } from './canvasHelpers';
import {
    genMediaDefaultBoxStyle,
    validateUrlProps,
    YOUTUBE_EMBED_HEIGHT,
    YOUTUBE_EMBED_WIDTH,
} from './canvasHelpers';
import type { CanvasItemBoxPropsType, CanvasItemPropsType } from './CanvasItem';
import CanvasItem, { CanvasItemError } from './CanvasItem';
import { handleError } from '../../helper/errorHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';
import { extractYouTubeVideoId } from './youtubeUrlHelpers';

export type CanvasItemYouTubePropsType = {
    type: 'youtube';
} & CanvasItemPropsType &
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
        const videoId = extractYouTubeVideoId(url);
        if (videoId === '') {
            return url;
        }
        // `enablejsapi=1` lets the presenter/screen drive playback and read the
        // current time over postMessage so a YouTube embed group-syncs the same
        // way a slide video does.
        return `https://www.youtube.com/embed/${videoId}?rel=0&enablejsapi=1`;
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
    // The props for a YouTube item that fills a box chosen by the caller —
    // `genCanvasItem` without the placement, for a caller that already knows
    // the box. The watch URL is kept verbatim; `embedUrl` converts at render.
    static genCanvasItemPropsFromLink(
        url: string,
        boxProps: CanvasItemBoxPropsType,
    ): CanvasItemYouTubePropsType {
        return {
            ...boxProps,
            type: 'youtube',
            url,
        };
    }
    toJson(): CanvasItemYouTubePropsType {
        return {
            url: this.props.url,
            ...super.toJson(),
            type: 'youtube',
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
