import './PageBaseAppearanceSettingComp.scss';

import { useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { getAllScreenManagers } from '../_screen/managers/screenManagerHelpers';
import {
    checkIsPdfFullWidth,
    setIsPdfFullWidth,
} from '../_screen/managers/ScreenVaryAppDocumentManager';
import VirtualBGColorSettingComp from './VirtualBGColorSettingComp';

export default function PageBaseAppearanceSettingComp({
    docxPreviewBackgroundColor = null,
    onDocxPreviewBackgroundColorChange,
}: Readonly<{
    docxPreviewBackgroundColor?: string | null;
    onDocxPreviewBackgroundColorChange?: (color: string) => void;
}>) {
    const [isFullWidth, setIsFullWidth] = useState(checkIsPdfFullWidth());
    const setIsFullWidth1 = useCallback((newIsFullWidth: boolean) => {
        setIsPdfFullWidth(newIsFullWidth);
        for (const { screenVaryAppDocumentManager } of getAllScreenManagers()) {
            if (screenVaryAppDocumentManager.varySlideData === null) {
                continue;
            }
            screenVaryAppDocumentManager.varySlideData = {
                ...screenVaryAppDocumentManager.varySlideData,
                isRenderFullWidth: newIsFullWidth,
            };
        }
        setIsFullWidth(newIsFullWidth);
    }, []);
    const handleSetNotFullWidth = useCallback(() => {
        setIsFullWidth1(false);
    }, [setIsFullWidth1]);
    const handleSetFullWidth = useCallback(() => {
        setIsFullWidth1(true);
    }, [setIsFullWidth1]);
    return (
        <div className="page-base-appearance-setting">
            <div className="setting-group">
                <span className="setting-label">
                    <i className="bi bi-aspect-ratio" />
                    {tran('On Screen Width:')}
                </span>
                <fieldset className="btn-group btn-group-sm" role="group">
                    <input
                        className="btn-check"
                        type="radio"
                        name="setting-not-full-width"
                        id="setting-not-full-width"
                        checked={!isFullWidth}
                        onChange={handleSetNotFullWidth}
                    />
                    <label
                        className="btn btn-outline-info"
                        htmlFor="setting-not-full-width"
                    >
                        {tran('Not Full Width')}
                    </label>
                    <input
                        className="btn-check btn-check-sm"
                        type="radio"
                        name="setting-not-full-width"
                        id="setting-full-width"
                        checked={isFullWidth}
                        onChange={handleSetFullWidth}
                    />
                    <label
                        className="btn btn-outline-info"
                        htmlFor="setting-full-width"
                    >
                        {tran('Full Width')}
                    </label>
                </fieldset>
            </div>
            <div className="setting-group">
                <span className="setting-label">
                    <i className="bi bi-palette" />
                    {tran('Preview BG:')}
                </span>
                <VirtualBGColorSettingComp
                    docxPreviewBackgroundColor={docxPreviewBackgroundColor}
                    onDocxPreviewBackgroundColorChange={
                        onDocxPreviewBackgroundColorChange
                    }
                />
            </div>
        </div>
    );
}
