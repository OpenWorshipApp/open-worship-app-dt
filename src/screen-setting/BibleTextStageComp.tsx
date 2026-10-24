import type { CSSProperties } from 'react';

import { tran } from '../lang/langHelpers';
import type { BibleBackdropType } from './bibleTextLookHelpers';

function BackdropButtonComp({
    isOn,
    iconClassName,
    label,
    title,
    onPick,
}: Readonly<{
    isOn: boolean;
    iconClassName: string;
    label: string;
    title: string;
    onPick: () => void;
}>) {
    return (
        <button
            type="button"
            className={isOn ? 'bible-style-backdrop-on' : undefined}
            aria-pressed={isOn}
            title={title}
            onClick={onPick}
        >
            <i className={iconClassName} aria-hidden="true" />
            <span>{label}</span>
        </button>
    );
}

/**
 * The verse as the screen will draw it, on the kind of background it is
 * going over.
 *
 * It is here because a look cannot be judged on the panel's own grey: the
 * presets for black words used to sit on the dark panel, where every one of
 * them was the same unreadable smudge. The switch is the old Reset White /
 * Reset Black pair, except that it carries the look across instead of
 * clearing it -- and the background it paints behind the sample is the whole
 * explanation of which side is which.
 */
export default function BibleTextStageComp({
    backdrop,
    sampleStyle,
    onBackdropChange,
}: Readonly<{
    backdrop: BibleBackdropType;
    sampleStyle: CSSProperties;
    onBackdropChange: (backdrop: BibleBackdropType) => void;
}>) {
    return (
        <div className={`bible-style-stage bible-style-on-${backdrop}`}>
            <p className="bible-style-verse" style={sampleStyle}>
                <span className="bible-style-verse-number">16</span>
                {tran(
                    'For God so loved the world, ' +
                        'that he gave his only begotten Son',
                )}
            </p>
            <div
                className="bible-style-backdrop"
                role="group"
                aria-label={tran('Background')}
            >
                <BackdropButtonComp
                    isOn={backdrop === 'dark'}
                    iconClassName="bi bi-moon-stars-fill"
                    label={tran('Dark')}
                    title={tran('Light words for a dark background')}
                    onPick={() => {
                        onBackdropChange('dark');
                    }}
                />
                <BackdropButtonComp
                    isOn={backdrop === 'light'}
                    iconClassName="bi bi-sun-fill"
                    label={tran('Light')}
                    title={tran('Dark words for a light background')}
                    onPick={() => {
                        onBackdropChange('light');
                    }}
                />
            </div>
        </div>
    );
}
