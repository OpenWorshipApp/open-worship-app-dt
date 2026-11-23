import { type CSSProperties, useState } from 'react';

import { getSetting, setSetting } from '../helper/settingHelpers';
import { tran } from '../lang/langHelpers';
import { genBibleTextHighlightBackground } from '../_screen/bibleTextStyleHelpers';
import type { BibleBackdropType } from './bibleTextLookHelpers';

// Beside `screen-bible--style-presets`: the panel's own, not a screen's.
export const BIBLE_TEXT_STAGE_FOLDED_SETTING_NAME =
    'screen-bible--style-stage-folded';

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
 * The stage's fold: on its last line, beside the switch, so it costs the
 * stage no height of its own. Folded, its name says what is folded away,
 * since the line is all that is left of it.
 */
function StageFoldComp({
    isFolded,
    onToggle,
}: Readonly<{ isFolded: boolean; onToggle: () => void }>) {
    const name = tran('Preview');
    const label = `${isFolded ? tran('Expand') : tran('Collapse')}: ${name}`;
    return (
        <button
            type="button"
            className="bible-style-stage-fold"
            aria-expanded={!isFolded}
            aria-label={label}
            title={label}
            onClick={onToggle}
        >
            <i
                className={`bi bi-chevron-${isFolded ? 'right' : 'down'}`}
                aria-hidden="true"
            />
            {isFolded ? <span>{name}</span> : null}
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
 *
 * It folds to its last line (2026-11-19, the user: _make it collapsible_),
 * for a short panel whose rows matter more than the sample: the verse is
 * unmounted, and the switch stays -- it changes the words' colour, so it is
 * a control and not only a view. Remembered, as the panel is reopened often.
 */
export default function BibleTextStageComp({
    backdrop,
    sampleStyle,
    highlightColor,
    onBackdropChange,
}: Readonly<{
    backdrop: BibleBackdropType;
    sampleStyle: CSSProperties;
    // The selection band of this side, drawn under the sample as it is under
    // a selected verse on a screen.
    highlightColor: string;
    onBackdropChange: (backdrop: BibleBackdropType) => void;
}>) {
    // Read once, when the panel opens: there is only ever one of it.
    const [isFolded, setIsFolded] = useState(() => {
        return getSetting(BIBLE_TEXT_STAGE_FOLDED_SETTING_NAME) === 'true';
    });
    const handleFoldToggle = () => {
        const newIsFolded = !isFolded;
        setIsFolded(newIsFolded);
        setSetting(BIBLE_TEXT_STAGE_FOLDED_SETTING_NAME, `${newIsFolded}`);
    };
    return (
        <div
            className={
                `bible-style-stage bible-style-on-${backdrop}` +
                (isFolded ? ' bible-style-stage-folded' : '')
            }
        >
            {isFolded ? null : (
                <p className="bible-style-verse" style={sampleStyle}>
                    <span
                        className="bible-style-verse-highlight"
                        style={{
                            background:
                                genBibleTextHighlightBackground(highlightColor),
                        }}
                    >
                        <span className="bible-style-verse-number">16</span>
                        {tran(
                            'For God so loved the world, ' +
                                'that he gave his only begotten Son',
                        )}
                    </span>
                </p>
            )}
            <div className="bible-style-stage-foot">
                <StageFoldComp
                    isFolded={isFolded}
                    onToggle={handleFoldToggle}
                />
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
        </div>
    );
}
