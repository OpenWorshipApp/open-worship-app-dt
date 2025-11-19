import { cloneJson, isValidJson } from '../helper/helpers';
import { ItemBase } from '../helper/ItemBase';
import { setSetting, getSetting } from '../helper/settingHelpers';
import DragInf, { DragTypeEnum } from '../helper/DragInf';
import { handleError } from '../helper/errorHelpers';
import * as loggerHelpers from '../helper/loggerHelpers';
import { BibleTargetType, bibleRenderHelper } from './bibleRenderHelpers';
import { BibleItemType } from './bibleItemHelpers';
import { copyToClipboard } from '../server/appHelpers';
import { ItemSourceInfBasic } from '../others/ItemSourceInf';
import DocumentInf from '../others/DocumentInf';
import { AnyObjectType } from '../helper/typeHelpers';
import { extractBibleTitle } from '../helper/bible-helpers/serverBibleHelpers2';
import {
    fromVerseKey,
    toVerseKey,
} from '../helper/bible-helpers/bibleInfoHelpers';

const BIBLE_PRESENT_SETTING_NAME = 'bible-presenter';

export default class BibleItem
    extends ItemBase
    implements DragInf<BibleItemType>
{
    private originalJson: BibleItemType;
    _id: number;
    filePath?: string;
    bible: (ItemSourceInfBasic<BibleItem> & DocumentInf) | null = null;

    constructor(
        id: number,
        json: BibleItemType,
        filePath?: string,
        bible?: (ItemSourceInfBasic<BibleItem> & DocumentInf) | null,
    ) {
        super();
        this._id = id;
        this.filePath = filePath;
        this.originalJson = cloneJson(json);
        this.bible = bible ?? null;
    }
    get id() {
        return this._id;
    }
    set id(id: number) {
        this._id = id;
        this.originalJson.id = id;
    }
    get bibleKey() {
        return this.originalJson.bibleKey;
    }
    set bibleKey(name: string) {
        this.originalJson.bibleKey = name;
    }
    get target() {
        return this.originalJson.target;
    }
    set target(target: BibleTargetType) {
        this.originalJson.target = target;
    }
    get metadata() {
        return this.originalJson.metadata;
    }
    set metadata(metadata: AnyObjectType) {
        this.originalJson.metadata = metadata;
    }
    get extraBibleKeys() {
        return this.originalJson.extraBibleKeys ?? [];
    }
    set extraBibleKeys(extraBibleKeys: string[]) {
        this.originalJson.extraBibleKeys = extraBibleKeys;
    }
    get isAudioEnabled() {
        return this.originalJson.isAudioEnabled ?? false;
    }
    set isAudioEnabled(isAudioEnabled: boolean) {
        this.originalJson.isAudioEnabled = isAudioEnabled;
    }
    checkIsSameId(bibleItem: BibleItem | number) {
        if (typeof bibleItem === 'number') {
            return this.id === bibleItem;
        }
        return this.id === bibleItem.id;
    }
    checkIsTargetIdentical(bibleItem: BibleItem) {
        const { target } = this;
        const { target: target2 } = bibleItem;
        return (
            target.bookKey === target2.bookKey &&
            target.chapter === target2.chapter &&
            target.verseStart === target2.verseStart &&
            target.verseEnd === target2.verseEnd
        );
    }
    static fromJson(json: BibleItemType, filePath?: string) {
        this.validate(json);
        return new this(json.id, json, filePath);
    }
    static fromJsonError(json: BibleItemType, filePath?: string) {
        const item = new this(
            -1,
            {
                id: -1,
                bibleKey: '',
                target: {
                    bookKey: '',
                    chapter: 0,
                    verseStart: 0,
                    verseEnd: 0,
                },
                metadata: {},
            },
            filePath,
        );
        item.jsonError = json;
        return item;
    }
    static fromData(
        bibleKey: string,
        bookKey: string,
        chapter: number,
        verseStart: number,
        verseEnd: number,
    ) {
        return this.fromJson({
            id: -1,
            bibleKey,
            target: {
                bookKey,
                chapter,
                verseStart,
                verseEnd,
            },
            metadata: {},
        });
    }

    static async fromVerseKey(bibleKey: string, verseKey: string) {
        const target = await fromVerseKey(bibleKey, verseKey);
        if (target === null) {
            return null;
        }
        const bibleItem = this.fromData(
            bibleKey,
            target.bookKey,
            target.chapter,
            target.verseStart,
            target.verseEnd,
        );
        return bibleItem;
    }

    toJson(): BibleItemType {
        if (this.isError) {
            return this.jsonError;
        }
        return {
            id: this.id,
            bibleKey: this.bibleKey,
            extraBibleKeys: this.extraBibleKeys,
            isAudioEnabled: this.isAudioEnabled,
            target: this.originalJson.target,
            metadata: this.originalJson.metadata,
        };
    }
    static validate(json: AnyObjectType) {
        if (
            !json.bibleKey ||
            typeof json.id !== 'number' ||
            (json.metadata && typeof json.metadata !== 'object') ||
            !json.target ||
            typeof json.target !== 'object' ||
            !json.target.bookKey ||
            typeof json.target.chapter !== 'number' ||
            typeof json.target.verseStart !== 'number' ||
            typeof json.target.verseEnd !== 'number'
        ) {
            loggerHelpers.error(json);
            throw new Error('Invalid bible item data');
        }
    }
    clone(isKeepId = false) {
        const Class = this.constructor as typeof BibleItem;
        if (!isKeepId) {
            return Class.fromJson({ ...this.toJson(), id: -1 }, this.filePath);
        }
        return Class.fromJson(this.toJson(), this.filePath);
    }
    async save(bible = this.bible): Promise<boolean> {
        if (bible === null) {
            return false;
        }
        const bibleItem = bible.getItemById(this.id) as BibleItem | null;
        if (bibleItem !== null) {
            bibleItem.update(this);
            bible.setItemById(this.id, bibleItem);
            return bible.save();
        }
        return false;
    }
    update(bibleItem: BibleItem) {
        this.bibleKey = bibleItem.bibleKey;
        this.target = bibleItem.target;
        this.metadata = bibleItem.metadata;
    }
    static convertPresent(
        bibleItem: BibleItem,
        presenterBibleItems: BibleItem[],
    ) {
        let bibleItemList;
        if (presenterBibleItems.length < 2) {
            bibleItemList = [bibleItem.clone()];
        } else {
            bibleItemList = presenterBibleItems.map((presenterBibleItem) => {
                const newItem = bibleItem.clone();
                newItem.bibleKey = presenterBibleItem.bibleKey;
                return newItem;
            });
        }
        return bibleItemList.filter((item) => item !== null);
    }
    static setBiblePresenterSetting(bibleItems: BibleItem[]) {
        const jsonData = bibleItems.map((bibleItem) => {
            return bibleItem.toJson();
        });
        setSetting(BIBLE_PRESENT_SETTING_NAME, JSON.stringify(jsonData));
    }
    static getBiblePresenterSetting() {
        try {
            const str = getSetting(BIBLE_PRESENT_SETTING_NAME) ?? '';
            if (isValidJson(str, true)) {
                return JSON.parse(str).map((item: any) => {
                    return this.fromJson(item);
                }) as BibleItem[];
            }
        } catch (error) {
            handleError(error);
        }
        return [];
    }
    // TODO: change exported title to `1 John 1:1-2 (kjv)`
    async toTitleText() {
        const title = await this.toTitle();
        const text = await this.toText();
        return { title, text };
    }
    toTitle() {
        return bibleRenderHelper.toTitle(this.bibleKey, this.target);
    }
    toText() {
        return bibleRenderHelper.toText(this.bibleKey, this.target, true);
    }
    toVerseTextList() {
        return bibleRenderHelper.toVerseTextList(this.bibleKey, this.target);
    }
    getCopyingBibleKey() {
        return `(${this.bibleKey})`;
    }
    async copyTitleToClipboard() {
        const title = await this.toTitle();
        copyToClipboard(`${this.getCopyingBibleKey()} ${title}`);
    }
    async copyTextToClipboard() {
        const text = await this.toText();
        copyToClipboard(text);
    }
    async copyToClipboard() {
        const { title, text } = await this.toTitleText();
        copyToClipboard(`${this.getCopyingBibleKey()} ${title}\n${text}`);
    }
    async getJumpingChapter(isNext: boolean) {
        const nextChapter = await bibleRenderHelper.getJumpingChapter(
            this.bibleKey,
            this.target,
            isNext,
        );
        return nextChapter;
    }
    syncData(bibleItem: BibleItem) {
        this.originalJson = bibleItem.originalJson;
    }
    dragSerialize() {
        const data = this.toJson() as any;
        data.filePath = this.filePath;
        return {
            type: DragTypeEnum.BIBLE_ITEM,
            data,
        };
    }
    static dragDeserialize(data: any) {
        try {
            const bibleItem = this.fromJson(data);
            if (data.filePath) {
                bibleItem.filePath = data.filePath;
            }
            return bibleItem;
        } catch (error) {
            handleError(error);
        }
        return null;
    }
    static genBibleLookupData(bibleItem: BibleItem) {
        if (bibleItem.filePath) {
            const json = bibleItem.toJson() as any;
            json.filePath = bibleItem.filePath;
            return JSON.stringify(json);
        }
    }
    static parseBibleLookupData(data?: string) {
        if (!data) {
            return null;
        }
        const json = JSON.parse(data);
        return this.fromJson(json, json.filePath);
    }
    static saveFromBibleLookup(
        bible: ItemSourceInfBasic<BibleItem> & DocumentInf,
        oldBibleItem: BibleItem,
        newBibleItem: BibleItem,
    ) {
        oldBibleItem.bibleKey = newBibleItem.bibleKey;
        oldBibleItem.target = newBibleItem.target;
        return oldBibleItem.save(bible);
    }

    static async bibleTitleToKJVVerseKey(bibleKey: string, title: string) {
        const extractedData = await extractBibleTitle(bibleKey, title);
        const { bibleItem } = extractedData.result;
        if (bibleItem === null) {
            return null;
        }
        const { target } = bibleItem;
        const { bookKey, chapter, verseStart, verseEnd } = target;
        return toVerseKey(bookKey, chapter, verseStart, verseEnd);
    }
}
