import { useMemo, useState } from 'react';
import AppRangeComp from '../AppRangeComp';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';
import { tran } from '../../lang/langHelpers';

export default function OpacitySliderComp({
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
