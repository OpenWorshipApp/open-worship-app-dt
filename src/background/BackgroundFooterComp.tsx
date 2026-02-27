import { handleAutoHide } from '../helper/domHelpers';
import AppRangeComp from '../others/AppRangeComp';

export const defaultRangeSize = {
    size: 100,
    min: 50,
    max: 500,
    step: 10,
};

export default function BackgroundFooterComp({
    thumbnailWidth,
    setThumbnailWidth,
}: Readonly<{
    thumbnailWidth: number;
    setThumbnailWidth: (value: number) => void;
}>) {
    return (
        <div
            className="card-footer d-flex w-100 p-0 app-auto-hide-bottom"
            ref={(element) => {
                if (element !== null) {
                    handleAutoHide(element);
                }
            }}
        >
            <div className="flex-fill" />
            <div>
                <AppRangeComp
                    value={thumbnailWidth}
                    title="Thumbnail Size"
                    setValue={setThumbnailWidth}
                    defaultSize={defaultRangeSize}
                />
            </div>
        </div>
    );
}
