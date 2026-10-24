import type { ChangeEvent, MouseEvent } from 'react';
import { useCallback, useId, useState } from 'react';

import { tran } from '../lang/langHelpers';
import {
    transitionEffect,
    type TransitionEffectType,
} from '../_screen/transitionEffectHelpers';
import { TRANSITION_EFFECT_LIST } from '../_screen/transitionOverrideHelpers';
import { showAppInput } from '../popup-widget/popupWidgetHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

/**
 * The screen's own Tr: menu shows these as bare identifiers because it is a
 * developer-facing row; everywhere a volunteer chooses one, it says what each
 * one DOES. Written as literals so `tranKeyCoverage.test.ts` can read them.
 */
export const TRANSITION_LABEL_MAP: Record<string, string> = {
    none: 'No Transition',
    fade: 'Fade',
    move: 'Slide In',
    zoom: 'Zoom',
};

/**
 * What an item falls back to while its own transition is off: the effect
 * (`null` when it is not one answer -- screens that disagree) and where it
 * comes from, both already in words for the person reading it.
 */
export type TransitionInheritedType = {
    effect: TransitionEffectType | null;
    sourceLabel: string;
};

export function getTransitionIconName(effect: TransitionEffectType | null) {
    return transitionEffect[effect ?? 'fade'][0].replace('bi bi-', '');
}

export function toTransitionLabel(effect: TransitionEffectType | null) {
    if (effect === null) {
        return tran('Varies by screen');
    }
    return tran(TRANSITION_LABEL_MAP[effect]);
}

/**
 * The override control every level shares: a checkbox saying whether this
 * item has its OWN transition, and icon buttons for each effect. Unticked, the
 * buttons are disabled and show what the item follows, so the checkbox never hides
 * what will actually happen; ticking it starts from that same effect.
 *
 * Controlled: `value` present means ticked.
 */
export default function TransitionOverrideComp({
    value,
    inherited,
    onChange,
    choicesClassName = '',
    isCompact = false,
}: Readonly<{
    value: TransitionEffectType | undefined;
    inherited: TransitionInheritedType;
    onChange: (value: TransitionEffectType | undefined) => void;
    choicesClassName?: string;
    /**
     * For a row too narrow for the "Follows: …" line; the row says it in its
     * own tooltip instead.
     */
    isCompact?: boolean;
}>) {
    const checkboxId = useId();
    const isEnabled = value !== undefined;
    const inheritedRef = useAppCurrentRef(inherited);
    const valueRef = useAppCurrentRef(value);
    const onChangeRef = useAppCurrentRef(onChange);
    const handleToggling = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            onChangeRef.current(
                event.target.checked
                    ? (inheritedRef.current.effect ?? 'fade')
                    : undefined,
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleChoosing = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            if (valueRef.current === undefined) {
                return;
            }
            onChangeRef.current(
                event.currentTarget.value as TransitionEffectType,
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const label = tran('Transition');
    return (
        <span className="d-inline-flex align-items-center flex-wrap gap-1">
            <span className="form-check mb-0 me-1">
                <input
                    id={checkboxId}
                    className="form-check-input"
                    type="checkbox"
                    checked={isEnabled}
                    onChange={handleToggling}
                />
                <label className="form-check-label" htmlFor={checkboxId}>
                    {tran('Own transition')}
                </label>
            </span>
            {!isEnabled && inherited.effect === null ? (
                <span
                    className="d-inline-flex align-items-center px-1 text-muted"
                    title={toTransitionLabel(null)}
                    aria-label={toTransitionLabel(null)}
                >
                    <i className="bi bi-question-circle" aria-hidden="true" />
                </span>
            ) : null}
            <span
                className={`btn-group ${choicesClassName}`}
                role="group"
                aria-label={label}
                title={
                    isEnabled
                        ? label
                        : `${tran('Follows')}: ${inherited.sourceLabel} (${toTransitionLabel(inherited.effect)})`
                }
            >
                {TRANSITION_EFFECT_LIST.map((effect) => {
                    const isSelected =
                        effect === (isEnabled ? value : inherited.effect);
                    const effectLabel = toTransitionLabel(effect);
                    return (
                        <button
                            key={effect}
                            type="button"
                            className={`btn btn-sm ${isSelected ? 'btn-info' : 'btn-outline-info'}`}
                            style={{ minWidth: '1.5rem' }}
                            value={effect}
                            disabled={!isEnabled}
                            aria-pressed={isSelected}
                            aria-label={effectLabel}
                            title={effectLabel}
                            onClick={handleChoosing}
                        >
                            <i
                                className={`bi bi-${getTransitionIconName(effect)}`}
                                aria-hidden="true"
                            />
                        </button>
                    );
                })}
            </span>
            {isEnabled || isCompact ? null : (
                <small className="text-muted">
                    {tran('Follows')}: {inherited.sourceLabel}
                </small>
            )}
        </span>
    );
}

function TransitionOverrideDialogBodyComp({
    initialValue,
    inherited,
    description,
    onChange,
}: Readonly<{
    initialValue: TransitionEffectType | undefined;
    inherited: TransitionInheritedType;
    description?: string;
    onChange: (value: TransitionEffectType | undefined) => void;
}>) {
    const [value, setValue] = useState(initialValue);
    const onChangeRef = useAppCurrentRef(onChange);
    const handleChange = useCallback(
        (newValue: TransitionEffectType | undefined) => {
            setValue(newValue);
            onChangeRef.current(newValue);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <div className="d-flex flex-column gap-2 p-2">
            {description ? (
                <small className="text-muted">{description}</small>
            ) : null}
            <TransitionOverrideComp
                value={value}
                inherited={inherited}
                onChange={handleChange}
            />
        </div>
    );
}

/**
 * Asks for a slides preview's, a slide's, a Background tab's or one
 * background's own transition. Resolves `null` when nothing should change
 * (Cancel, or a window with no popup host), otherwise `{ value }` --
 * `value` absent meaning the checkbox was left unticked.
 */
export async function showTransitionOverrideDialog({
    title,
    value,
    inherited,
    description,
}: {
    title: string;
    value: TransitionEffectType | undefined;
    inherited: TransitionInheritedType;
    description?: string;
}): Promise<{ value?: TransitionEffectType } | null> {
    let chosen = value;
    const isOk = await showAppInput(
        title,
        <TransitionOverrideDialogBodyComp
            initialValue={value}
            inherited={inherited}
            description={description}
            onChange={(newValue) => {
                chosen = newValue;
            }}
        />,
        { escToCancel: true, enterToOk: true },
    );
    if (!isOk) {
        return null;
    }
    return chosen === undefined ? {} : { value: chosen };
}

/**
 * The `Transition: …` row of a context menu, saying what the item does now:
 * its own effect, or what it follows. `title` stays the bare word so the row
 * answers to it.
 */
export function genTransitionMenuItem({
    value,
    inherited,
    onSelect,
}: {
    value: TransitionEffectType | undefined;
    inherited: TransitionInheritedType;
    onSelect: () => void;
}): ContextMenuItemType {
    const effect = value ?? inherited.effect;
    const state =
        value === undefined
            ? `${toTransitionLabel(inherited.effect)} (${inherited.sourceLabel})`
            : toTransitionLabel(value);
    return {
        childBefore: genContextMenuItemIcon(
            getTransitionIconName(effect),
            value === undefined
                ? undefined
                : { color: 'var(--bs-warning-text-emphasis)' },
        ),
        menuElement: `${tran('Transition')}: ${state}`,
        title: tran('Transition'),
        onSelect,
    };
}
