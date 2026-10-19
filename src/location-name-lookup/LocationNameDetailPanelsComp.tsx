// Also imported by the lookup panel; the detail widget can outlive it, so this
// chunk carries the stylesheet rather than depending on the other one's import.
import './LocationNameLookupPanelComp.scss';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import { showBibleKeyOption } from '../bible-lookup/BibleKeySelectionComp';
import OpenGraphPreviewButtonComp from '../graph-view/OpenGraphPreviewButtonComp';
import { getCurrentLookupBibleItemController } from '../bible-reader/LookupBibleItemController';
import { getIsAIEnabled } from '../helper/ai/aiHelpers';
import type { LookupAskType } from '../helper/ai/lookupAskHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { useBibleViewTextScale } from '../helper/bibleViewHelpers';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import LoadingComp from '../others/LoadingComp';
import { showSimpleToast } from '../toast/toastHelpers';
import { useThemeSource } from '../others/themeHelpers';
import type { VerseDataType } from './bibleVerseHelpers';
import {
    openVerseInBibleLookup,
    shortToVerseCopyData,
    toVerseFullTitle,
    useLookupVerseFontFamily,
} from './bibleVerseHelpers';
import type { DetailPanelType } from './detailPanelHelpers';
import {
    closeDetailPanel,
    openDetailPanel,
    useOpenDetailPanels,
} from './detailPanelHelpers';
import type { LookupManagersType } from './lookupDataHelpers';
import {
    LookupLangContext,
    useLookupLangPresentation,
} from './lookupLangHelpers';
import LookupLangCodeButtonComp from './LookupLangCodeButtonComp';
import {
    LookupManagersContext,
    useLookupManagers,
} from './lookupManagersContext';
import { getRecordKjvName } from './lookupPresentationHelpers';
import {
    buildLocationSummary,
    buildNameSummary,
    copyRecordToClipboard,
    escapeHtml,
} from './lookupRecordHelpers';
import {
    RenderLocationDetailComp,
    RenderNameDetailComp,
    RenderVerseDetailComp,
} from './RenderDetailBodyComp';

const COPIED_FEEDBACK_MILLISECOND = 1600;
const DETAIL_PANEL_WIDTH = 360;
// `initialOffset` shifts a widget left and down from the top-right corner, so
// starting a bit more than the lookup panel's own width out lands the first
// detail BESIDE it rather than on top of it. (Only the initial position — a
// lookup panel the user has dragged elsewhere is not tracked, and every panel
// is draggable anyway.)
const DETAIL_PANEL_BASE_OFFSET = 372;
// Each further panel is nudged down-left from the last, so following a chain of
// references does not bury them all on the same spot.
const CASCADE_STEP = 28;

function RenderCopyButtonComp({
    onCopy,
}: Readonly<{ onCopy: () => Promise<void> }>) {
    const [isCopied, setIsCopied] = useState(false);
    const timeoutIdRef = useRef<any>(null);
    // The widget can be closed while the "Copied" tick is still showing.
    useEffect(() => {
        return () => {
            if (timeoutIdRef.current !== null) {
                clearTimeout(timeoutIdRef.current);
                timeoutIdRef.current = null;
            }
        };
    }, []);
    const label = isCopied ? tran('Copied') : tran('Copy');
    return (
        <button
            type="button"
            className="floating-widget__button"
            title={label}
            aria-label={label}
            onClick={() => {
                onCopy()
                    .then(() => {
                        setIsCopied(true);
                        if (timeoutIdRef.current !== null) {
                            clearTimeout(timeoutIdRef.current);
                        }
                        timeoutIdRef.current = setTimeout(() => {
                            setIsCopied(false);
                            timeoutIdRef.current = null;
                        }, COPIED_FEEDBACK_MILLISECOND);
                    })
                    .catch(handleError);
            }}
        >
            <i className={`bi bi-${isCopied ? 'check2' : 'copy'}`} />
        </button>
    );
}

/**
 * Loads the verse into the reader's lookup input behind the panel.
 *
 * These panels are window-level widgets — a name clicked in any verse opens one
 * from a tree with no lookup controller in scope — so the controller is taken
 * from the module registry `BibleReaderComp` publishes, NOT from React context.
 * Reading context here would throw and take the whole window down. When no
 * reader is mounted there is nowhere to open the verse, so the button is simply
 * not offered.
 */
function RenderOpenInLookupButtonComp({
    shortVerse,
    bibleKey,
}: Readonly<{ shortVerse: string; bibleKey?: string }>) {
    const viewController = getCurrentLookupBibleItemController();
    const viewControllerRef = useAppCurrentRef(viewController);
    const label = tran('Open in bible lookup');
    if (viewController === null) {
        return null;
    }
    return (
        <button
            type="button"
            className={
                'floating-widget__button flex-shrink-0' +
                ' location-name-lookup__title-button'
            }
            title={label}
            aria-label={label}
            onClick={() => {
                const currentViewController = viewControllerRef.current;
                if (currentViewController === null) {
                    return;
                }
                openVerseInBibleLookup(
                    currentViewController,
                    shortVerse,
                    bibleKey,
                )
                    .then((isOpened) => {
                        if (!isOpened) {
                            showSimpleToast(
                                tran('Open in bible lookup'),
                                tran('Unable to seek bible item'),
                            );
                        }
                    })
                    .catch(handleError);
            }}
        >
            <i className="bi bi-eye" />
        </button>
    );
}

/**
 * The 🤖 at the left of the title (2026-10-18, the user's picture of three
 * panels with that corner circled: _add robot icon, click to open chatbot,
 * make sure mcp tool provide all information to chatbot session then let
 * user interact_). It opens the assistant on what the panel shows -- a tab
 * of its own that reads the record through `owa_lookup_record` and is ready
 * to be asked about it -- after the 🤖's own two questions (whether AI is
 * on, then the caution). Handed over is WHICH record and the window it is
 * open in (`lookupAskHelpers.ts`), where its data is already held.
 *
 * Drawn only while AI is on, like the Resources panel's: a control on a
 * reading surface that can only say "AI is off" is clutter there.
 */
function RenderAskAssistantButtonComp({
    ask,
}: Readonly<{ ask: LookupAskType }>) {
    const askRef = useAppCurrentRef(ask);
    if (!getIsAIEnabled()) {
        return null;
    }
    // Literal keys, so the dictionary check reads each one.
    const label =
        ask.kind === 'verse'
            ? tran('Ask the Assistant About This Passage')
            : ask.kind === 'location'
              ? tran('Ask the Assistant About This Place')
              : tran('Ask the Assistant About This Person');
    return (
        <button
            type="button"
            className={
                'floating-widget__button flex-shrink-0' +
                ' location-name-lookup__title-button'
            }
            title={label}
            aria-label={label}
            onClick={() => {
                // Loaded at the press: the dialogs the assistant asks first
                // and the window opener are nothing a panel needs until then.
                import('../helper/ai/chatbotHandoffHelpers')
                    .then(({ openChatbotWithLookup }) => {
                        return openChatbotWithLookup(askRef.current);
                    })
                    .catch(handleError);
            }}
        >
            <i className="bi bi-robot" />
        </button>
    );
}

/**
 * The verse panel's `(KJV)`: pressed, it lists the other installed bibles,
 * and the one picked opens as a panel of its own beside this one -- the
 * verse in two bibles is two panels, never this one re-read.
 */
function RenderVerseBibleKeyButtonComp({
    bibleKey,
    shortVerse,
    title,
}: Readonly<{ bibleKey: string; shortVerse: string; title: string }>) {
    const label = tran('Open in another Bible');
    return (
        <button
            type="button"
            className={
                'flex-shrink-0 location-name-lookup__kjv-name' +
                ' location-name-lookup__bible-key-button'
            }
            title={label}
            aria-label={`${label}: ${bibleKey}`}
            aria-haspopup="menu"
            onClick={(event) => {
                showBibleKeyOption(
                    event,
                    (newBibleKey) => {
                        openDetailPanel({
                            kind: 'verse',
                            target: shortVerse,
                            name: title,
                            bibleKey: newBibleKey,
                        });
                    },
                    [bibleKey],
                    label,
                ).catch(handleError);
            }}
        >
            ({bibleKey})
        </button>
    );
}

function RenderDetailPanelComp({
    index,
    managers,
    panel,
}: Readonly<{
    index: number;
    // Null for a verse panel, which reads nothing out of the lookup dataset.
    managers: LookupManagersType | null;
    panel: DetailPanelType;
}>) {
    // The copy payload is assembled from what the body actually resolved, so a
    // record whose verse titles have not been read yet copies the raw
    // references rather than blocking on dozens of bible reads.
    const textScale = useBibleViewTextScale();
    const { fontFamily } = useLookupLangPresentation();
    const verseFontFamily = useLookupVerseFontFamily(panel.bibleKey);
    const resolvedVersesRef = useRef<string[]>([]);
    // A verse panel has no record to name it, so `panel.name` — the reference as
    // it read the moment the panel was opened — used to be its title for good.
    // It goes stale the moment the bible behind it changes: switching the lookup
    // language re-titles the BODY (`Genesis 10:4`) and left the title bar
    // showing the previous bible's wording (`លោកុប្បត្តិ ១០:៤`). The body
    // resolves the reference anyway, so its answer is the title.
    //
    // State rather than a ref, and the WHOLE resolved verse rather than its
    // title alone: the title bar now writes the bible key beside the reference
    // and the body no longer repeats either, so the one thing the body resolved
    // feeds both the chrome and the clipboard.
    const [verseData, setVerseData] = useState<VerseDataType | null>(null);
    // Resolved into two separately TYPED locals rather than one union: a single
    // `record` forced an `as any` at each summary call, which is exactly the
    // check that would catch a location record reaching `buildNameSummary`.
    const nameRecord =
        panel.kind === 'name' && managers !== null
            ? managers.namesLookupManager.getRecordById(panel.target)
            : null;
    const locationRecord =
        panel.kind === 'location' && managers !== null
            ? managers.locationsLookupManager.getRecordById(panel.target)
            : null;
    const record = nameRecord ?? locationRecord;
    // `panel.name` stays the provisional title until the body has resolved.
    const title = record?.name ?? verseData?.title ?? panel.name;
    // A verse panel's title is a reference, not a record name, so there is
    // never an English one to add to it.
    const kjvName = record === null ? '' : getRecordKjvName(record);
    // What the 🤖 hands the assistant: the record as the panel was opened
    // with it, by the name it shows -- the language's own, never the KJV's,
    // which the record carries for the assistant -- and the passage in the
    // Bible the body read it in.
    const assistantAsk: LookupAskType = {
        kind: panel.kind,
        target: panel.target,
        title,
        ...(panel.kind === 'verse'
            ? (verseData?.bibleKey ?? panel.bibleKey) === undefined
                ? {}
                : { bibleKey: verseData?.bibleKey ?? panel.bibleKey }
            : panel.langCode === undefined
              ? {}
              : { langCode: panel.langCode }),
        page: globalThis.location?.href ?? '',
    };
    const handleCopy = async () => {
        if (panel.kind === 'verse' && verseData?.sectionList) {
            // Across chapters the WHOLE passage is copied, every chapter under
            // its own title — not just the chapters the panel shows yet.
            const copyData = await shortToVerseCopyData(
                verseData.bibleKey,
                panel.target,
            );
            if (copyData !== null) {
                const fullTitle = toVerseFullTitle(copyData);
                await copyRecordToClipboard(
                    `${fullTitle}\n${copyData.text}`,
                    `<p><strong>${escapeHtml(fullTitle)}</strong></p>` +
                        copyData.sectionList
                            .map(({ title, text }) => {
                                return (
                                    `<p><strong>${escapeHtml(title)}</strong></p>` +
                                    `<p>${escapeHtml(text)}</p>`
                                );
                            })
                            .join(''),
                );
                return;
            }
        }
        if (panel.kind === 'verse') {
            // The reference belongs with the text — a bare verse pasted into a
            // sermon note with no "(KJV) Exodus 6:23" attached is not much use.
            // The body stopped rendering that line once the title bar took the
            // bible key, so this is where the two are joined back together.
            const fullTitle =
                verseData === null ? null : toVerseFullTitle(verseData);
            const plainText =
                verseData === null || fullTitle === null
                    ? panel.target
                    : `${fullTitle}\n${verseData.text}`;
            await copyRecordToClipboard(
                plainText,
                verseData === null || fullTitle === null
                    ? `<p>${escapeHtml(plainText)}</p>`
                    : `<p><strong>${escapeHtml(fullTitle)}</strong></p>` +
                          `<p>${escapeHtml(verseData.text)}</p>`,
            );
            return;
        }
        if (record === null || managers === null) {
            return;
        }
        // The Verses section resolves its titles only once the user expands it,
        // so before that `resolvedVersesRef` is still empty — and an empty list
        // makes the summary builders DROP the row entirely. Copying a record
        // then silently lost every scripture reference it carries; fall back to
        // the raw references, which is what the reader needs either way.
        const resolvedVerses =
            resolvedVersesRef.current.length > 0
                ? resolvedVersesRef.current
                : record.verses;
        if (nameRecord !== null) {
            const summary = buildNameSummary(
                managers,
                nameRecord,
                resolvedVerses,
            );
            await copyRecordToClipboard(summary.plainText, summary.html);
            return;
        }
        if (locationRecord !== null) {
            const summary = buildLocationSummary(
                managers.locationsLookupManager,
                locationRecord,
                resolvedVerses,
            );
            await copyRecordToClipboard(summary.plainText, summary.html);
        }
    };
    return (
        <FloatingWidgetComp
            // One name for every record's panel: the title bar already says
            // WHICH record, and a matcher needs to know what KIND of panel.
            widgetName="Lookup Detail"
            title={
                <span
                    className={
                        'd-inline-flex align-items-center gap-2 text-truncate' +
                        ' px-2 app-selectable-text'
                    }
                    data-no-widget-drag="true"
                    // Zoomed with the SAME factor as the body, so the record's
                    // name in the title bar reads at the bible text's size too
                    // rather than staying at the widget chrome's default — and
                    // set in the same font for the same reason. The title is the
                    // record's own name, but it renders in the widget CHROME,
                    // which is outside the body that carries that font.
                    //
                    // A verse panel is the exception: its title is a
                    // reference written by a BIBLE, not a record name, so it
                    // takes that bible's font. Those two settings are
                    // independent — and under an English lookup language the
                    // reference is a KJV one, which normally names no font at
                    // all and so leaves the chrome exactly as it was.
                    style={{
                        cursor: 'text',
                        fontSize: `${textScale}em`,
                        fontFamily:
                            panel.kind === 'verse'
                                ? verseFontFamily
                                : fontFamily,
                    }}
                >
                    <RenderAskAssistantButtonComp ask={assistantAsk} />
                    {panel.kind === 'verse' ? null : (
                        <OpenGraphPreviewButtonComp
                            kind={panel.kind}
                            recordId={panel.target}
                            name={title}
                        />
                    )}
                    {panel.kind === 'verse' && verseData !== null ? (
                        <RenderVerseBibleKeyButtonComp
                            bibleKey={verseData.bibleKey}
                            shortVerse={panel.target}
                            title={title}
                        />
                    ) : null}
                    <span className="text-truncate">{title}</span>
                    {kjvName === '' ? null : (
                        <span
                            className={
                                'text-truncate' +
                                ' location-name-lookup__kjv-name'
                            }
                        >
                            ({kjvName})
                        </span>
                    )}
                    {panel.kind === 'verse' ? (
                        <RenderOpenInLookupButtonComp
                            shortVerse={panel.target}
                            bibleKey={panel.bibleKey}
                        />
                    ) : null}
                </span>
            }
            onClose={() => {
                closeDetailPanel(panel.key);
            }}
            raiseToken={panel.raiseCount}
            options={{
                width: DETAIL_PANEL_WIDTH,
                height: 420,
                minWidth: 260,
                minHeight: 180,
                initialOffset: DETAIL_PANEL_BASE_OFFSET + index * CASCADE_STEP,
                extraClassName: 'location-name-lookup-detail-widget',
                // The host is a window singleton, so no modal is ever its
                // ancestor — but the record it shows is opened from a name in
                // verse text or from the lookup panel, and both of those live
                // inside the Bible Lookup popup, which would bury the panel the
                // click just asked for.
                isAboveModal: true,
            }}
            extraActionButtons={
                <>
                    {panel.kind === 'verse' ? null : (
                        <LookupLangCodeButtonComp
                            isDetailHeader
                            onSelect={(langCode) => {
                                openDetailPanel({
                                    kind: panel.kind,
                                    target: panel.target,
                                    name: title,
                                    langCode,
                                });
                            }}
                        />
                    )}
                    <RenderCopyButtonComp onCopy={handleCopy} />
                </>
            }
        >
            {/* Tracks the bible text zoom. `zoom` rather than
                `transform: scale` so the body keeps a real layout box and
                scrolls inside the widget instead of painting outside it. */}
            <div className="app-selectable-text" style={{ zoom: textScale }}>
                {panel.kind === 'name' ? (
                    <RenderNameDetailComp
                        recordId={panel.target}
                        onVersesResolved={(titles) => {
                            resolvedVersesRef.current = titles;
                        }}
                    />
                ) : null}
                {panel.kind === 'location' ? (
                    <RenderLocationDetailComp
                        recordId={panel.target}
                        onVersesResolved={(titles) => {
                            resolvedVersesRef.current = titles;
                        }}
                    />
                ) : null}
                {panel.kind === 'verse' ? (
                    <RenderVerseDetailComp
                        shortVerse={panel.target}
                        bibleKey={panel.bibleKey}
                        onResolved={setVerseData}
                    />
                ) : null}
            </div>
        </FloatingWidgetComp>
    );
}

function LoadRecordDetailPanelComp({
    panel,
    index,
}: Readonly<{ panel: DetailPanelType; index: number }>) {
    const managers = useLookupManagers();
    if (managers == null) {
        return (
            <FloatingWidgetComp
                title={panel.name}
                widgetName="Lookup Detail"
                onClose={() => {
                    closeDetailPanel(panel.key);
                }}
                raiseToken={panel.raiseCount}
                options={{
                    width: DETAIL_PANEL_WIDTH,
                    height: 420,
                    initialOffset:
                        DETAIL_PANEL_BASE_OFFSET + index * CASCADE_STEP,
                    isAboveModal: true,
                }}
            >
                {managers === null ? (
                    <div className="text-danger p-2">
                        {tran('Failed to load lookup data')}
                    </div>
                ) : (
                    <LoadingComp message={tran('Loading lookup data')} />
                )}
            </FloatingWidgetComp>
        );
    }
    return (
        <LookupManagersContext value={managers}>
            <RenderDetailPanelComp
                index={index}
                managers={managers}
                panel={panel}
            />
        </LookupManagersContext>
    );
}

function LoadDetailPanelComp({
    panel,
    index,
}: Readonly<{ panel: DetailPanelType; index: number }>) {
    // A verse panel reads one verse out of a bible and nothing out of the
    // names and places dataset, so it must not make the window load that
    // ~34MB: a cross reference or a found verse opens one with no lookup
    // panel already holding the data.
    if (panel.kind === 'verse') {
        return (
            <RenderDetailPanelComp
                index={index}
                managers={null}
                panel={panel}
            />
        );
    }
    return <LoadRecordDetailPanelComp index={index} panel={panel} />;
}

export default function LocationNameDetailPanelsComp() {
    const openPanels = useOpenDetailPanels();
    const { theme } = useThemeSource();
    if (openPanels.length === 0) {
        return null;
    }
    return createPortal(
        <div className="app app-floating-widget-portal" data-bs-theme={theme}>
            {openPanels.map((panel, index) => {
                return (
                    <LookupLangContext
                        key={panel.key}
                        value={panel.langCode ?? null}
                    >
                        <LoadDetailPanelComp index={index} panel={panel} />
                    </LookupLangContext>
                );
            })}
        </div>,
        document.body,
    );
}
