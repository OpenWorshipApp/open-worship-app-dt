import type { CSSProperties, MouseEvent } from 'react';

import type { BibleBackdropType } from './bibleTextLookHelpers';

/**
 * One look, drawn as itself: two letters wearing it on the kind of background
 * it is meant for, and its name under them. The app's own looks and the ones
 * somebody saved are the same tile -- a saved one only adds a menu.
 */
export default function BibleTextLookTileComp({
    label,
    sample,
    sampleStyle,
    backdrop,
    isOn,
    onPick,
    onMenuOpening,
}: Readonly<{
    label: string;
    sample: string;
    sampleStyle: CSSProperties;
    backdrop: BibleBackdropType;
    isOn: boolean;
    onPick: () => void;
    /** Only a saved preset has one: rename, replace, remove. */
    onMenuOpening?: (event: MouseEvent) => void;
}>) {
    return (
        <button
            type="button"
            className={
                'bible-style-look' + (isOn ? ' bible-style-look-on' : '')
            }
            aria-pressed={isOn}
            title={label}
            onClick={onPick}
            onContextMenu={onMenuOpening}
        >
            <span
                className={
                    'bible-style-look-sample ' + `bible-style-on-${backdrop}`
                }
                style={sampleStyle}
                aria-hidden="true"
            >
                {sample}
                {/* Only on the one that is on, as the session chips do it:
                    rename and remove are done to the look you are wearing,
                    and a column of dots on every tile is noise. Right-click
                    opens the same menu on any of them. */}
                {isOn && onMenuOpening !== undefined ? (
                    <i
                        className={
                            'bi bi-three-dots-vertical bible-style-look-menu'
                        }
                        onClick={(event) => {
                            event.stopPropagation();
                            onMenuOpening(event);
                        }}
                    />
                ) : null}
            </span>
            <span className="bible-style-look-name">{label}</span>
        </button>
    );
}
