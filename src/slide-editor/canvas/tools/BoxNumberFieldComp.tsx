import type { ChangeEvent } from 'react';

/**
 * One labelled number a box property is typed into -- the `X: [100] px` shape
 * the item Properties panel uses for position, size, rotation and the shadow's
 * offsets.
 *
 * A component of its own rather than a copy per panel: these sit in one column
 * a few rows apart, and two of them drawn from two sources drift in padding
 * the first time either is touched.
 *
 * `title` is put on the input as its accessible name as well as on the group,
 * so `owa_find_ui` / `owa_type` can aim at the field by the words the operator
 * reads. A `title` on the wrapper alone names nothing.
 */
export default function BoxNumberFieldComp({
    name,
    title,
    value,
    unit = 'px',
    min,
    max,
    onChange,
}: Readonly<{
    name: string;
    title?: string;
    value: number;
    unit?: string;
    min?: number;
    max?: number;
    onChange: (value: number) => void;
}>) {
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const newValue = Number.parseFloat(event.target.value);
        if (!Number.isNaN(newValue)) {
            onChange(newValue);
        }
    };
    return (
        <div className="d-flex input-group input-group-sm" title={title}>
            {/* Axis/dimension abbreviations are universal — not translated. */}
            <div className="input-group-text">{name}</div>
            <input
                className="form-control form-control-sm"
                type="number"
                aria-label={title ?? name}
                value={Math.round(value)}
                min={min}
                max={max}
                onChange={handleChange}
            />
            <div className="input-group-text">{unit}</div>
        </div>
    );
}
