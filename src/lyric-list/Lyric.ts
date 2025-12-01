import { MimetypeNameType } from '../server/fileHelpers';
import AppEditableDocumentSourceAbs, {
    AppDocumentMetadataType,
} from '../helper/AppEditableDocumentSourceAbs';
import { AnyObjectType } from '../helper/typeHelpers';

const DEFAULT_CONTENT = `
---
# Test1
---
c1:                    Am     G  F          G      Esus4  E
l1: All the leaves are brown        and the sky is gray

c1: F               C     E  Am       F        Esus4  E
l1: I've been for a walk         on a winter's day
`;

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

    static async create(dir: string, name: string) {
        return super.create(dir, name, { content: DEFAULT_CONTENT });
    }

    async save(): Promise<boolean> {
        return await this.editingHistoryManager.save((dataText) => {
            return dataText;
        });
    }

    static getInstance(filePath: string) {
        return this._getInstance(filePath, () => {
            return new this(filePath);
        });
    }
}
