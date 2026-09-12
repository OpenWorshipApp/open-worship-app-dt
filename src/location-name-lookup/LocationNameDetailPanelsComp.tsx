// Also imported by the lookup panel; the detail widget can outlive it, so this
// chunk carries the stylesheet rather than depending on the other one's import.
import './LocationNameLookupPanelComp.scss';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import OpenGraphPreviewButtonComp from '../graph-view/OpenGraphPreviewButtonComp';
import { getCurrentLookupBibleItemController } from '../bible-reader/LookupBibleItemController';
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
    toVerseFullTitle,
    useLookupVerseFontFamily,
} from './bibleVerseHelpers';
import type { DetailPanelType } from './detailPanelHelpers';
import { closeDetailPanel, useOpenDetailPanels } from './detailPanelHelpers';
import type { LookupManagersType } from './lookupDataHelpers';
import { useLookupLangPresentation } from './lookupLangHelpers';
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
}: Readonly<{ shortVerse: string }>) {
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
                openVerseInBibleLookup(currentViewController, shortVerse)
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

function RenderDetailPanelComp({
    index,
    managers,
    panel,
}: Readonly<{
    index: number;
    managers: LookupManagersType;
    panel: DetailPanelType;
}>) {
    // The copy payload is assembled from what the body actually resolved, so a
    // record whose verse titles have not been read yet copies the raw
    // references rather than blocking on dozens of bible reads.
    const textScale = useBibleViewTextScale();
    const { fontFamily } = useLookupLangPresentation();
    const verseFontFamily = useLookupVerseFontFamily();
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
        panel.kind === 'name'
            ? managers.namesLookupManager.getRecordById(panel.target)
            : null;
    const locationRecord =
        panel.kind === 'location'
            ? managers.locationsLookupManager.getRecordById(panel.target)
            : null;
    const record = nameRecord ?? locationRecord;
    // `panel.name` stays the provisional title until the body has resolved.
    const title = record?.name ?? verseData?.title ?? panel.name;
    // A verse panel's title is a reference, not a record name, so there is
    // never an English one to add to it.
    const kjvName = record === null ? '' : getRecordKjvName(record);
    const handleCopy = async () => {
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
        if (record === null) {
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
                    {panel.kind === 'verse' ? null : (
                        <OpenGraphPreviewButtonComp
                            kind={panel.kind}
                            recordId={panel.target}
                            name={title}
                        />
                    )}
                    {panel.kind === 'verse' && verseData !== null ? (
                        <span
                            className={
                                'flex-shrink-0' +
                                ' location-name-lookup__kjv-name'
                            }
                        >
                            ({verseData.bibleKey})
                        </span>
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
            extraActionButtons={<RenderCopyButtonComp onCopy={handleCopy} />}
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
                        onResolved={setVerseData}
                    />
                ) : null}
            </div>
        </FloatingWidgetComp>
    );
}

export default function LocationNameDetailPanelsComp() {
    const openPanels = useOpenDetailPanels();
    const { theme } = useThemeSource();
    // The SAME instance the lookup panel holds, whenever that is open: the hook
    // reference-counts one shared value rather than each tree loading its own
    // ~34MB copy. The panels can still outlive the lookup, which is why they
    // take a reference of their own instead of reading one out of a context.
    const managers = useLookupManagers();
    if (openPanels.length === 0) {
        return null;
    }
    return createPortal(
        <div className="app app-floating-widget-portal" data-bs-theme={theme}>
            {managers == null ? (
                <FloatingWidgetComp
                    title={tran('Loading lookup data')}
                    onClose={() => {
                        closeDetailPanel(openPanels[0].key);
                    }}
                    options={{ width: 300, height: 160, isAboveModal: true }}
                >
                    <LoadingComp />
                </FloatingWidgetComp>
            ) : (
                <LookupManagersContext value={managers}>
                    {openPanels.map((panel, index) => {
                        return (
                            <RenderDetailPanelComp
                                key={panel.key}
                                index={index}
                                managers={managers}
                                panel={panel}
                            />
                        );
                    })}
                </LookupManagersContext>
            )}
        </div>,
        document.body,
    );
}
