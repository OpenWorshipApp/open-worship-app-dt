import { MARCH_OF_GRACE_EXAMPLE } from 'open-lyric';

import type { MimetypeNameType } from '../server/fileHelpers';
import type { AppDocumentMetadataType } from '../helper/AppEditableDocumentSourceAbs';
import AppEditableDocumentSourceAbs from '../helper/AppEditableDocumentSourceAbs';
import type { AnyObjectType } from '../helper/typeHelpers';

type LyricType = {
    metadata: AppDocumentMetadataType;
    content: string;
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

    static getDefaultContentJsonData(): LyricType {
        return {
            metadata: this.genMetadata(),
            content: MARCH_OF_GRACE_EXAMPLE,
        };
    }

    static async create(dir: string, name: string) {
        return super.create(dir, name, this.getDefaultContentJsonData());
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
