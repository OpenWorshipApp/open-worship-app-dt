import { MARCH_OF_GRACE_EXAMPLE } from 'open-lyric';

import type { MimetypeNameType } from '../server/fileHelpers';
import type { AppDocumentMetadataType } from '../helper/AppEditableDocumentSourceAbs';
import AppEditableDocumentSourceAbs from '../helper/AppEditableDocumentSourceAbs';
import type { AnyObjectType } from '../helper/typeHelpers';
import {
    type LyricStageSettingType,
    setLyricStageSettingMemo,
    setLyricStageSettingReader,
    toValidLyricStageSetting,
} from './lyricSongStageSettingHelpers';

type LyricType = {
    metadata: AppDocumentMetadataType;
    content: string;
    // What this ONE song asks of every stage it is drawn on -- today its
    // font (`lyricSongStageSettingHelpers.ts`). Absent on every song that
    // never had one, and dropped again when it is cleared, so an untouched
    // file is byte for byte what it was.
    stageSetting?: LyricStageSettingType;
};

export default class Lyric extends AppEditableDocumentSourceAbs<LyricType> {
    static readonly mimetypeName: MimetypeNameType = 'lyric';

    static validate(json: AnyObjectType): void {
        super.validate(json);
        if (typeof json.content !== 'string') {
            throw new TypeError(
                `Invalid lyric data json:${JSON.stringify(json)}`,
            );
        }
    }

    async getMetadata(): Promise<AppDocumentMetadataType> {
        const jsonData = await this.getJsonData();
        return (
            jsonData?.metadata ?? {
                app: 'open-worship',
                fileVersion: 1,
                initDate: '',
            }
        );
    }

    async getContent() {
        const jsonData = await this.getJsonData();
        return jsonData?.content ?? '';
    }

    async setContent(content: string) {
        const jsonData = await this.getJsonData();
        if (jsonData === null) {
            return;
        }
        jsonData.content = content;
        await this.setJsonData(jsonData);
    }

    async getStageSetting(): Promise<LyricStageSettingType | null> {
        const jsonData = await this.getJsonData();
        return toValidLyricStageSetting(jsonData?.stageSetting);
    }

    /**
     * Through the editing history like every other edit of the song: the
     * stages redraw at once (they read the history head), Ctrl+Z takes it
     * back, and Save writes it. `null` removes the song's own setting.
     */
    async setStageSetting(stageSetting: LyricStageSettingType | null) {
        const jsonData = await this.getJsonData();
        if (jsonData === null) {
            return;
        }
        const validSetting = toValidLyricStageSetting(stageSetting);
        if (validSetting === null) {
            delete jsonData.stageSetting;
        } else {
            jsonData.stageSetting = validSetting;
        }
        await this.setJsonData(jsonData);
        setLyricStageSettingMemo(this.filePath, validSetting);
    }

    static getDefaultContentJsonData(): LyricType {
        return {
            metadata: this.genMetadata(),
            content: MARCH_OF_GRACE_EXAMPLE,
        };
    }

    static async create(dir: string, name: string) {
        return super.create(dir, name, this.getDefaultContentJsonData());
    }

    // Content passed at creation lands clean on disk; create-then-setContent
    // would route through the editing history and leave the file unsaved.
    // The stage setting rides in the same write for the same reason.
    static async createWithContent(
        dir: string,
        name: string,
        content: string,
        stageSetting: LyricStageSettingType | null = null,
    ) {
        const jsonData = this.getDefaultContentJsonData();
        jsonData.content = content;
        const validSetting = toValidLyricStageSetting(stageSetting);
        if (validSetting !== null) {
            jsonData.stageSetting = validSetting;
        }
        return super.create(dir, name, jsonData);
    }

    async save(): Promise<boolean> {
        return await this.historySave((dataText) => {
            return dataText;
        });
    }

    static getInstance(filePath: string) {
        return this._getInstance(filePath, () => {
            return new this(filePath);
        });
    }
}

// The stages read a song's own font through this, so the leaf they import
// never has to import this class (see `lyricSongStageSettingHelpers.ts`).
setLyricStageSettingReader((filePath: string) => {
    return Lyric.getInstance(filePath).getStageSetting();
});
