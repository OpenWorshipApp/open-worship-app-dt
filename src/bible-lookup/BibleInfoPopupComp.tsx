import '../popup-widget/popupWidget.scss';

import { Fragment, useCallback, type MouseEvent } from 'react';

import appProvider from '../server/appProvider';
import { ModalComp } from '../app-modal/ModalComp';
import HeaderAlertPopupComp from '../popup-widget/HeaderAlertPopupComp';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import { getLanguageTitle, tran } from '../lang/langHelpers';
import { useAppStateAsync } from '../helper/appHooks';
import type { BibleInfoType } from '../helper/bible-helpers/BibleDataReader';
import { getBibleInfo } from '../helper/bible-helpers/bibleInfoHelpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';
import { splitTextByUrl } from '../helper/urlTextHelpers';

type InfoRowType = {
    label: string;
    value: string;
    // Numeric readouts take tabular figures and stay in the app font; only the
    // bible's own text is rendered in the bible's font.
    isData?: boolean;
};

function toInfoRows(bibleInfo: BibleInfoType): InfoRowType[] {
    return [
        { label: 'Title', value: bibleInfo.title },
        { label: 'Key', value: bibleInfo.key },
        { label: 'Version', value: `${bibleInfo.version ?? ''}`, isData: true },
        {
            label: 'Locale',
            value: bibleInfo.locale
                ? `${getLanguageTitle({ locale: bibleInfo.locale })}` +
                  ` (${bibleInfo.locale})`
                : '',
        },
        { label: 'Publisher', value: bibleInfo.publisher },
        { label: 'Copy Rights', value: bibleInfo.copyRights },
        { label: 'Legal Note', value: bibleInfo.legalNote },
        { label: 'Description', value: bibleInfo.description },
        {
            label: 'Books',
            value: `${bibleInfo.booksAvailable?.length ?? 0}`,
            isData: true,
        },
    ].filter((row) => {
        return !!row.value;
    });
}

function RenderInfoValueComp({ value }: Readonly<{ value: string }>) {
    const handleLinkClicking = useCallback(
        (event: MouseEvent<HTMLAnchorElement>) => {
            // Keep the renderer on the app's own page. Electron would catch a
            // stray navigation anyway (`will-navigate` on the main window, the
            // window-open handler on a ctrl/middle click), but the presenter's
            // lookup popup and the reader are not always that window.
            event.preventDefault();
            appProvider.browserUtils.openExternalURL(event.currentTarget.href);
        },
        [],
    );
    // Bible copyright / legal-note fields routinely carry the publisher's site
    // as bare text. Only the detected URL runs become anchors — the rest stays
    // a plain text node, so nothing from the bible file is ever injected as
    // markup (`sanitizeHtml` is still a no-op placeholder).
    return splitTextByUrl(value).map((segment, index) => {
        if (segment.url === null) {
            return <Fragment key={index}>{segment.text}</Fragment>;
        }
        return (
            <a
                key={index}
                href={segment.url}
                title={segment.url}
                // Without this, dragging across a link starts a link-drag
                // instead of selecting the copyright text to copy.
                draggable={false}
                onClick={handleLinkClicking}
            >
                {segment.text}
            </a>
        );
    });
}

function RenderInfoRowComp({
    row,
    fontFamily,
}: Readonly<{ row: InfoRowType; fontFamily?: string }>) {
    // Two grid cells rather than a flex row: the labels then share one column
    // width, so the values stay aligned whatever the UI language makes the
    // longest label (the Khmer ones are far wider than the English).
    return (
        <>
            <div className="text-muted">{tran(row.label)}</div>
            <div
                className={row.isData ? 'app-data' : undefined}
                style={{
                    wordBreak: 'break-word',
                    fontFamily: row.isData ? undefined : fontFamily,
                }}
            >
                <RenderInfoValueComp value={row.value} />
            </div>
        </>
    );
}

function RenderBodyComp({ bibleKey }: Readonly<{ bibleKey: string }>) {
    // `getBibleInfo` is metadata only (a few KB, 60s cached and frozen) and
    // never touches verse text. Do NOT reach for the settings' `getBibleXMLInfo`
    // here: it reads and DOM-parses the whole bible XML, and returns null for
    // downloaded bibles.
    const [bibleInfo] = useAppStateAsync(() => {
        return getBibleInfo(bibleKey);
    }, [bibleKey]);
    const fontFamily = useBibleFontFamily(bibleKey);
    if (bibleInfo === undefined) {
        return <div>{tran('Loading')}...</div>;
    }
    if (bibleInfo === null) {
        return <div>{tran('No Data')}</div>;
    }
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'max-content minmax(0, 1fr)',
                columnGap: '12px',
                rowGap: '6px',
            }}
        >
            {toInfoRows(bibleInfo).map((row) => {
                return (
                    <RenderInfoRowComp
                        key={row.label}
                        row={row}
                        fontFamily={fontFamily}
                    />
                );
            })}
        </div>
    );
}

export default function BibleInfoPopupComp({
    bibleKey,
    close,
}: Readonly<{ bibleKey: string; close: () => void }>) {
    // Listeners run last-registered-first and stop at `defaultPrevented`, so
    // preventing here keeps Escape from also jumping focus back to the lookup
    // input underneath. `ModalCloseButtonComp` is deliberately not used: it
    // binds Ctrl+Q, which would additionally close the bible lookup popup this
    // one can be opened from.
    useKeyboardRegistering(
        [{ key: 'Escape' }],
        (event) => {
            event.preventDefault();
            close();
        },
        [],
    );
    const title = tran('Bible Information');
    return (
        <ModalComp>
            <div
                className="app-popup-widget card"
                style={{
                    width: 'min(560px, calc(100vw - 20px))',
                    maxHeight: 'calc(100vh - 20px)',
                }}
            >
                <HeaderAlertPopupComp
                    title={title}
                    header={
                        <>
                            <i className="app-popup-header-icon icon-info bi bi-info-circle-fill" />
                            {title}
                        </>
                    }
                    onClose={close}
                />
                <div className="app-popup-body app-selectable-text">
                    <RenderBodyComp bibleKey={bibleKey} />
                </div>
            </div>
        </ModalComp>
    );
}
