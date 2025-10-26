import { handleAutoHide } from '../../helper/domHelpers';
import AppRangeComp from '../../others/AppRangeComp';

export const DEFAULT_PREVIEW_SIZE = 50;
export const defaultRangeSize = {
    size: 9,
    min: 1,
    max: 20,
    step: 1,
};
export default function MiniScreenFooterComp({
    previewSizeScale,
    setPreviewSizeScale,
}: Readonly<{
    previewSizeScale: number;
    setPreviewSizeScale: (size: number) => void;
}>) {
    return (
        <div
            className={'card-footer w-100 app-auto-hide-bottom'}
            ref={(element) => {
                if (element !== null) {
                    handleAutoHide(element, false);
                }
            }}
        >
            <div className="d-flex w-100 h-100">
                <div className="row">
                    <div className="col-auto">
                        <AppRangeComp
                            value={previewSizeScale}
                            title="Preview Size Scale"
                            setValue={setPreviewSizeScale}
                            defaultSize={defaultRangeSize}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
