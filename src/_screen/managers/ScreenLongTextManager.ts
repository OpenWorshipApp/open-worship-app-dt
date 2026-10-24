import type { CSSProperties } from 'react';

import type BibleItem from '../../bible-list/BibleItem';
import type { DroppedDataType } from '../../helper/DragInf';
import { DragTypeEnum } from '../../helper/DragInf';
import { showSimpleToast } from '../../toast/toastHelpers';
import {
    bringDomToCenterView,
    bringDomToNearestView,
    bringDomToTopView,
    checkIsVerticalPartialInvisible,
    cloneJson,
} from '../../helper/helpers';
import {
    getSetting,
    removeSetting,
    setSetting,
} from '../../helper/settingHelpers';
import bibleScreenHelper from '../bibleScreenHelpers';
import type { ScreenLongTextManagerEventType } from '../screenBibleHelpers';
import {
    SCREEN_BIBLE_SETTING_PREFIX,
    renderScreenLongTextManager,
    bibleItemJsonToScreenViewData,
    onSelectKey,
} from '../screenBibleHelpers';
import {
    genScreenMouseEvent,
    getBibleListOnScreenSetting,
} from '../screenHelpers';
import * as loggerHelpers from '../../helper/loggerHelpers';
import { screenManagerSettingNames } from '../../helper/constants';
import ScreenEventHandler from './ScreenEventHandler';
import type ScreenManagerBase from './ScreenManagerBase';
import { getAllScreenManagerBases } from './screenManagerBaseHelpers';
import appProvider from '../../server/appProvider';
import { applyAttachBackground } from './screenBackgroundHelpers';
import type { BibleItemType } from '../../bible-list/bibleItemHelpers';
import {
    collectLiveOnScreenMap,
    persistOnScreenEntry,
} from './onScreenSettingPersistHelpers';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';
import Bible from '../../bible-list/Bible';
import type { AnyObjectType } from '../../helper/typeHelpers';
import SettingManager from '../../helper/SettingManager';
import type {
    BasicScreenMessageType,
    LongTextDataType,
    LongTextItemDataType,
    ScreenMessageType,
} from '../screenTypeHelpers';
import type { LongTextColumnStyleType } from '../screenLongTextTypeHelpers';
import {
    checkIsLongTextData,
    getBibleItemData,
    toLongTextSectionKey,
    withLongTextColumnStyles,
} from '../screenLongTextTypeHelpers';
import { registerScrollingSyncEvent } from './screenEventHelpers';
import {
    HEX_COLOR_BLACK,
    checkIsColorDark,
    HEX_COLOR_WHITE,
} from '../../others/color/colorHelpers';
import { showBibleTextColorChangedToast } from './bibleTextColorToastHelpers';
import { tran } from '../../lang/langHelpers';
import {
    BIBLE_SHOWN_CHAPTER_COUNT,
    getTargetChapterCount,
} from '../../helper/bible-helpers/bibleTargetHelpers';
import {
    SCREEN_BIBLE_SCROLL_CLASSNAME,
    getScreenBibleScrollTop,
    getScreenBibleScroller,
    markScreenBibleProgrammaticScroll,
    steerScreenBibleAutoScroll,
    toScreenBibleScrollSelector,
} from '../screenBibleColumnHelpers';
import {
    MAX_BIBLE_TEXT_FONT_SIZE,
    genBibleTextStyleCss,
    readBibleTextColor,
    readBibleTextFontSize,
    readBibleTextShadow,
} from '../bibleTextStyleHelpers';

const textStyleSettingManager = new SettingManager<AnyObjectType>({
    settingName: `${SCREEN_BIBLE_SETTING_PREFIX}-style-text`,
    defaultValue: {},
    isErrorToDefault: true,
    validate: (jsonString) => {
        try {
            return JSON.parse(jsonString) instanceof Object;
        } catch (_error) {
            return false;
        }
    },
    serialize: (style) => JSON.stringify(style),
    deserialize: (jsonString) => JSON.parse(jsonString),
});

// Weak: a div is dropped with the card that rendered it (`releaseDiv`).
const wiredDivMap = new WeakMap<
    HTMLDivElement,
    { manager: ScreenLongTextManager; abortController: AbortController }
>();

/**
 * A screen's long-text layer: columns of numbered sections under a title,
 * scrolled together. A Bible passage is one thing it holds (a column per
 * version, a section per verse); a long text in several languages -- a song to
 * sing along to -- is the other (`handleLongTextShowing`). One layer, so one
 * of them at a time, and either one takes the slide down.
 */
class ScreenLongTextManager extends ScreenEventHandler<ScreenLongTextManagerEventType> {
    static readonly eventNamePrefix: string = 'screen-ft-m';
    private _screenViewData: LongTextDataType | null = null;
    private _div: HTMLDivElement | null = null;
    public isToTop = false;
    // The next selection is brought to the vertical MIDDLE of the screen,
    // wherever it is now (`bringSectionToMiddle`).
    public isToMiddle = false;
    applyBibleViewData = (_bibleData: LongTextDataType | null) => {};
    handleBibleViewVersesHighlighting = (
        _kjvVerseKey: string,
        _isToTop: boolean,
    ) => {};

    // Per screen, not module-level: a shared timer would collapse every
    // screen's metadata write into one and leave the others unpersisted.
    private readonly saveMetadataAttempt = genTimeoutAttempt(500);

    // What the owner rebuilds the on-screen map from when it cannot be read
    // (`persistOnScreenEntry`).
    private readonly collectLiveBibleList = () => {
        return collectLiveOnScreenMap(
            ScreenLongTextManager.getAllInstancesBase<ScreenLongTextManager>(),
            (instance) => {
                return instance.screenViewData;
            },
        );
    };

    constructor(screenManagerBase: ScreenManagerBase) {
        super(screenManagerBase);
        if (appProvider.isPagePresenter) {
            const allBibleDataList = getBibleListOnScreenSetting();
            this._screenViewData = allBibleDataList[this.key] ?? null;
        }
    }

    get isShowing() {
        return this.screenViewData !== null;
    }

    // A long text, not a Bible passage -- which is what its Foreground panel,
    // Clear Foreground and the Foreground tab's mark each need to know.
    get isShowingLongText() {
        return checkIsLongTextData(this._screenViewData);
    }

    applyHeaderEffectOnScroll(div: HTMLDivElement) {
        // multiple bibles view wil have multiple header,
        // so apply effect on all headers
        const thElements = div.querySelectorAll<HTMLElement>('th.header');
        // One measure for all of them: columns that scroll by themselves are
        // at different offsets, and their headers must not be different sizes.
        const percentage = Math.min(getScreenBibleScrollTop(div), 118) / 118;
        for (const thElement of thElements) {
            const fontSize = `${1 - 0.5 * percentage}em`;
            if (thElement.style.fontSize !== fontSize) {
                thElement.style.fontSize = fontSize;
            }

            const firstChild = thElement.children[0];
            if (firstChild instanceof HTMLElement) {
                const hexAlpha = Math.round(83 + 100 * percentage).toString(16);
                const backgroundColor = `#999999${hexAlpha}`;
                if (firstChild.style.backgroundColor !== backgroundColor) {
                    firstChild.style.backgroundColor = backgroundColor;
                }
            }
        }
    }

    private get lineSyncKey() {
        return `${SCREEN_BIBLE_SETTING_PREFIX}-line-sync-${this.screenId}`;
    }

    get isLineSync() {
        return getSetting(this.lineSyncKey) === 'true';
    }

    set isLineSync(isLineSync: boolean) {
        if (this.screenManagerBase.checkIsLockedWithMessage()) {
            return;
        }
        setSetting(this.lineSyncKey, `${isLineSync}`);
        this.screenViewData = cloneJson(this.screenViewData);
    }

    get div() {
        return this._div;
    }

    set div(div: HTMLDivElement | null) {
        this._div = div;
        if (div !== null) {
            this.wireDiv(div);
            this.applyHeaderEffectOnScroll(div);
        }

        this.render();
    }

    // Once per div and manager. `ScreenBibleComp` hands the same div over
    // again whenever its effect re-runs -- `div.current` is in its deps, and
    // StrictMode runs it twice more -- and each pass used to add another set
    // of listeners: Ctrl+wheel stepped the font size once per copy, and two
    // scroll-sync listeners on one div is what let a remote scroll bounce
    // between grouped mini screens for ever.
    private wireDiv(div: HTMLDivElement) {
        const wired = wiredDivMap.get(div);
        if (wired?.manager === this) {
            return;
        }
        wired?.abortController.abort();
        const abortController = new AbortController();
        wiredDivMap.set(div, { manager: this, abortController });
        const { signal } = abortController;
        div.addEventListener(
            'wheel',
            (event) => {
                if (!event.ctrlKey) {
                    steerScreenBibleAutoScroll(div, event);
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                const isUp = event.deltaY < 0;
                ScreenLongTextManager.changeTextStyleTextFontSize(isUp);
            },
            { signal },
        );
        // Captured: a scroll event does not bubble, and with several Bibles
        // side by side it is their columns that scroll, not this div
        // (`screenBibleColumnHelpers`).
        div.addEventListener(
            'scroll',
            (event) => {
                const scroller = getScreenBibleScroller(div);
                // The screen remembers one position: its host column's.
                if (event.target === scroller) {
                    this.scroll =
                        scroller.scrollTop /
                        (scroller.scrollHeight - scroller.clientHeight);
                }
                this.applyHeaderEffectOnScroll(div);
            },
            { signal, capture: true },
        );
        div.classList.add(SCREEN_BIBLE_SCROLL_CLASSNAME);
        registerScrollingSyncEvent(div, (scroll, isFromWheel) => {
            this.sendSyncScrollPercentage(
                toScreenBibleScrollSelector(div),
                scroll,
                isFromWheel,
            );
        });
    }

    /**
     * The mini preview's auto-scroll, sent every frame from its exact position.
     * Its scroll events only fire on whole pixels of a box a fraction of the
     * projector's size, so following them moved the projector in hops of
     * several pixels -- the stutter of a slow auto-scroll. Started by the
     * operator's click, so it goes out like a wheel scroll, even with the
     * mouse off the window. While `isPlaying`, the projector slides by the
     * same fractions of a pixel the preview does; the last one lets go.
     * `div` is whatever the auto-scroll moves: the bible div, or the host
     * column when several Bibles scroll side by side.
     */
    sendAutoScrollPosition(
        div: HTMLDivElement,
        scrollTop: number,
        isPlaying: boolean,
    ) {
        const rangeY = div.scrollHeight - div.clientHeight;
        if (rangeY <= 0) {
            return;
        }
        const rangeX = div.scrollWidth - div.clientWidth;
        this.sendSyncScrollPercentage(
            toScreenBibleScrollSelector(div),
            {
                x: rangeX > 0 ? div.scrollLeft / rangeX : 0,
                y: scrollTop / rangeY,
            },
            true,
            isPlaying,
        );
    }

    /**
     * Let go of the mini preview's div when it unmounts -- its rendering was
     * turned off, or its panel closed -- so a passage presented meanwhile is
     * not still laid out into a detached div. The data stays; the next div
     * renders it. Only if it is still the div this manager holds (a card
     * remounted for a colour-note change attaches its new one first, see
     * `ScreenDrawManager.releaseDiv`), and never on the projected screen.
     */
    releaseDiv(div: HTMLDivElement) {
        if (appProvider.isPageScreen || this._div !== div) {
            return;
        }
        this._div = null;
    }

    get screenViewData() {
        return this._screenViewData;
    }

    set screenViewData(screenViewData: LongTextDataType | null) {
        this._screenViewData = screenViewData;
        this.applyBibleViewData(screenViewData);
        this.render();
        persistOnScreenEntry({
            lockKey: `set-${screenManagerSettingNames.FULL_TEXT}`,
            settingName: screenManagerSettingNames.FULL_TEXT,
            key: this.key,
            value: screenViewData,
            readMap: getBibleListOnScreenSetting,
            collectLive: this.collectLiveBibleList,
            onDone: () => {
                this.fireUpdateEvent();
            },
        });
        this.sendSyncScreen();
    }

    // The versions on the screen, carried over to the next passage. None
    // while it holds a long text: its columns are languages, and a Bible
    // presented after it must not go looking for a version named `KM`.
    getRenderedBibleKeys() {
        return (getBibleItemData(this._screenViewData)?.renderedList ?? []).map(
            ({ bibleKey }) => bibleKey,
        );
    }

    private _setMetadata(key: string, value: any) {
        if (this._screenViewData === null) {
            return;
        }
        // Replaced, never written through. `_screenViewData` is seeded from
        // `getBibleListOnScreenSetting()` (see the constructor), and that map's
        // nested values are shared with the memoized parse of the setting — so
        // writing `scroll` in place put this screen's scroll position into
        // every other reader's view of the setting.
        this._screenViewData = { ...this._screenViewData, [key]: value };
        if (appProvider.isPageScreen) {
            return;
        }
        // `scroll` is driven by the bible view's scroll listener, so this used
        // to stringify the whole on-screen map and do a synchronous whole-file
        // write on every scroll frame. Only the final position matters, and the
        // trailing run re-reads `_screenViewData`, so it always persists the
        // latest one.
        this.saveMetadataAttempt(() => {
            const screenViewData = this._screenViewData;
            if (screenViewData === null) {
                return;
            }
            persistOnScreenEntry({
                lockKey: `set-meta-${screenManagerSettingNames.FULL_TEXT}`,
                settingName: screenManagerSettingNames.FULL_TEXT,
                key: this.key,
                value: screenViewData,
                readMap: getBibleListOnScreenSetting,
                collectLive: this.collectLiveBibleList,
            });
        });
    }

    get containerStyle(): CSSProperties {
        return {
            position: 'absolute',
            width: `${this.screenManagerBase.width}px`,
            height: `${this.screenManagerBase.height}px`,
            overflowX: 'hidden',
            overflowY: 'auto',
        };
    }

    get selectedKJVVerseKey() {
        return this._screenViewData === null
            ? null
            : this._screenViewData.selectedKJVVerseKey;
    }

    set selectedKJVVerseKey(selectedKJVVerseKey: string | null) {
        this._setMetadata('selectedKJVVerseKey', selectedKJVVerseKey);
        this.renderSelectedIndex();
        if (this.isShowingLongText) {
            // Its panel lights the button of the row that is marked, whether
            // the mark was made there or by a click on the text itself.
            this.addPropEvent('selected');
            ScreenLongTextManager.addPropEvent('selected');
        }
    }

    get scroll() {
        return this.screenViewData?.scroll ?? 0;
    }

    set scroll(scroll: number) {
        this._setMetadata('scroll', scroll);
    }
    // `isToTop` / `isToMiddle` ride along only when asked for: the screen
    // then brings the selection to ITS top or middle, which is another pixel
    // than the mini preview's. The preview's glide is not sent for it
    // (`markProgrammaticScroll`).
    sendSyncSelectedIndex(bringTo: 'top' | 'middle' | null = null) {
        this.screenManagerBase.sendScreenMessage(
            {
                screenId: this.screenId,
                type: 'bible-screen-view-selected-index',
                data: {
                    selectedKJVVerseKey: this.selectedKJVVerseKey,
                    ...(bringTo === 'top' ? { isToTop: true } : {}),
                    ...(bringTo === 'middle' ? { isToMiddle: true } : {}),
                },
            },
            true,
        );
    }

    static receiveSyncSelectedIndex(message: ScreenMessageType) {
        const { data, screenId } = message;
        const screenLongTextManager = this.getInstance(screenId);
        if (screenLongTextManager === null) {
            return;
        }
        if (data.isToTop === true) {
            screenLongTextManager.isToTop = true;
        }
        if (data.isToMiddle === true) {
            screenLongTextManager.isToMiddle = true;
        }
        screenLongTextManager.selectedKJVVerseKey = data.selectedKJVVerseKey;
    }

    // The same text as the other screen's: the same long text, or any Bible
    // passage -- what a verse clicked in the Reader is written to as well.
    private checkIsSameText(other: ScreenLongTextManager) {
        const data = this._screenViewData;
        const otherData = other._screenViewData;
        if (data === null || otherData === null) {
            return false;
        }
        if (checkIsLongTextData(otherData)) {
            return this.checkIsLongTextSource(otherData.longTextData.sourceId);
        }
        return !checkIsLongTextData(data);
    }

    /**
     * A colour-group member takes the selection a screen of its group just
     * made -- on its mini preview, on its projector, from a long text's
     * panel -- and brings it into view on its own layout. Grouped screens
     * are not always one size, and a member that followed the sender's
     * SCROLL instead had its own glide to the same place stopped by it.
     * Passed over: a locked member, and one holding another text, whose own
     * mark the key would only drop. Answers whether it was taken, so the
     * caller tells the member's own window too.
     */
    static receiveGroupSelectedIndex(
        fromScreenId: number,
        message: ScreenMessageType,
    ) {
        const from = this.getInstance(fromScreenId);
        const member = this.getInstance(message.screenId);
        if (
            from === null ||
            member === null ||
            member.screenManagerBase.isLocked ||
            !member.checkIsSameText(from)
        ) {
            return false;
        }
        this.receiveSyncSelectedIndex(message);
        return true;
    }

    /**
     * Select a section and bring it to the vertical middle, here and on
     * the projector: where the eyes of a room singing along already are.
     * A row already selected is brought back there too -- the operator
     * pressed for the scroll, not for the mark.
     */
    bringSectionToMiddle(sectionKey: string) {
        this.isToMiddle = true;
        this.selectedKJVVerseKey = sectionKey;
        this.sendSyncSelectedIndex('middle');
    }

    toSyncMessage(): BasicScreenMessageType {
        return {
            type: 'bible-screen-view',
            data: this.screenViewData,
        };
    }

    applyFullDataSrcWithSyncGroup(bibleData: LongTextDataType | null) {
        if (this.screenManagerBase.checkIsLockedWithMessage()) {
            return;
        }
        ScreenLongTextManager.enableSyncGroup(this.screenId);
        this.screenViewData = bibleData;
    }

    receiveSyncScreen(message: ScreenMessageType) {
        if (this.screenManagerBase.checkIsLockedWithMessage()) {
            return;
        }
        this.screenViewData = message.data;
    }

    fireUpdateEvent() {
        super.fireUpdateEvent();
        ScreenLongTextManager.fireUpdateEvent();
    }

    static readonly maxTextStyleTextFontSize = MAX_BIBLE_TEXT_FONT_SIZE;
    static get textStyleTextFontSize() {
        return readBibleTextFontSize(this.textStyle);
    }

    static changeTextStyleTextFontSize(isUp: boolean) {
        let fontSize = this.textStyleTextFontSize;
        fontSize += isUp ? 1 : -1;
        this.applyTextStyle({
            fontSize: Math.min(
                this.maxTextStyleTextFontSize,
                Math.max(1, fontSize),
            ),
        });
    }

    static get textStyleTextColor(): string {
        return readBibleTextColor(this.textStyle);
    }

    static get textStyleTextTextShadow(): string {
        return readBibleTextShadow(this.textStyle);
    }

    static get textStyleText(): string {
        return genBibleTextStyleCss(this.textStyle);
    }

    static get textStyle(): AnyObjectType {
        return textStyleSettingManager.getSetting();
    }

    static set textStyle(style: AnyObjectType) {
        textStyleSettingManager.setSetting(style);
        this.addPropEvent('text-style');
    }

    static applyTextStyle(style: AnyObjectType) {
        const textStyle = this.textStyle;
        Object.assign(textStyle, style);
        this.textStyle = textStyle;
        this.sendSynTextStyle();
    }

    static sendSynTextStyle() {
        for (const screenManagerBase of getAllScreenManagerBases()) {
            screenManagerBase.sendScreenMessage(
                {
                    screenId: screenManagerBase.screenId,
                    type: 'bible-screen-view-text-style',
                    data: {
                        textStyle: this.textStyle,
                    },
                },
                true,
            );
        }
    }

    static receiveSyncTextStyle(message: ScreenMessageType) {
        const { data } = message;
        this.textStyle = data.textStyle;
    }

    async applyNewBibleItemJson(
        bibleItemJson: BibleItemType,
        filePath: string | undefined,
    ) {
        let bibleKeys = this.getRenderedBibleKeys();
        if (bibleKeys.length === 1) {
            bibleKeys = [bibleItemJson.bibleKey];
        } else if (bibleKeys.length > 1) {
            bibleKeys = Array.from(
                new Set([bibleItemJson.bibleKey].concat(bibleKeys)),
            );
        }
        const newBibleItemData = await bibleItemJsonToScreenViewData(
            bibleItemJson,
            bibleKeys,
        );
        this.applyFullDataSrcWithSyncGroup(newBibleItemData);
        if (filePath !== undefined) {
            applyAttachBackground(this.screenId, filePath, bibleItemJson.id);
        }
    }

    /**
     * The operator's `...` under a passage crossing chapters: the same
     * passage, in the same versions, one chapter deeper, on this screen and
     * every screen synced with it.
     *
     * The scroll is a share of the scrollable height, which the new chapter
     * grows; it is scaled by the verses before and after so the view stays
     * about where it was instead of jumping past the chapter just added.
     */
    async showMoreBibleChapter() {
        const screenViewData = this._screenViewData;
        if (
            screenViewData?.type !== 'bible-item' ||
            screenViewData.bibleItemData === undefined
        ) {
            return;
        }
        const { bibleItem, renderedList } = screenViewData.bibleItemData;
        const shownChapterCount =
            screenViewData.shownChapterCount ?? BIBLE_SHOWN_CHAPTER_COUNT;
        if (shownChapterCount >= getTargetChapterCount(bibleItem.target)) {
            return;
        }
        const newBibleItemData = await bibleItemJsonToScreenViewData(
            bibleItem,
            this.getRenderedBibleKeys(),
            shownChapterCount + 1,
        );
        const oldVerseCount = renderedList[0]?.verses.length ?? 0;
        const newVerseCount =
            newBibleItemData.bibleItemData?.renderedList[0]?.verses.length ?? 0;
        this.applyFullDataSrcWithSyncGroup({
            ...newBibleItemData,
            scroll:
                newVerseCount > 0
                    ? (screenViewData.scroll * oldVerseCount) / newVerseCount
                    : screenViewData.scroll,
            selectedKJVVerseKey: screenViewData.selectedKJVVerseKey,
        });
    }

    static async handleBibleItemSelecting(
        event: MouseEvent | null,
        bibleItem: BibleItem,
        isForceChoosing = false,
    ) {
        const bibleItemJson = bibleItem.toJson();
        const screenIds = await this.chooseScreenIds(
            genScreenMouseEvent(event) as any,
            isForceChoosing,
        );
        let filePath = bibleItem.filePath;
        if (filePath === undefined) {
            const defaultBible = await Bible.getDefault();
            filePath = defaultBible?.filePath ?? undefined;
        }
        for (const screenId of screenIds) {
            const screenLongTextManager = this.getInstance(screenId);
            if (screenLongTextManager === null) {
                showSimpleToast(
                    tran(
                        'Failed to apply to screen. Please make sure the screen is open.',
                    ),
                    tran('Error'),
                );
                continue;
            }
            await screenLongTextManager.applyNewBibleItemJson(
                bibleItemJson,
                filePath,
            );
        }
    }

    /**
     * Put a long text on the screens the operator meant.
     *
     * The Bible's own door (`handleBibleItemSelecting`) without what is only
     * a Bible's: no version is carried over and no background is attached.
     * `applyFullDataSrcWithSyncGroup` is what refuses a locked screen and
     * takes the colour-note group along. Answers with the screens that hold
     * it afterwards.
     */
    static async handleLongTextShowing(
        event: MouseEvent | null,
        longTextData: LongTextItemDataType,
        isForceChoosing = false,
    ) {
        const screenIds = await this.chooseScreenIds(
            genScreenMouseEvent(event) as any,
            isForceChoosing,
        );
        const { sourceId } = longTextData.longTextData;
        const shownScreenIds: number[] = [];
        for (const screenId of screenIds) {
            const screenLongTextManager = this.getInstance(screenId);
            if (screenLongTextManager === null) {
                showSimpleToast(
                    tran(
                        'Failed to apply to screen. Please make sure the screen is open.',
                    ),
                    tran('Error'),
                );
                continue;
            }
            screenLongTextManager.applyFullDataSrcWithSyncGroup(
                cloneJson(longTextData),
            );
            if (screenLongTextManager.checkIsLongTextSource(sourceId)) {
                shownScreenIds.push(screenId);
            }
        }
        return shownScreenIds;
    }

    checkIsLongTextSource(sourceId: string) {
        const screenViewData = this._screenViewData;
        return (
            checkIsLongTextData(screenViewData) &&
            screenViewData.longTextData.sourceId === sourceId
        );
    }

    /**
     * Every screen holding a long text, or only that source's -- what a
     * panel draws its on-screen marks and Hide chips from.
     *
     * Read off the on-screen setting, as the foreground panels read
     * theirs: the managers do not exist yet when a panel is first drawn
     * after a reload, and a text restored to a screen was then marked
     * nowhere until something else changed. The reader is memoized on the
     * setting's raw string, so asking on every render parses nothing; and
     * the update event a panel redraws on is fired AFTER that setting is
     * written.
     */
    static getLongTextShowingList(sourceId?: string) {
        const showingList: [number, LongTextItemDataType][] = [];
        const onScreenMap = getBibleListOnScreenSetting();
        for (const [key, screenViewData] of Object.entries(onScreenMap)) {
            if (
                checkIsLongTextData(screenViewData) &&
                (sourceId === undefined ||
                    screenViewData.longTextData.sourceId === sourceId)
            ) {
                showingList.push([Number(key), screenViewData]);
            }
        }
        return showingList;
    }

    // The LIVE managers holding that source's text, for what acts on it:
    // their data is the screen's own, position and selected row included,
    // which the setting only catches up with half a second later.
    private static getLongTextSourceInstances(sourceId: string) {
        return this.getAllInstancesBase<ScreenLongTextManager>().filter(
            (instance) => {
                return instance.checkIsLongTextSource(sourceId);
            },
        );
    }

    /**
     * Take that source's long text off one screen, or off every one. Only
     * ITS: the same layer may be holding a Bible passage, or another
     * session's text, by the time a stale Hide button is pressed.
     */
    static hideLongText(sourceId: string, screenId?: number) {
        for (const instance of this.getLongTextSourceInstances(sourceId)) {
            if (screenId === undefined || screenId === instance.screenId) {
                instance.clear();
            }
        }
    }

    /**
     * Bring one ROW of that source's text to the middle of every screen it
     * is on. A row, not a part: a Chorus sung twice is two rows, and the
     * second press goes to the second.
     */
    static bringLongTextRowToMiddle(sourceId: string, rowIndex: number) {
        const sectionKey = toLongTextSectionKey(rowIndex);
        for (const instance of this.getLongTextSourceInstances(sourceId)) {
            instance.bringSectionToMiddle(sectionKey);
        }
    }

    /**
     * The rows of that source's text that are marked, on any screen it is
     * on -- what its panel lights the matching buttons from.
     *
     * The live managers' word where there are any: the mark is theirs, and
     * the setting only catches up with it half a second later. The setting
     * stands in while there is no manager yet, which is how a panel drawn
     * straight after a reload still shows where the song had got to.
     */
    static getLongTextSelectedSectionKeys(sourceId: string) {
        const instances = this.getLongTextSourceInstances(sourceId);
        const keys =
            instances.length > 0
                ? instances.map((instance) => {
                      return instance.selectedKJVVerseKey;
                  })
                : this.getLongTextShowingList(sourceId).map(([, data]) => {
                      return data.selectedKJVVerseKey;
                  });
        return Array.from(
            new Set(
                keys.filter((key): key is string => {
                    return typeof key === 'string';
                }),
            ),
        );
    }

    /**
     * Restyle that source's columns where they are showing, matched by their
     * code. The words, the position and the selected row are the screen's
     * own; a locked screen is passed over without a word, because nobody
     * pressed anything on it.
     */
    static restyleLongText(
        sourceId: string,
        styleByCode: { [code: string]: LongTextColumnStyleType | undefined },
    ) {
        for (const instance of this.getLongTextSourceInstances(sourceId)) {
            const screenViewData = instance.screenViewData;
            if (
                !checkIsLongTextData(screenViewData) ||
                instance.screenManagerBase.isLocked
            ) {
                continue;
            }
            const newScreenViewData = withLongTextColumnStyles(
                screenViewData,
                styleByCode,
            );
            if (
                JSON.stringify(newScreenViewData) ===
                JSON.stringify(screenViewData)
            ) {
                continue;
            }
            instance.applyFullDataSrcWithSyncGroup(newScreenViewData);
        }
    }

    render() {
        renderScreenLongTextManager(this);
    }

    handleScreenVersesHighlighting(kjvVerseKey: string, isToTop: boolean) {
        onSelectKey(this, kjvVerseKey, isToTop);
    }

    renderSelectedIndex() {
        // Taken whether or not there is a div to scroll: one left behind by a
        // card drawn without it -- a group member's, say -- would bend that
        // screen's next, ordinary selection.
        const isToTop = this.isToTop;
        this.isToTop = false;
        const isToMiddle = this.isToMiddle;
        this.isToMiddle = false;
        if (this.div === null) {
            return;
        }
        bibleScreenHelper.removeClassName(this.div, 'selected');
        const selectedBlockDoms = bibleScreenHelper.resetClassName(
            this.div,
            'selected',
            true,
            `${this.selectedKJVVerseKey}`,
        );
        if (selectedBlockDoms.length > 0) {
            markScreenBibleProgrammaticScroll(this.div);
        }
        if (isToMiddle) {
            // The ROW, once. The cells of one row are other heights in each
            // language, and centring them one after another left the last
            // cell centred and the row wherever that happened to put it.
            const firstBlockDom = selectedBlockDoms[0];
            if (firstBlockDom !== undefined) {
                bringDomToCenterView(
                    firstBlockDom.closest('tr') ?? firstBlockDom,
                );
            }
            return;
        }
        for (const blockDom of selectedBlockDoms) {
            if (isToTop) {
                bringDomToTopView(blockDom);
                this.handleBibleViewVersesHighlighting(
                    (blockDom as any).dataset.kjvVerseKey,
                    true,
                );
            } else {
                const isPartiallyInvisible = checkIsVerticalPartialInvisible(
                    this.div,
                    blockDom as HTMLElement,
                );
                if (isPartiallyInvisible) {
                    bringDomToCenterView(blockDom);
                } else {
                    bringDomToNearestView(blockDom);
                }
                this.handleBibleViewVersesHighlighting(
                    (blockDom as any).dataset.kjvVerseKey,
                    false,
                );
            }
        }
    }

    reflectBackgroundColor(backgroundColor: string) {
        const isBackgroundColorDark = checkIsColorDark(backgroundColor);
        const isTextColorDark = checkIsColorDark(
            ScreenLongTextManager.textStyleTextColor,
        );
        if (isBackgroundColorDark !== isTextColorDark) {
            return;
        }
        // Readable FIRST, then said. This runs after the background is
        // already live, and asking before fixing the text left a showing
        // projector with white-on-white (or black-on-black) words for as long
        // as the question stayed open -- during a service, the moment nobody
        // is looking at the operator's screen. And it is SAID, with an Undo,
        // not asked: a blocking question here stopped a run sheet walking onto
        // a colour line until somebody answered it.
        const previousColor = ScreenLongTextManager.textStyle.color;
        const contrastingColor = isBackgroundColorDark
            ? HEX_COLOR_WHITE
            : HEX_COLOR_BLACK;
        ScreenLongTextManager.applyTextStyle({
            color: contrastingColor,
        });
        showBibleTextColorChangedToast(() => {
            ScreenLongTextManager.applyTextStyle({
                color: previousColor,
            });
        });
    }

    async receiveScreenDropped(droppedData: DroppedDataType) {
        if (droppedData.type === DragTypeEnum.BIBLE_ITEM) {
            const bibleItem: BibleItem = droppedData.item;
            this.applyNewBibleItemJson(
                bibleItem.toJson(),
                droppedData.item.filePath,
            );
        } else {
            loggerHelpers.appLog(droppedData);
        }
    }

    static receiveSyncScreen(message: ScreenMessageType) {
        const { screenId } = message;
        const screenLongTextManager = this.getInstance(screenId);
        if (screenLongTextManager === null) {
            // English on purpose: this receiver also runs in the screen
            // window, and a `tran()` there before its language data has loaded
            // throws in dev (see `ScreenCloseButtonComp`).
            showSimpleToast(
                'Failed to apply to screen. Please make sure the screen is open.',
                'error',
            );
            return;
        }
        screenLongTextManager.receiveSyncScreen(message);
    }

    clear() {
        this.applyFullDataSrcWithSyncGroup(null);
    }

    delete() {
        // Local teardown only — no `clear()`. clear() goes through
        // applyFullDataSrcWithSyncGroup, which broadcasts to every screen
        // sharing this one's color note (deleting one screen would blank its
        // group's bible) and which a locked screen rejects outright with a
        // toast, leaving its data behind. The persisted entry is dropped
        // centrally by deleteScreenPersistedData.
        removeSetting(this.lineSyncKey);
        this._screenViewData = null;
        this._div = null;
        this.applyBibleViewData = () => {};
        this.handleBibleViewVersesHighlighting = () => {};
        super.delete();
    }

    static getInstance(screenId: number) {
        return super.getInstanceBase<ScreenLongTextManager>(screenId);
    }
}

export default ScreenLongTextManager;
