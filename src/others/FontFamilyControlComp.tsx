import { type ChangeEvent, useCallback, useMemo } from 'react';

import {
    genFontWeightOptions,
    toCleanFontWeight,
    useFontList,
} from '../server/fontHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';

export default function FontFamilyControlComp({
    fontFamily,
    setFontFamily,
    fontWeight,
    setFontWeight,
    isShowingLabel = false,
}: Readonly<{
    fontFamily: string;
    setFontFamily: (fontFamily: string) => void;
    fontWeight: string;
    setFontWeight: (fontWeight: string) => void;
    isShowingLabel?: boolean;
}>) {
    const fontList = useFontList();
    const fontFamilies = useMemo(() => {
        if (!fontList) {
            return [];
        }
        const newFontFamilies = Object.keys(fontList).map((key) => [key, key]);
        if (fontFamily && !fontList[fontFamily]) {
            newFontFamilies.unshift([
                fontFamily,
                `${fontFamily} (${tran('Missing')})`,
            ]);
        }
        newFontFamilies.unshift(['--', '--']);
        return newFontFamilies;
    }, [fontList, fontFamily]);
    const cleanFontWeight = toCleanFontWeight(fontWeight);
    const fontWeightOptions = useMemo(() => {
        return genFontWeightOptions(
            fontList?.[fontFamily] ?? [],
            cleanFontWeight,
            `(${tran('Missing')})`,
        );
    }, [fontList, fontFamily, cleanFontWeight]);
    const setFontFamilyRef = useAppCurrentRef(setFontFamily);
    const handleFontFamilyChange = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            let value = event.target.value;
            if (value === '--') {
                value = '';
            }
            setFontFamilyRef.current(value);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    if (fontList === undefined) {
        return <div>Loading Font ...</div>;
    }
    if (fontList === null) {
        return <div>Fail to load font list</div>;
    }
    // A family that ships one weight offers no choice. A weight already set
    // stays pickable so it can be put back to the default.
    const isShowingFontWeight =
        fontWeightOptions.length > 1 || cleanFontWeight !== '';
    return (
        <div className="pb-2 d-flex flex-wrap align-items-end gap-1">
            <div>
                {isShowingLabel && (
                    <label htmlFor="text-font-family">
                        {tran('Font Family')}
                    </label>
                )}
                <select
                    id="text-font-family"
                    // Named whether or not the label above is drawn. Settings
                    // hides it and titles the card instead, which nothing ties
                    // to this picker, so it was announced as an unnamed box.
                    aria-label={tran('Font Family')}
                    className="form-select form-select-sm"
                    value={fontFamily}
                    onChange={handleFontFamilyChange}
                >
                    {fontFamilies.map(([key, value]) => {
                        return (
                            <option
                                key={key}
                                value={key}
                                style={{ fontFamily: key }}
                            >
                                {value}
                            </option>
                        );
                    })}
                </select>
            </div>
            {isShowingFontWeight ? (
                <RenderFontWeightSelectComp
                    fontFamily={fontFamily}
                    fontWeight={cleanFontWeight}
                    fontWeightOptions={fontWeightOptions}
                    setFontWeight={setFontWeight}
                    isShowingLabel={isShowingLabel}
                />
            ) : null}
        </div>
    );
}

function RenderFontWeightSelectComp({
    fontFamily,
    fontWeight,
    fontWeightOptions,
    setFontWeight,
    isShowingLabel = false,
}: Readonly<{
    fontFamily: string;
    fontWeight: string;
    fontWeightOptions: [string, string][];
    setFontWeight: (fontWeight: string) => void;
    isShowingLabel?: boolean;
}>) {
    const setFontWeightRef = useAppCurrentRef(setFontWeight);
    const handleFontWeightChange = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            setFontWeightRef.current(event.target.value);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <div>
            {isShowingLabel && (
                <label htmlFor="text-font-style">{tran('Font Weight')}</label>
            )}
            <select
                id="text-font-style"
                aria-label={tran('Font Weight')}
                title={tran('Font Weight')}
                className="form-select form-select-sm"
                value={fontWeight}
                onChange={handleFontWeightChange}
            >
                <option value="">{tran('Default')}</option>
                {fontWeightOptions.map(([value, label]) => {
                    return (
                        <option
                            key={value}
                            value={value}
                            style={{
                                fontFamily: fontFamily || undefined,
                                fontWeight: value,
                            }}
                        >
                            {label}
                        </option>
                    );
                })}
            </select>
        </div>
    );
}
