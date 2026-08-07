import { getAppFilePathFromFile } from '../../helper/localFileHelpers';
import type { CanvasItemFilePathPropsType } from './canvasHelpers';
import {
    AUDIO_EMBED_HEIGHT,
    AUDIO_EMBED_WIDTH,
    genMediaDefaultBoxStyle,
    validateFilePathProps,
} from './canvasHelpers';
import type { UrlMediaSourceType } from '../../helper/mediaSourceHelpers';
import { checkIsRemoteMediaSource } from '../../helper/mediaSourceHelpers';
import type { CanvasItemBoxPropsType, CanvasItemPropsType } from './CanvasItem';
import CanvasItem, { CanvasItemError } from './CanvasItem';
import { handleError } from '../../helper/errorHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';

export type CanvasItemAudioPropsType = { type: 'audio' } & CanvasItemPropsType &
    CanvasItemFilePathPropsType;
class CanvasItemAudio extends CanvasItem<CanvasItemAudioPropsType> {
    static gegStyle(_props: CanvasItemAudioPropsType) {
        return {};
    }
    getStyle() {
        return CanvasItemAudio.gegStyle(this.props);
    }
    static genCanvasItem(filePath: string, x: number, y: number) {
        const props: CanvasItemAudioPropsType = {
            filePath,
            ...genMediaDefaultBoxStyle(AUDIO_EMBED_WIDTH, AUDIO_EMBED_HEIGHT),
            left: x - AUDIO_EMBED_WIDTH / 2,
            top: y - AUDIO_EMBED_HEIGHT / 2,
            width: AUDIO_EMBED_WIDTH,
            height: AUDIO_EMBED_HEIGHT,
            type: 'audio',
        };
        return this.fromJson(props);
    }
    // Unlike a video, nothing about the file has to be read to place the item:
    // an audio player has no intrinsic dimensions, so insertion never opens
    // (or downloads) the media.
    static genFromInsertion(x: number, y: number, filePath: string) {
        return this.genCanvasItem(filePath, x, y);
    }
    // A remote link is kept as the source verbatim. Audio has no dimensions to
    // measure, so nothing is fetched at all until the operator presses play.
    static genCanvasItemFromLink(x: number, y: number, url: string) {
        if (!checkIsRemoteMediaSource(url)) {
            throw new Error(`Invalid audio link: ${url}`);
        }
        return this.genCanvasItem(url, x, y);
    }
    // The props for an audio item that fills a box chosen by the caller. No
    // measuring is possible or needed — audio has no intrinsic size — so this
    // is `genCanvasItemFromLink` without the placement, for a caller that
    // already knows the box.
    static genCanvasItemPropsFromLink(
        url: UrlMediaSourceType,
        boxProps: CanvasItemBoxPropsType,
    ): CanvasItemAudioPropsType {
        return {
            ...boxProps,
            type: 'audio',
            filePath: url,
        };
    }
    static genFromFile(x: number, y: number, file: File | Blob) {
        // Audio is referenced by its on-disk path rather than inlined, so a
        // blob without a resolvable file path (e.g. clipboard paste) cannot
        // become an audio item.
        const filePath = getAppFilePathFromFile(file);
        if (filePath === null) {
            throw new Error(
                'Error occurred during resolving audio file path from blob',
            );
        }
        return this.genFromInsertion(x, y, filePath);
    }
    toJson(): CanvasItemAudioPropsType {
        return {
            filePath: this.props.filePath,
            ...super.toJson(),
            type: 'audio',
        };
    }
    static fromJson(json: CanvasItemAudioPropsType) {
        try {
            this.validate(json);
            return new CanvasItemAudio(json);
        } catch (error) {
            handleError(error);
            return CanvasItemError.fromJsonError(json);
        }
    }
    static validate(json: AnyObjectType) {
        super.validate(json);
        validateFilePathProps(json);
    }
}

export default CanvasItemAudio;
