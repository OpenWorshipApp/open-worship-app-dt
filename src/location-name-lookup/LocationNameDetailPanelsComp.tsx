// Also imported by the lookup panel; the detail widget can outlive it, so this
// chunk carries the stylesheet rather than depending on the other one's import.
import './LocationNameLookupPanelComp.scss';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import { useAppCurrentRef } from '../helper/appHooks';
import { useBibleViewTextScale } from '../helper/bibleViewHelpers';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import LoadingComp from '../others/LoadingComp';
import { showSimpleToast } from '../toast/toastHelpers';
import { useThemeSource } from '../others/themeHelpers';
import { openVerseInBibleLookup } from './bibleVerseHelpers';
import type { DetailPanelType } from './detailPanelHelpers';
import { closeDetailPanel, useOpenDetailPanels } from './detailPanelHelpers';
import type { LookupManagersType } from './lookupDataHelpers';
import {
    LookupManagersContext,
    useLookupManagers,
} from './lookupManagersContext';
import {
    LOCATION_ICON_CLASS,
    getNameTypeIconClass,
} from './lookupPresentationHelpers';
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
 * The controller comes from the header this panel was opened from — the portal
 * keeps React context, and `LocationNameLookupToggleComp` only ever renders
 * inside `InputHandlerComp`, which requires the same controller itself.
 */
function RenderOpenInLookupButtonComp({
    shortVerse,
}: Readonly<{ shortVerse: string }>) {
    const viewController = useLookupBibleItemControllerContext();
    const viewControllerRef = useAppCurrentRef(viewController);
    const label = tran('Open in bible lookup');
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
                openVerseInBibleLookup(viewControllerRef.current, shortVerse)
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

function getPanelIconClass(
    panel: DetailPanelType,
    managers: LookupManagersType,
) {
    if (panel.kind === 'verse') {
        return 'bi bi-book-half';
    }
    if (panel.kind === 'location') {
        return LOCATION_ICON_CLASS;
    }
    const record = managers.namesLookupManager.getRecordById(panel.target);
    return getNameTypeIconClass(record?.type);
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
    const resolvedVersesRef = useRef<string[]>([]);
    const verseTextRef = useRef<{ title: string; fullText: string } | null>(
        null,
    );
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
    const title = record?.name ?? panel.name;
    const handleCopy = async () => {
        if (panel.kind === 'verse') {
            const verseText = verseTextRef.current;
            // The reference belongs with the text — a bare verse pasted into a
            // sermon note with no "Exodus 6:23" attached is not much use.
            const plainText =
                verseText === null
                    ? panel.target
                    : `${verseText.title}\n${verseText.fullText}`;
            await copyRecordToClipboard(
                plainText,
                verseText === null
                    ? `<p>${escapeHtml(plainText)}</p>`
                    : `<p><strong>${escapeHtml(verseText.title)}</strong></p>` +
                          `<p>${escapeHtml(verseText.fullText)}</p>`,
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
                    // cursor text select
                    style={{ cursor: 'text' }}
                >
                    <i className={getPanelIconClass(panel, managers)} />
                    <span className="text-truncate">{title}</span>
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
            options={{
                width: DETAIL_PANEL_WIDTH,
                height: 420,
                minWidth: 260,
                minHeight: 180,
                initialOffset: DETAIL_PANEL_BASE_OFFSET + index * CASCADE_STEP,
                extraClassName: 'location-name-lookup-detail-widget',
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
                        onResolved={(verseTitle, fullText) => {
                            verseTextRef.current = {
                                title: verseTitle,
                                fullText,
                            };
                        }}
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
                    options={{ width: 300, height: 160 }}
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
