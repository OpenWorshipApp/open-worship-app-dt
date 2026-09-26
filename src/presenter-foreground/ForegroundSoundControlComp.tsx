import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import {
    getSetting,
    useStateSettingBoolean,
    useStateSettingNumber,
} from '../helper/settingHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import AppRangeComp from '../others/AppRangeComp';

export const DEFAULT_SOUND_VOLUME = 100;

const soundVolumeRangeSize = {
    size: DEFAULT_SOUND_VOLUME,
    min: 0,
    max: 100,
    step: 5,
};

export function toSoundSettingNames(prefix: string) {
    return {
        isSoundOn: `${prefix}-sound-on`,
        soundVolume: `${prefix}-sound-volume`,
    };
}

/**
 * Whether this session's clip may be heard, and how loudly.
 *
 * Read straight from the settings rather than threaded down from the panel,
 * like the transition and the style beside it: this answers when an item is
 * PRESENTED, including by a slide show running with the panel closed.
 */
export function getForegroundSoundData(prefix: string) {
    const names = toSoundSettingNames(prefix);
    const isSoundOn = getSetting(names.isSoundOn) === 'true';
    const volume = Number.parseInt(getSetting(names.soundVolume) ?? '');
    return {
        isSoundOn,
        soundVolume: Number.isNaN(volume) ? DEFAULT_SOUND_VOLUME : volume,
    };
}

/**
 * Sound for one Video Show session.
 *
 * It lives in Properties beside the transition and the blend mode -- what a
 * session looks and sounds like belongs together -- and it is OFF by default:
 * an overlay usually runs under a song, and a clip that comes up loud in the
 * middle of a service is the kind of surprise this panel exists to prevent.
 */
export default function ForegroundSoundControlComp({
    prefix,
    onChange,
}: Readonly<{ prefix: string; onChange: () => void }>) {
    const names = toSoundSettingNames(prefix);
    const [isSoundOn, setIsSoundOn] = useStateSettingBoolean(
        names.isSoundOn,
        false,
    );
    const [soundVolume, setSoundVolume] = useStateSettingNumber(
        names.soundVolume,
        DEFAULT_SOUND_VOLUME,
    );
    const onChangeRef = useAppCurrentRef(onChange);
    const handleSoundToggling = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            setIsSoundOn(event.target.checked);
            onChangeRef.current();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleVolumeChanging = useCallback((value: number) => {
        setSoundVolume(value);
        onChangeRef.current();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const label = tran('Play With Sound');
    return (
        <div className="d-flex flex-column gap-1">
            <label className="d-flex align-items-center gap-2">
                <input
                    className="form-check-input m-0"
                    type="checkbox"
                    aria-label={label}
                    checked={isSoundOn}
                    onChange={handleSoundToggling}
                />
                <span aria-hidden="true">{label}</span>
            </label>
            {/* The level is only worth showing once the sound is on; drawn
                anyway would be a slider that changes nothing. */}
            {isSoundOn ? (
                <AppRangeComp
                    value={soundVolume}
                    title={tran('Volume')}
                    setValue={handleVolumeChanging}
                    defaultSize={soundVolumeRangeSize}
                />
            ) : null}
        </div>
    );
}
