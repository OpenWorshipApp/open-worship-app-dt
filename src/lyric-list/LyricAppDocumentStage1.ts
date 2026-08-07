import { type OpenLyricElementMapOptions } from 'open-lyric';
import LyricAppDocumentStageAbstract from './LyricAppDocumentStageAbstract';
import { type SrcData } from '../helper/FileSource';

export default class LyricAppDocumentStage1 extends LyricAppDocumentStageAbstract {
    stage = 1;

    get stageOpenLyricOptions() {
        return {
            isWithKeyNote: true,
            isShowingCommentText: true,
            css: `
                .ol-song-view__info-card .ol-song-view__title {
                    font-size: 1.6em !important; 
                }
            `,
        } as OpenLyricElementMapOptions;
    }

    async getFirstCanvasItemProps() {
        const wholeImage = await this.getValue({
            ...(this.basicOpenLyricOptions as any),
            type: 'png-image',
        });
        const canvasItemProps = this.genCanvasItemImageProps(
            0,
            wholeImage as SrcData,
        );
        return canvasItemProps;
    }

    static getInstance(filePath: string) {
        return this._getInstance(filePath, () => {
            return new this(filePath);
        });
    }

    cleanDataMap() {}
}
