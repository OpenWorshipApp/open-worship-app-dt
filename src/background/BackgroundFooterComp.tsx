import { handleAutoHide } from '../helper/domHelpers';
import AppRangeComp from '../others/AppRangeComp';
import type { BackgroundViewModeType } from './BackgroundViewModeComp';
import BackgroundViewModeComp from './BackgroundViewModeComp';

export const defaultRangeSize = {
    size: 100,
    min: 50,
    max: 500,
    step: 10,
};

export default function BackgroundFooterComp({
    thumbnailWidth,
    setThumbnailWidth,
    viewMode,
    setViewMode,
}: Readonly<{
    thumbnailWidth: number;
    setThumbnailWidth: (value: number) => void;
    viewMode?: BackgroundViewModeType;
    setViewMode?: (viewMode: BackgroundViewModeType) => void;
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
            {viewMode === undefined || setViewMode === undefined ? null : (
                <BackgroundViewModeComp
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                />
            )}
            <div className="flex-fill" />
            {viewMode === 'list' ? null : (
                <div>
                    <AppRangeComp
                        value={thumbnailWidth}
                        title="Thumbnail Size"
                        setValue={setThumbnailWidth}
                        defaultSize={defaultRangeSize}
                    />
                </div>
            )}
        </div>
    );
}
