import { tran } from '../lang/langHelpers';
import AppRangeComp from '../others/AppRangeComp';

const MIN_FONT_SIZE = 5;
const MAX_FONT_SIZE = 150;
const STEP_FONT_SIZE = 2;
export const defaultRangeSize = {
    size: MIN_FONT_SIZE,
    min: MIN_FONT_SIZE,
    max: MAX_FONT_SIZE,
    step: STEP_FONT_SIZE,
};

const rangeId = 'preview-fon-size';

export default function BibleViewSettingComp({
    fontSize,
    setFontSize,
}: Readonly<{
    fontSize: number;
    setFontSize: (fontSize: number) => void;
}>) {
    return (
        <div
            className="bible-view-setting d-flex align-items-center"
            style={{ maxWidth: 450 }}
            title={`${tran('Font Size')} [Ctrl + Scroll]`}
        >
            <label
                htmlFor={rangeId}
                className={
                    'form-label text-nowrap mb-0 me-1 ' +
                    'd-flex align-items-center'
                }
            >
                <i className="bi bi-fonts me-1" />
                <span
                    className="badge bg-secondary"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                    {fontSize}px
                </span>
            </label>
            <AppRangeComp
                value={fontSize}
                title={tran('Font Size')}
                id={rangeId}
                setValue={setFontSize}
                defaultSize={defaultRangeSize}
            />
        </div>
    );
}
