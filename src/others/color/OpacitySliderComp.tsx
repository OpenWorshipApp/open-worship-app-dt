import { useMemo, useState } from 'react';
import AppRangeComp from '../AppRangeComp';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';
import { useAppEffect } from '../../helper/appHooks';
import { tran } from '../../lang/langHelpers';

export default function OpacitySliderComp({
    value,
    onOpacityChanged,
}: Readonly<{
    value: number;
    onOpacityChanged: (value: number, event: MouseEvent) => void;
}>) {
    const [localValue, setLocalValue] = useState(value);
    // Follow the color the picker now holds: choosing a swatch or "no color"
    // changes the alpha from outside, and the slider kept showing the old one.
    useAppEffect(() => {
        setLocalValue(value);
    }, [value]);
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    return (
        <AppRangeComp
            value={localValue}
            title={tran('Opacity')}
            setValue={(newValue) => {
                setLocalValue(newValue);
                attemptTimeout(() => {
                    onOpacityChanged(newValue, {} as any);
                });
            }}
            isShowValue={true}
            defaultSize={{
                size: localValue,
                min: 1,
                max: 255,
                step: 1,
            }}
        />
    );
}
