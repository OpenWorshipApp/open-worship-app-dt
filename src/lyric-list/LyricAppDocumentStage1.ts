import { type OpenLyricElementMapOptions } from 'open-lyric';
import LyricAppDocumentStageAbstract from './LyricAppDocumentStageAbstract';

export default class LyricAppDocumentStage1 extends LyricAppDocumentStageAbstract {
    stage = 1;

    get stageOpenLyricOptions() {
        return {
            isWithKeyNote: true,
            css: `
                .ol-song-view__info-card .ol-song-view__title {
                    font-size: 1.6em !important; 
                }
            `,
        } as OpenLyricElementMapOptions;
    }

    static getInstance(filePath: string) {
        return this._getInstance(filePath, () => {
            return new this(filePath);
        });
    }
}
