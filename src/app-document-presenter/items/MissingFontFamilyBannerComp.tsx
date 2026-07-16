import { useState } from 'react';

import { tran } from '../../lang/langHelpers';
import { searchMissingFontFamily } from '../../server/fontHelpers';

export default function MissingFontFamilyBannerComp({
    missingFontFamilyList,
}: Readonly<{
    missingFontFamilyList: string[];
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
    return (
        <div
            className={
                'w-100 alert alert-warning px-3 mb-2 ' +
                (isExpanded ? 'py-2' : 'py-1')
            }
            role="alert"
            title={missingFontFamilyList.join(', ')}
        >
            <button
                type="button"
                className="d-flex align-items-center w-100 text-start"
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
                        (isExpanded ? 'bi-chevron-down' : 'bi-chevron-right')
                    }
                />
                <i className="bi bi-exclamation-triangle-fill me-1" />
                <strong>
                    {tran('Missing fonts')} ({missingFontFamilyList.length})
                </strong>
            </button>
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
