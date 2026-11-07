import { type ChangeEvent, useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import AlignmentPadComp from '../others/AlignmentPadComp';

type AlignmentDataType = {
    verticalAlignment?: string;
    horizontalAlignment?: string;
};

/**
 * Where the overlay sits, as ONE control.
 *
 * It used to be two rows: a three-button strip for top/middle/bottom, another
 * for left/centre/right, and a separate 330px box for the X/Y nudge -- about
 * a third of the panel's height spent answering one question. A compositing
 * desk asks it with a nine-cell pad (`AlignmentPadComp`), and the nudge
 * belongs in the same cell for the same reason: an offset IS the position,
 * measured from the cell.
 */
export default function ForegroundPositionPadComp({
    data,
    onData,
    offsetX,
    setOffsetX,
    offsetY,
    setOffsetY,
}: Readonly<{
    data: AlignmentDataType;
    onData: (data: AlignmentDataType) => void;
    offsetX: number;
    setOffsetX: (value: number) => void;
    offsetY: number;
    setOffsetY: (value: number) => void;
}>) {
    const setOffsetXRef = useAppCurrentRef(setOffsetX);
    const setOffsetYRef = useAppCurrentRef(setOffsetY);
    const handleOffsetXChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setOffsetXRef.current(Number.parseInt(event.target.value) || 0);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleOffsetYChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setOffsetYRef.current(Number.parseInt(event.target.value) || 0);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const offsetTitle = tran('Position offset in pixels');
    return (
        <div className="fg-pad" data-widget-name="Position">
            <AlignmentPadComp
                verticalAlignment={data.verticalAlignment}
                horizontalAlignment={data.horizontalAlignment}
                label={tran('Position')}
                onChoose={onData}
            />
            <div className="fg-pad-offset" title={offsetTitle}>
                <label className="fg-pad-offset-axis">
                    <span aria-hidden="true">X</span>
                    <input
                        type="number"
                        aria-label={`${offsetTitle} X`}
                        value={offsetX}
                        onChange={handleOffsetXChange}
                    />
                </label>
                <label className="fg-pad-offset-axis">
                    <span aria-hidden="true">Y</span>
                    <input
                        type="number"
                        aria-label={`${offsetTitle} Y`}
                        value={offsetY}
                        onChange={handleOffsetYChange}
                    />
                </label>
            </div>
        </div>
    );
}
