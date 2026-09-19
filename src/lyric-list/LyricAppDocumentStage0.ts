import { type OpenLyricElementMapOptions } from 'open-lyric';
import LyricAppDocumentStageAbstract from './LyricAppDocumentStageAbstract';
import { type AnyObjectType } from '../helper/typeHelpers';

export default class LyricAppDocumentStage0 extends LyricAppDocumentStageAbstract {
    get stageOpenLyricOptions() {
        return {
            isShowingIndex: false,
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
                .ol-preview-line__content--progression {
                    display: none;
                }

            `,
        } as Partial<OpenLyricElementMapOptions>;
    }

    static getInstance(filePath: string) {
        return this._getInstance(filePath, () => {
            return new this(filePath);
        });
    }

    async getFirstCanvasItemProps() {
        return null;
    }

    cleanDataMap(dataMap: AnyObjectType) {
        const keys = Object.keys(dataMap);
        for (const key of keys) {
            if (key.toLocaleLowerCase().startsWith('note')) {
                delete dataMap[key];
            }
        }
    }
}
