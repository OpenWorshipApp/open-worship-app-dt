import type { CSSProperties, ReactNode } from 'react';

/**
 * One line of the control strip: `[icon] [name] ....... [control]`.
 *
 * No border and no background. Nine bordered pills -- four of them with a
 * SECOND pill inside for the slider -- is what made this panel five rows tall
 * in a floating window whose other job is showing a file grid. The rows line
 * their controls up on one right edge instead, and alignment does the work the
 * borders were doing.
 *
 * `isEngaged` lights the name: a control sitting at its default stays quiet, a
 * control actually doing something is the one the eye should find.
 *
 * It lives in its own file rather than beside the panel that uses it most
 * because the common-style controls need it too, and those are imported BY
 * that panel -- taking it from there would close an import cycle.
 */
export default function PropRowComp({
    iconClassName,
    label,
    isEngaged,
    title,
    children,
}: Readonly<{
    iconClassName: string;
    label: string;
    isEngaged?: boolean;
    title?: string;
    children: ReactNode;
}>) {
    return (
        <div
            className={'fg-prop' + (isEngaged ? ' fg-prop-engaged' : '')}
            title={title}
        >
            <span className="fg-prop-name">
                <i className={iconClassName} />
                <span>{label}</span>
            </span>
            <span className="fg-prop-control">{children}</span>
        </div>
    );
}

/**
 * The handful of values worth one press, as a segmented strip.
 *
 * The marquee's font size and scroll speed each had a full-width Bootstrap
 * `btn-group` on a line of its own UNDER the box it belonged to -- two
 * controls answering one question, 100px apart, and about 190px of panel
 * height for the pair. They are the same question, so they share the row: the
 * presets set it in one press, the box beside them takes anything else.
 *
 * `zeroLabel` is for the marquee's `0`, which does not mean zero -- it means
 * "work it out from the screen". A preset button reading `0` said the wrong
 * thing in the one place a volunteer is most likely to press it.
 */
export function PropChipsComp({
    label,
    values,
    value,
    setValue,
    zeroLabel,
}: Readonly<{
    label: string;
    values: readonly number[];
    value: number;
    setValue: (value: number) => void;
    zeroLabel?: string;
}>) {
    return (
        <span className="fg-chips" role="group" aria-label={label}>
            {values.map((item) => {
                const itemLabel =
                    item === 0 && zeroLabel !== undefined
                        ? zeroLabel
                        : item.toString();
                return (
                    <button
                        key={item}
                        type="button"
                        className={value === item ? 'fg-chip-on' : undefined}
                        aria-pressed={value === item}
                        title={`${label}: ${itemLabel}`}
                        onClick={() => {
                            setValue(item);
                        }}
                    >
                        {itemLabel}
                    </button>
                );
            })}
        </span>
    );
}

export type PropOptionType<T extends string> = {
    value: T;
    label: string;
    /** Drawn INSTEAD of the label when the shape says it better than a word. */
    iconClassName?: string;
    /** ...and this instead of either, for a style that IS its own picture. */
    previewStyle?: CSSProperties;
};

/**
 * The same segmented strip as `PropChipsComp`, for a choice made of WORDS
 * rather than of numbers -- a border style, a shadow preset, an alignment.
 *
 * Kept beside it rather than folded into it because the two differ in what
 * the button says: a number says itself, while `dashed` has to be shown as a
 * dashed line, `center` as the centring glyph, and `none` as neither. The
 * chosen value is always ONE of the buttons, so a volunteer never has to read
 * a `select` to find out what the widget is doing.
 */
export function PropOptionsComp<T extends string>({
    label,
    options,
    value,
    setValue,
}: Readonly<{
    label: string;
    options: readonly PropOptionType<T>[];
    value: T;
    setValue: (value: T) => void;
}>) {
    return (
        <span className="fg-chips" role="group" aria-label={label}>
            {options.map((option) => {
                const isOn = value === option.value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        className={isOn ? 'fg-chip-on' : undefined}
                        aria-pressed={isOn}
                        // The words are what an assistant and a screen reader
                        // aim at, so every button carries them even where the
                        // face of it is a line or a glyph.
                        title={`${label}: ${option.label}`}
                        aria-label={option.label}
                        onClick={() => {
                            setValue(option.value);
                        }}
                    >
                        {option.previewStyle !== undefined ? (
                            <span
                                className="fg-chip-preview"
                                style={option.previewStyle}
                                aria-hidden="true"
                            />
                        ) : option.iconClassName !== undefined ? (
                            <i
                                className={option.iconClassName}
                                aria-hidden="true"
                            />
                        ) : (
                            option.label
                        )}
                    </button>
                );
            })}
        </span>
    );
}

/**
 * Several independent on/off answers in the width of one row -- italic,
 * underline, UPPERCASE.
 *
 * Three checkboxes with three names would be three rows for three questions a
 * volunteer answers by looking at the result, not by reading a label. Each
 * button shows what it does to the letters it is drawn with, so the strip is
 * legible in a Khmer window where none of the three words is.
 */
export function PropTogglesComp({
    label,
    items,
}: Readonly<{
    label: string;
    items: readonly {
        key: string;
        label: string;
        iconClassName?: string;
        /** Shown on the button when no icon says it; the label stays the name. */
        text?: string;
        style?: CSSProperties;
        isOn: boolean;
        onToggle: () => void;
    }[];
}>) {
    return (
        <span className="fg-chips" role="group" aria-label={label}>
            {items.map((item) => {
                return (
                    <button
                        key={item.key}
                        type="button"
                        className={item.isOn ? 'fg-chip-on' : undefined}
                        aria-pressed={item.isOn}
                        title={item.label}
                        aria-label={item.label}
                        onClick={item.onToggle}
                    >
                        {item.iconClassName !== undefined ? (
                            <i
                                className={item.iconClassName}
                                aria-hidden="true"
                            />
                        ) : (
                            <span style={item.style} aria-hidden="true">
                                {item.text ?? item.label}
                            </span>
                        )}
                    </button>
                );
            })}
        </span>
    );
}

/**
 * A colour, shown rather than named.
 *
 * The two colours used to be collapsible cards whose closed state was a word
 * and a tinted glyph -- so the panel spent two rows saying "Text Color:" and
 * "Background Color:" without either of them showing what the colour actually
 * was. A swatch IS the value, and the checkerboard under it is why: the
 * default background is `#000080AA`, and a translucent navy painted on an
 * opaque chip reads as a solid one.
 */
export function PropSwatchComp({
    label,
    color,
    isOpened,
    isText,
    onToggle,
}: Readonly<{
    label: string;
    color: string;
    isOpened: boolean;
    isText?: boolean;
    onToggle: () => void;
}>) {
    return (
        <button
            type="button"
            className={'fg-swatch' + (isOpened ? ' fg-swatch-on' : '')}
            title={label}
            aria-label={label}
            aria-expanded={isOpened}
            onClick={onToggle}
        >
            {isText ? (
                // One shows a glyph, the other shows a fill, so the two are
                // told apart without reading either tooltip. A glyph rather
                // than a letter: this strip is drawn in Khmer as often as in
                // English, and an `A` is a word in neither.
                <i
                    className="bi bi-fonts fg-swatch-glyph"
                    style={{ color }}
                    aria-hidden="true"
                />
            ) : (
                <span
                    className="fg-swatch-fill"
                    style={{ background: color }}
                />
            )}
        </button>
    );
}
