import { type ChangeEvent, useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import {
    BLEND_MODE_GROUP_LIST,
    DEFAULT_BLEND_MODE,
} from '../helper/blendModeHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

/**
 * The blend-mode `<select>`, shared by the foreground widget Properties panel
 * and by a slide's canvas-item properties. Only the `className` differs
 * between the two -- the option list, its grouping and its translated names
 * are the same vocabulary, and a second copy of that list is how one of them
 * ends up missing a mode.
 */
export default function BlendModeSelectComp({
    className,
    blendMode,
    setBlendMode,
}: Readonly<{
    className: string;
    blendMode: string;
    setBlendMode: (value: string) => void;
}>) {
    const setBlendModeRef = useAppCurrentRef(setBlendMode);
    const handleChange = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            setBlendModeRef.current(event.target.value);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <select
            className={className}
            aria-label={tran('Blend Mode')}
            value={blendMode}
            onChange={handleChange}
        >
            <option value={DEFAULT_BLEND_MODE}>{tran('Normal')}</option>
            {BLEND_MODE_GROUP_LIST.map((group) => {
                return (
                    <optgroup key={group.labelKey} label={tran(group.labelKey)}>
                        {group.modes.map((mode) => {
                            return (
                                <option key={mode.value} value={mode.value}>
                                    {tran(mode.labelKey)}
                                </option>
                            );
                        })}
                    </optgroup>
                );
            })}
        </select>
    );
}
