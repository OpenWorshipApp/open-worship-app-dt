import { FontListType } from '../server/appProvider';
import { useFontList } from '../server/fontHelpers';

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
    if (fontList === null) {
        return <div>Loading Font ...</div>;
    }
    return (
        <div className="pb-2">
            <div>
                {isShowingLabel && (
                    <label htmlFor="text-font-family">Font Family</label>
                )}
                <select
                    id="text-font-family"
                    className="form-select form-select-sm"
                    value={fontFamily}
                    onChange={(event) => {
                        if (event.target.value === '--') {
                            return;
                        }
                        setFontFamily(event.target.value);
                    }}
                >
                    <option>--</option>
                    {Object.keys(fontList).map((ff) => {
                        return (
                            <option key={ff} value={ff}>
                                {ff}
                            </option>
                        );
                    })}
                </select>
            </div>
            {!!fontList[fontFamily]?.length && (
                <FontWeight
                    fontWeight={fontWeight}
                    setFontWeight={setFontWeight}
                    fontFamily={fontFamily}
                    fontList={fontList}
                    isShowingLabel={isShowingLabel}
                />
            )}
        </div>
    );
}

function FontWeight({
    fontWeight,
    setFontWeight,
    fontFamily,
    fontList,
    isShowingLabel = false,
}: Readonly<{
    fontWeight: string;
    setFontWeight: (fontWeight: string) => void;
    fontFamily: string;
    fontList: FontListType;
    isShowingLabel?: boolean;
}>) {
    return (
        <div>
            {isShowingLabel && (
                <label htmlFor="text-font-style">Font Style</label>
            )}
            <select
                id="text-font-style"
                className="form-select form-select-sm"
                value={fontWeight}
                onChange={(event) => {
                    setFontWeight(event.target.value);
                }}
            >
                <option>--</option>
                {fontList[fontFamily].map((fs) => {
                    return (
                        <option key={fs} value={fs}>
                            {fs}
                        </option>
                    );
                })}
            </select>
        </div>
    );
}
