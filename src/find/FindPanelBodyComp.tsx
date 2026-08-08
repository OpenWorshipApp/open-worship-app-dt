import type {
    ChangeEvent,
    KeyboardEvent,
    PointerEvent,
    RefObject,
} from 'react';

import { tran } from '../lang/langHelpers';

// Bootstrap-icons paths, inlined as SVG on purpose: the bar renders in its own
// tiny `WebContentsView` page, and pulling the whole icon font into a second
// web contents just for five glyphs is exactly the kind of weight this app
// cannot afford.
const ICON_PATHS = {
    chevronUp:
        'M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.' +
        '646 5.647a.5.5 0 0 1-.708-.708z',
    chevronDown:
        'M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .70' +
        '8.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708',
    matchCase:
        'm2.244 13.081.943-2.803H6.66l.944 2.803H8.86L5.54 3.75H4.322L1 13.' +
        '081zm2.7-7.923L6.34 9.314H3.51l1.4-4.156zm9.146 7.027h.035v.896h1.' +
        '128V8.125c0-1.51-1.114-2.345-2.646-2.345-1.736 0-2.59.916-2.666 2.' +
        '174h1.108c.068-.718.595-1.19 1.517-1.19.971 0 1.518.52 1.518 1.464' +
        'v.731H12.19c-1.647.007-2.522.8-2.522 2.058 0 1.319.957 2.18 2.345 ' +
        '2.18 1.06 0 1.716-.43 2.078-1.011zm-1.763.035c-.752 0-1.456-.397-1' +
        '.456-1.244 0-.65.424-1.115 1.408-1.115h1.805v.834c0 .896-.752 1.52' +
        '5-1.757 1.525',
    close:
        'M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .' +
        '708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.1' +
        '47a.5.5 0 0 1-.708-.708L7.293 8z',
    grip:
        'M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0M7' +
        ' 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0M7 8' +
        'a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m-3 3a' +
        '1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m-3 3a1' +
        ' 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0',
};

function IconComp({ path }: Readonly<{ path: string }>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            viewBox="0 0 16 16"
            aria-hidden="true"
            focusable="false"
        >
            <path fillRule="evenodd" d={path} />
        </svg>
    );
}

export default function FindPanelBodyComp({
    inputRef,
    queryText,
    isMatchCase,
    matchCount,
    activeMatchOrdinal,
    onQueryChanging,
    onKeyDowning,
    onPreviousClicking,
    onNextClicking,
    onMatchCaseToggling,
    onClosing,
    onGripPointerDowning,
    onGripPointerUping,
}: Readonly<{
    inputRef: RefObject<HTMLInputElement | null>;
    queryText: string;
    isMatchCase: boolean;
    matchCount: number;
    activeMatchOrdinal: number;
    onQueryChanging: (event: ChangeEvent<HTMLInputElement>) => void;
    onKeyDowning: (event: KeyboardEvent<HTMLDivElement>) => void;
    onPreviousClicking: () => void;
    onNextClicking: () => void;
    onMatchCaseToggling: () => void;
    onClosing: () => void;
    onGripPointerDowning: (event: PointerEvent<HTMLElement>) => void;
    onGripPointerUping: (event: PointerEvent<HTMLElement>) => void;
}>) {
    return (
        <div className="app-find-panel" onKeyDown={onKeyDowning}>
            <div
                className="app-find-panel-grip"
                title={tran('Drag to move the find panel')}
                aria-label={tran('Drag to move the find panel')}
                onPointerDown={onGripPointerDowning}
                onPointerUp={onGripPointerUping}
                onPointerCancel={onGripPointerUping}
            >
                <IconComp path={ICON_PATHS.grip} />
            </div>
            <input
                ref={inputRef}
                className="app-find-panel-query"
                type="text"
                autoFocus
                spellCheck={false}
                placeholder={tran('Find')}
                aria-label={tran('Find')}
                value={queryText}
                onChange={onQueryChanging}
            />
            <input
                className="app-find-panel-count"
                type="text"
                readOnly
                tabIndex={-1}
                aria-live="polite"
                aria-label={tran('Match count')}
                value={queryText ? `${activeMatchOrdinal}/${matchCount}` : ''}
            />
            <div className="app-find-panel-separator" />
            <button
                className="app-find-panel-button"
                type="button"
                disabled={matchCount === 0}
                title={tran('Previous match')}
                aria-label={tran('Previous match')}
                onClick={onPreviousClicking}
            >
                <IconComp path={ICON_PATHS.chevronUp} />
            </button>
            <button
                className="app-find-panel-button"
                type="button"
                disabled={matchCount === 0}
                title={tran('Next match')}
                aria-label={tran('Next match')}
                onClick={onNextClicking}
            >
                <IconComp path={ICON_PATHS.chevronDown} />
            </button>
            <button
                className={
                    'app-find-panel-button' + (isMatchCase ? ' is-active' : '')
                }
                type="button"
                aria-pressed={isMatchCase}
                title={tran('Match case')}
                aria-label={tran('Match case')}
                onClick={onMatchCaseToggling}
            >
                <IconComp path={ICON_PATHS.matchCase} />
            </button>
            <div className="app-find-panel-separator" />
            <button
                className="app-find-panel-button"
                type="button"
                title={tran('Close find')}
                aria-label={tran('Close find')}
                onClick={onClosing}
            >
                <IconComp path={ICON_PATHS.close} />
            </button>
        </div>
    );
}
