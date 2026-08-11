import { type OpenLyricElementMapOptions } from 'open-lyric';
import LyricAppDocumentStageAbstract from './LyricAppDocumentStageAbstract';
import { type SrcData } from '../helper/FileSource';

export default class LyricAppDocumentStage1 extends LyricAppDocumentStageAbstract {
    stage = 1;

    get stageOpenLyricOptions() {
        return {
            isWithKeyNote: true,
            isShowingCommentText: true,
        } as OpenLyricElementMapOptions;
    }

    async getFirstCanvasItemProps() {
        // The custom CSS reaches this slide too. It is the FIRST slide of the
        // same pane, so a colour or font tweak that skipped it would read as a
        // bug; unmatched selectors are inert, so the only real effect is that a
        // deliberately broad rule also reaches the title card — which is what a
        // stage-wide CSS box means.
        const wholeImage = await this.getValue(
            this.withCustomCss({
                ...(this.basicOpenLyricOptions as any),
                type: 'png-image',
                css: `
                .ol-song-view {
                    padding: 0.2em !important;
                }
                .ol-song-view__title {
                    font-size: 1.1em !important;
                }
            `,
            }),
        );
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
