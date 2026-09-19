import { useCallback, useState, type ChangeEvent } from 'react';

import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import { showAppInput } from '../popup-widget/popupWidgetHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { ActionScreenIdsInputComp } from './presentingFlowActionArmingHelpers';
import type {
    PresentingFlowMediaControlModeType,
    PresentingFlowMediaControlPauseKindType,
    PresentingFlowMediaControlType,
} from './presentingFlowMediaControlHelpers';
import {
    presentingFlowMediaControlModeLabelMap,
    presentingFlowMediaControlModeList,
    toPresentingFlowMediaControlPauseKind,
} from './presentingFlowMediaControlHelpers';

/**
 * The settings panel of a `Slide: Media Control` — asked when one is attached to a
 * slide, and reopened from the gear on its CC row.
 *
 * Six answers rather than the one every other action asks for, so it is its own
 * module and its own component; the shape is still the arming dialog's
 * (`showAppInput` resolves Ok/Cancel only, the live value goes back through a
 * closure the caller owns) and the screens field is literally that dialog's, so a
 * screen row only ever has to be styled once.
 */

const MEDIA_CONTROL_TITLE = 'Slide: Media Control';

/**
 * The speeds worth offering, as a select rather than a free number: an operator
 * mid-service wants "half" or "double", and a free field is where `0.0001` comes
 * from. The stored value is a plain number all the same, so a hand-edited config
 * asking for 1.7 still runs.
 */
const SPEED_LIST = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

const DEFAULT_VOLUME = 100;

/** What the form holds while it is open — every field as the text of its input. */
type MediaControlFormType = {
    mode: PresentingFlowMediaControlModeType;
    delaySecond: string;
    startAtSecond: string;
    pauseKind: PresentingFlowMediaControlPauseKindType;
    pauseSecond: string;
    isVolumeSet: boolean;
    volume: string;
    isSpeedSet: boolean;
    speed: string;
};

function toFormValue(
    config: PresentingFlowMediaControlType | null,
): MediaControlFormType {
    const pauseKind = toPresentingFlowMediaControlPauseKind(config);
    const pauseSecond =
        pauseKind === 'at' ? config?.pauseAtSecond : config?.pauseAfterSecond;
    return {
        mode: config?.mode ?? 'play',
        delaySecond: `${config?.delaySecond ?? 0}`,
        startAtSecond: `${config?.startAtSecond ?? 0}`,
        pauseKind,
        pauseSecond: `${pauseSecond ?? 0}`,
        // A checkbox per optional field, because "not set" is a real answer and a
        // different one from any number: leaving the volume alone is what lets a
        // controller start a video without undoing the level the operator set on
        // the mini screen by hand.
        isVolumeSet: config?.volume !== undefined,
        volume: `${config?.volume ?? DEFAULT_VOLUME}`,
        isSpeedSet: config?.speed !== undefined,
        speed: `${config?.speed ?? 1}`,
    };
}

/**
 * The form read back as a config, or a `tran` key saying what is wrong.
 *
 * Zero is dropped rather than stored for the three second fields: "start at 0" and
 * "no delay" are the same instruction as saying nothing, and an absent field is
 * what every other presenting flow value means by a default.
 */
function toMediaControlConfig(
    form: MediaControlFormType,
): PresentingFlowMediaControlType | string {
    const config: PresentingFlowMediaControlType = { mode: form.mode };
    const readSecond = (text: string) => {
        const value = parseFloat(text);
        if (text.trim() === '' || !Number.isFinite(value) || value < 0) {
            return null;
        }
        return value;
    };
    const delaySecond = readSecond(form.delaySecond);
    const startAtSecond = readSecond(form.startAtSecond);
    if (delaySecond === null || startAtSecond === null) {
        return 'Please enter a number that is 0 or greater';
    }
    if (delaySecond > 0) {
        config.delaySecond = delaySecond;
    }
    if (form.mode !== 'pause' && startAtSecond > 0) {
        config.startAtSecond = startAtSecond;
    }
    if (form.mode === 'play' && form.pauseKind !== 'none') {
        const pauseSecond = readSecond(form.pauseSecond);
        if (pauseSecond === null || pauseSecond <= 0) {
            return 'Please enter a number greater than 0';
        }
        if (form.pauseKind === 'at') {
            if (pauseSecond <= startAtSecond) {
                return 'The stop point must be after the start point';
            }
            config.pauseAtSecond = pauseSecond;
        } else {
            config.pauseAfterSecond = pauseSecond;
        }
    }
    if (form.isVolumeSet) {
        const volume = parseFloat(form.volume);
        if (!Number.isFinite(volume) || volume < 0 || volume > 100) {
            return 'Please enter a volume between 0 and 100';
        }
        config.volume = volume;
    }
    if (form.isSpeedSet) {
        const speed = parseFloat(form.speed);
        if (!Number.isFinite(speed) || speed <= 0) {
            return 'Please enter a number greater than 0';
        }
        config.speed = speed;
    }
    return config;
}

function SecondFieldComp({
    label,
    value,
    onChange,
}: Readonly<{
    label: string;
    value: string;
    onChange: (value: string) => void;
}>) {
    const handleChanging = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            onChange(event.target.value);
        },
        [onChange],
    );
    return (
        <div className="input-group input-group-sm pt-1">
            <div className="input-group-text">{tran(label)}</div>
            <input
                className="form-control form-control-sm"
                type="number"
                min={0}
                step={1}
                value={value}
                onChange={handleChanging}
            />
            <div className="input-group-text">{tran('Seconds')}</div>
        </div>
    );
}

function MediaControlInputComp({
    defaultConfig,
    defaultScreenIds,
    onChange,
    onScreenIdsChange,
}: Readonly<{
    defaultConfig: PresentingFlowMediaControlType | null;
    defaultScreenIds: number[];
    onChange: (form: MediaControlFormType) => void;
    onScreenIdsChange: (screenIds: number[]) => void;
}>) {
    const [form, setForm] = useState(() => {
        return toFormValue(defaultConfig);
    });
    const onChangeRef = useAppCurrentRef(onChange);
    // Every field writes the WHOLE form back, the way the arming dialog does: the
    // caller holds one object and never has to merge partial answers.
    const applyChanging = useCallback((newForm: MediaControlFormType) => {
        setForm(newForm);
        onChangeRef.current(newForm);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const genFieldSetter = useCallback(
        <K extends keyof MediaControlFormType>(key: K) => {
            return (value: MediaControlFormType[K]) => {
                applyChanging({ ...form, [key]: value });
            };
        },
        [applyChanging, form],
    );
    const handleModeChanging = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            applyChanging({
                ...form,
                mode: event.target.value as PresentingFlowMediaControlModeType,
            });
        },
        [applyChanging, form],
    );
    const handlePauseKindChanging = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            applyChanging({
                ...form,
                pauseKind: event.target
                    .value as PresentingFlowMediaControlPauseKindType,
            });
        },
        [applyChanging, form],
    );
    const handleVolumeChanging = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            applyChanging({ ...form, volume: event.target.value });
        },
        [applyChanging, form],
    );
    const handleSpeedChanging = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            applyChanging({ ...form, speed: event.target.value });
        },
        [applyChanging, form],
    );
    const handleVolumeToggling = useCallback(() => {
        applyChanging({ ...form, isVolumeSet: !form.isVolumeSet });
    }, [applyChanging, form]);
    const handleSpeedToggling = useCallback(() => {
        applyChanging({ ...form, isSpeedSet: !form.isSpeedSet });
    }, [applyChanging, form]);
    // Fields that mean nothing in the chosen mode are hidden rather than disabled:
    // a `Pause` controller has no start point and no stop point, and showing the
    // boxes greyed out would leave the operator wondering what they would have done.
    const isPlaying = form.mode === 'play';
    return (
        <div className="w-100 h-100">
            <div className="input-group input-group-sm">
                <div className="input-group-text">{tran('Action')}</div>
                <select
                    className="form-select form-select-sm"
                    autoFocus
                    value={form.mode}
                    onChange={handleModeChanging}
                >
                    {presentingFlowMediaControlModeList.map((mode) => {
                        return (
                            <option key={mode} value={mode}>
                                {tran(
                                    presentingFlowMediaControlModeLabelMap[
                                        mode
                                    ],
                                )}
                            </option>
                        );
                    })}
                </select>
            </div>
            <SecondFieldComp
                label="Delay Before"
                value={form.delaySecond}
                onChange={genFieldSetter('delaySecond')}
            />
            {form.mode === 'pause' ? null : (
                <SecondFieldComp
                    label="Media Start At"
                    value={form.startAtSecond}
                    onChange={genFieldSetter('startAtSecond')}
                />
            )}
            {isPlaying ? (
                <>
                    <div className="input-group input-group-sm pt-1">
                        <div className="input-group-text">
                            {tran('Then Pause')}
                        </div>
                        <select
                            className="form-select form-select-sm"
                            value={form.pauseKind}
                            onChange={handlePauseKindChanging}
                        >
                            <option value="none">{tran('Never')}</option>
                            <option value="after">{tran('After')}</option>
                            <option value="at">{tran('At Media Time')}</option>
                        </select>
                    </div>
                    {form.pauseKind === 'none' ? null : (
                        <SecondFieldComp
                            label={
                                form.pauseKind === 'at'
                                    ? 'Media Pause At'
                                    : 'Pause After'
                            }
                            value={form.pauseSecond}
                            onChange={genFieldSetter('pauseSecond')}
                        />
                    )}
                </>
            ) : null}
            <div className="input-group input-group-sm pt-1">
                <div className="input-group-text">
                    <input
                        className="form-check-input mt-0"
                        type="checkbox"
                        title={tran('Set Volume')}
                        checked={form.isVolumeSet}
                        onChange={handleVolumeToggling}
                    />
                </div>
                <div className="input-group-text">{tran('Volume')}</div>
                <input
                    className="form-control form-control-sm"
                    type="number"
                    min={0}
                    max={100}
                    disabled={!form.isVolumeSet}
                    value={form.volume}
                    onChange={handleVolumeChanging}
                />
            </div>
            <div className="input-group input-group-sm pt-1">
                <div className="input-group-text">
                    <input
                        className="form-check-input mt-0"
                        type="checkbox"
                        title={tran('Set Speed')}
                        checked={form.isSpeedSet}
                        onChange={handleSpeedToggling}
                    />
                </div>
                <div className="input-group-text">{tran('Speed')}</div>
                <select
                    className="form-select form-select-sm"
                    disabled={!form.isSpeedSet}
                    value={form.speed}
                    onChange={handleSpeedChanging}
                >
                    {SPEED_LIST.map((speed) => {
                        return (
                            <option key={speed} value={`${speed}`}>
                                {`${speed}x`}
                            </option>
                        );
                    })}
                </select>
            </div>
            <hr />
            <div>{tran('Set Specific Screen')}</div>
            <ActionScreenIdsInputComp
                defaultScreenIds={defaultScreenIds}
                onChange={onScreenIdsChange}
            />
        </div>
    );
}

export type PresentingFlowMediaControlAnswerType = {
    mediaControl: PresentingFlowMediaControlType;
    screenIds: number[];
};

/**
 * Ask what a media controller should do, or null when the operator cancelled or
 * answered with something unusable — refused with a toast rather than quietly
 * rounded into a config they did not ask for, exactly as the arming question does.
 *
 * The screens are asked here as ONE field of the same form rather than as a second
 * dialog: they are the last part of the one sentence the operator is writing ("play
 * this, like so, on that screen"). The answer goes into the CC's ordinary pin, so
 * `Set Specific Screen` on the row stays a second door to the same field.
 *
 * Called BEFORE the controller is written when one is added — a cancelled question
 * must add nothing, which is the rule every other action's question follows.
 *
 * `enterToOk` is off: the form is number fields, and Enter in one of them would
 * submit half an answer.
 */
export async function askForPresentingFlowMediaControl(
    currentConfig: PresentingFlowMediaControlType | null = null,
    currentScreenIds: number[] = [],
): Promise<PresentingFlowMediaControlAnswerType | null> {
    let form = toFormValue(currentConfig);
    let screenIds = currentScreenIds;
    const isOk = await showAppInput(
        `${tran(MEDIA_CONTROL_TITLE)} - ${tran('Settings')}`,
        <MediaControlInputComp
            defaultConfig={currentConfig}
            defaultScreenIds={currentScreenIds}
            onChange={(newForm) => {
                form = newForm;
            }}
            onScreenIdsChange={(newScreenIds) => {
                screenIds = newScreenIds;
            }}
        />,
        { enterToOk: false },
    );
    if (!isOk) {
        return null;
    }
    const mediaControl = toMediaControlConfig(form);
    if (typeof mediaControl === 'string') {
        showSimpleToast(tran(MEDIA_CONTROL_TITLE), tran(mediaControl));
        return null;
    }
    return { mediaControl, screenIds };
}
