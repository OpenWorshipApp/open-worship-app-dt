import { useState } from 'react';

import { tran } from '../../lang/langHelpers';
import { searchMissingFontFamily } from '../../server/fontHelpers';

// The strip a slides previewer keeps free at its top for the document's menu
// button (`VarySlidesPreviewerComp`): how tall it is, and how wide the button
// and the transition icon beside it are at its right end.
export type DocumentMenuRoomType = { height: number; width: number };

export default function MissingFontFamilyBannerComp({
    missingFontFamilyList,
    refreshLabel,
    onRefresh,
    menuRoom = null,
}: Readonly<{
    missingFontFamilyList: string[];
    // For a converted document (PPTX/DOCX) the list was recorded when the
    // preview was built, so after installing a font only a rebuild clears it.
    // The label is `tran()`'d at the call site so the key stays greppable.
    refreshLabel?: string;
    onRefresh?: () => void;
    // Given where the previewer left that strip above its content: the banner
    // then goes IN it, beside the menu button, instead of under an empty row
    // holding the button alone (asked for by the user: "merge to inline to
    // save space").
    menuRoom?: DocumentMenuRoomType | null;
}>) {
    // Collapsed by default so the preview keeps its vertical space when the
    // user can't (or won't) install the missing fonts.
    const [isExpanded, setIsExpanded] = useState(false);
    // Re-collapse when switching to another document (this component instance
    // is reused across selections, so its state would otherwise persist).
    // Resetting during render — rather than in an effect — avoids a one-frame
    // flicker where the previous document's expanded state paints first.
    const fontsKey = missingFontFamilyList.join(' ');
    const [prevFontsKey, setPrevFontsKey] = useState(fontsKey);
    if (fontsKey !== prevFontsKey) {
        setPrevFontsKey(fontsKey);
        setIsExpanded(false);
    }
    if (missingFontFamilyList.length === 0) {
        return null;
    }
    // In the menu button's strip the first line keeps the button's height, so
    // the two read as one row; the strip is exactly a collapsed banner tall.
    let layoutClassName = `w-100 ${isExpanded ? 'py-2' : 'py-1'}`;
    if (menuRoom !== null) {
        layoutClassName = isExpanded ? 'pt-0 pb-2' : 'py-0';
    }
    return (
        <div
            className={`alert alert-warning px-3 mb-2 ${layoutClassName}`}
            style={
                menuRoom === null
                    ? undefined
                    : {
                          // Up into the strip, and short of the button.
                          marginTop: -menuRoom.height,
                          marginRight: menuRoom.width,
                      }
            }
            role="alert"
            title={missingFontFamilyList.join(', ')}
        >
            <div className="d-flex flex-wrap align-items-center gap-1">
                <button
                    type="button"
                    className="d-flex align-items-center flex-grow-1 text-start"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        padding: 0,
                    }}
                    aria-expanded={isExpanded}
                    onClick={() => {
                        setIsExpanded((prev) => !prev);
                    }}
                >
                    <i
                        className={
                            'bi me-1 ' +
                            (isExpanded
                                ? 'bi-chevron-down'
                                : 'bi-chevron-right')
                        }
                    />
                    <i className="bi bi-exclamation-triangle-fill me-1" />
                    <strong>
                        {tran('Missing fonts')} ({missingFontFamilyList.length})
                    </strong>
                </button>
                {refreshLabel && onRefresh ? (
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-warning py-0 text-nowrap"
                        onClick={onRefresh}
                    >
                        <i className="bi bi-arrow-clockwise me-1" />
                        {refreshLabel}
                    </button>
                ) : null}
            </div>
            {isExpanded ? (
                <>
                    <div className="mt-1">
                        {tran(
                            'these fonts are not installed on your system, ' +
                                'slides may not render as intended. ' +
                                'Click a font to search for it:',
                        )}
                    </div>
                    <div className="d-flex flex-wrap gap-1 mt-1">
                        {missingFontFamilyList.map((fontFamily) => {
                            return (
                                <button
                                    key={fontFamily}
                                    type="button"
                                    className={
                                        'badge rounded-pill text-bg-secondary ' +
                                        'border-0'
                                    }
                                    style={{ fontFamily, cursor: 'pointer' }}
                                    title={`${tran('Search for font')}: "${fontFamily}"`}
                                    onClick={() => {
                                        searchMissingFontFamily(fontFamily);
                                    }}
                                >
                                    <i className="bi bi-search me-1" />
                                    {fontFamily}
                                </button>
                            );
                        })}
                    </div>
                </>
            ) : null}
        </div>
    );
}
