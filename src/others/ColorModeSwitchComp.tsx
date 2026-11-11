import './PresetsRowComp.scss';

import type { MouseEvent } from 'react';

import { tran } from '../lang/langHelpers';
import type { ColorModeType } from './color/colorContrastHelpers';

function ColorModeButtonComp({
    isOn,
    iconClassName,
    label,
    title,
    onPick,
    onButtonMouseDown,
}: Readonly<{
    isOn: boolean;
    iconClassName: string;
    label: string;
    title: string;
    onPick: () => void;
    onButtonMouseDown?: (event: MouseEvent) => void;
}>) {
    return (
        <button
            type="button"
            className={isOn ? 'app-presets-mode-on' : undefined}
            aria-pressed={isOn}
            title={title}
            onMouseDown={onButtonMouseDown}
            onClick={onPick}
        >
            <i className={iconClassName} aria-hidden="true" />
            <span>{label}</span>
        </button>
    );
}

/**
 * Dark / Light beside a Presets row's name, where the panel has words over a
 * box: which side of the slide they are for. The side is the panel's to read
 * (off the words' colour, never stored); a press asks for the other one, and
 * the panel makes its colours contrast (`genContrastColors`).
 */
export default function ColorModeSwitchComp({
    mode,
    onChange,
    onButtonMouseDown,
}: Readonly<{
    mode: ColorModeType;
    onChange: (mode: ColorModeType) => void;
    onButtonMouseDown?: (event: MouseEvent) => void;
}>) {
    return (
        <div
            className="app-presets-mode"
            role="group"
            aria-label={tran('Background')}
        >
            <ColorModeButtonComp
                isOn={mode === 'dark'}
                iconClassName="bi bi-moon-stars-fill"
                label={tran('Dark')}
                title={tran('Light words for a dark background')}
                onPick={() => {
                    onChange('dark');
                }}
                onButtonMouseDown={onButtonMouseDown}
            />
            <ColorModeButtonComp
                isOn={mode === 'light'}
                iconClassName="bi bi-sun-fill"
                label={tran('Light')}
                title={tran('Dark words for a light background')}
                onPick={() => {
                    onChange('light');
                }}
                onButtonMouseDown={onButtonMouseDown}
            />
        </div>
    );
}
