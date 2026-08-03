import { type OpenLyricElementMapOptions } from 'open-lyric';
import LyricAppDocumentStageAbstract from './LyricAppDocumentStageAbstract';

export default class LyricAppDocumentStage0 extends LyricAppDocumentStageAbstract {
    get stageOpenLyricOptions() {
        return {
            css: `
                .ol-song-view__section-body {
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .ol-preview-lines {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    vertical-align: middle;
                }

                .ol-preview-lyric-segment__chord {
                    display: none;
                }

                .ol-song-view__section-title {
                    display: none;
                }

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
