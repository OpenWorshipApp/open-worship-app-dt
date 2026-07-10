import BibleItem from '../../bible-list/BibleItem';
import type { CanvasItemHtmlPropsType } from './CanvasItemHtml';
import CanvasItemHtml from './CanvasItemHtml';
import { cloneJson } from '../../helper/helpers';
import { CanvasItemError } from './CanvasItem';
import { handleError } from '../../helper/errorHelpers';
import type { BibleTargetType } from '../../bible-list/bibleRenderHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';
import { getBibleFontFamily } from '../../helper/bible-helpers/bibleStyleHelpers';

export type BibleRenderedVerseType = {
    num: string;
    text: string;
};
export type BibleRenderedType = {
    title: string;
    text: string;
    // Absent on items saved before verse numbers were rendered.
    verses?: BibleRenderedVerseType[];
};
export type CanvasItemBiblePropsType = CanvasItemHtmlPropsType & {
    bibleKeys: string[];
    bibleItemTarget: BibleTargetType;
    bibleRenderingList: BibleRenderedType[];
};

// A verse block is much longer than a title, so it starts smaller than a text
// item's default.
const BIBLE_DEFAULT_FONT_SIZE = 45;
// Same greenyellow the bible reader and the screen output use for verse numbers.
const VERSE_NUMBER_COLOR = 'rgba(172, 255, 47, 0.645)';
const TITLE_STYLE = [
    'display:flex',
    'align-items:center',
    'gap:0.35em',
    'font-size:1.1em',
    'opacity:0.85',
    'margin-bottom:0.4em',
].join(';');
const VERSE_NUMBER_STYLE = [
    `color:${VERSE_NUMBER_COLOR}`,
    'font-size:0.6em',
    'padding-right:0.15em',
].join(';');
// Inlined because the canvas renders inside a shadow root, where the app's
// bootstrap icon font is not reachable.
const BOOK_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"' +
    ' width="1em" height="1em" fill="currentColor"' +
    ' style="flex:none"><path d="M1 2.828c.885-.37 2.154-.769 3.388-.893' +
    ' 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493' +
    '-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886' +
    ' 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692' +
    '-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936' +
    ' 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0' +
    ' 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142' +
    ' 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877' +
    ' 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0' +
    ' 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8' +
    ' 1.783z"/></svg>';

function escapeHtml(text: string) {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function genVersesHtml({ text, verses }: BibleRenderedType) {
    if (verses === undefined || verses.length === 0) {
        return escapeHtml(text);
    }
    return verses
        .map(({ num, text }) => {
            return (
                `<sup style="${VERSE_NUMBER_STYLE}">${escapeHtml(num)}</sup>` +
                escapeHtml(text)
            );
        })
        .join(' ');
}

export default class CanvasItemBibleItem extends CanvasItemHtml {
    props: CanvasItemBiblePropsType;
    constructor(props: CanvasItemBiblePropsType) {
        super(props);
        this.props = cloneJson(props);
    }
    toJson(): CanvasItemBiblePropsType {
        return this.props;
    }
    // `bibleRenderingList` stays the source of truth; `html` is what gets shown.
    static genHtml(bibleRenderingList: BibleRenderedType[]) {
        return bibleRenderingList
            .map((bibleRendered) => {
                return (
                    '<div style="width:100%">' +
                    `<div style="${TITLE_STYLE}">${BOOK_ICON_SVG}` +
                    `<span>${escapeHtml(bibleRendered.title)}</span></div>` +
                    `<div style="padding: 0.3em;">${genVersesHtml(bibleRendered)}</div>` +
                    '</div>'
                );
            })
            .join('');
    }
    static fromJson(json: CanvasItemBiblePropsType) {
        try {
            // Always re-derive; a stored `html` is only a cache of the list,
            // so items saved by an older renderer pick up the current markup.
            const newJson = {
                ...json,
                html: CanvasItemBibleItem.genHtml(json.bibleRenderingList),
            };
            this.validate(newJson);
            return new CanvasItemBibleItem(newJson);
        } catch (error) {
            handleError(error);
            return CanvasItemError.fromJsonError(json);
        }
    }
    static async fromBibleItem(id: number, bibleItem: BibleItem) {
        const [title, text, verseTextList, fontFamily] = await Promise.all([
            bibleItem.toTitleWithBibleKey(),
            bibleItem.toText(),
            bibleItem.toVerseTextList(),
            getBibleFontFamily(bibleItem.bibleKey),
        ]);
        const newHtmlItem = super.genDefaultItem();
        const props = newHtmlItem.toJson();
        props.id = id;
        const bibleRenderingList = [
            {
                title,
                text,
                verses: (verseTextList ?? []).map(({ localeVerse, text }) => {
                    return {
                        num: localeVerse,
                        text,
                    };
                }),
            },
        ];
        // `html` is left as the default's; `fromJson` derives the real one
        // from `bibleRenderingList`.
        const json: CanvasItemBiblePropsType = {
            ...props,
            fontSize: BIBLE_DEFAULT_FONT_SIZE,
            fontFamily: fontFamily || null,
            // The title sits above the verses, so anchor the block top-left.
            textHorizontalAlignment: 'left',
            textVerticalAlignment: 'start',
            bibleKeys: [bibleItem.bibleKey],
            bibleItemTarget: bibleItem.toJson().target,
            bibleRenderingList,
            type: 'bible',
        };
        return CanvasItemBibleItem.fromJson(json);
    }
    static validate(json: AnyObjectType) {
        super.validate(json);
        BibleItem.validate({
            id: -1,
            target: json.bibleItemTarget,
            bibleKey: json.bibleKeys[0],
        });
    }
}
