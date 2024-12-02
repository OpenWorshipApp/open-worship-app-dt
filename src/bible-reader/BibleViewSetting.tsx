import AppRange from '../others/AppRange';

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

export default function BibleViewSetting({ fontSize, setFontSize }: Readonly<{
    fontSize: number,
    setFontSize: (fontSize: number) => void,
}>) {
    return (
        <div className='bible-view-setting' style={{
            maxWidth: 450,
        }}>
            <div className='input-group d-flex'>
                <div className='flex-fill d-flex mx-1'>
                    <div className='d-flex flex-fill'>
                        <label htmlFor={rangeId} className='form-label'>
                            Font Size ({fontSize}px):
                        </label>
                        <AppRange
                            value={fontSize}
                            title='Font Size'
                            id={rangeId}
                            setValue={setFontSize}
                            defaultSize={defaultRangeSize}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
