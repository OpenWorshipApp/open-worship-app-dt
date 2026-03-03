import { useMemo, useState } from 'react';
import AppRangeComp from '../AppRangeComp';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';

export default function OpacitySlider({
    value,
    onOpacityChanged,
}: Readonly<{
    value: number;
    onOpacityChanged: (value: number, event: MouseEvent) => void;
}>) {
    const [localValue, setLocalValue] = useState(value);
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    return (
        <AppRangeComp
            value={localValue}
            title="Opacity"
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
