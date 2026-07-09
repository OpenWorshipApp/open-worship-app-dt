import { type ChangeEvent, useCallback } from 'react';
import { useAppCurrentRef } from '../helper/appHooks';

export default function FontSizeControlComp({
    fontSize,
    setFontSize,
}: Readonly<{
    fontSize: number;
    setFontSize: (fontSize: number) => void;
}>) {
    const setFontSizeRef = useAppCurrentRef(setFontSize);
    const handleFontSizeChange = useCallback(
        (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
            setFontSizeRef.current(Number.parseInt(event.target.value));
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <div className="d-flex">
            <input
                className="form-control form-control-sm"
                type="number"
                style={{ maxWidth: '100px' }}
                value={fontSize}
                onChange={handleFontSizeChange}
            />
            <select
                className="form-select form-select-sm"
                value={fontSize}
                onChange={handleFontSizeChange}
            >
                <option>--</option>
                {Array.from({ length: 20 }, (_, i) => (i + 1) * 15)
                    .reverse()
                    .map((n) => {
                        return (
                            <option key={n} value={n}>
                                {n}px
                            </option>
                        );
                    })}
            </select>
        </div>
    );
}
