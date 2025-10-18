import { useState } from 'react';

import { AppColorType } from '../../others/color/colorHelpers';
import ScreenBibleManager from '../managers/ScreenBibleManager';
import ScreenVaryAppDocumentManager from '../managers/ScreenVaryAppDocumentManager';
import AppRangeComp from '../../others/AppRangeComp';
import { getAllScreenManagers } from '../managers/screenManagerHelpers';
import { useStylingColor, useStylingFontSize } from './stylingHelpers';

export default function AppearanceComp() {
    const [color, setColor] = useStylingColor();
    const [fontSize, setFontSize] = useStylingFontSize();
    return (
        <div>
            <span className="p-">
                Font Size:{' '}
                <span className="badge bg-success">({fontSize}px)</span>
            </span>
            <input
                className="float-end app-caught-hover-pointer"
                type="color"
                onChange={(event) => {
                    setColor(event.target.value as AppColorType);
                }}
                value={color}
            />
            <div>
                <AppRangeComp
                    value={fontSize}
                    title="Font Size"
                    setValue={setFontSize}
                    defaultSize={{
                        size: fontSize,
                        min: 1,
                        max: ScreenBibleManager.maxTextStyleTextFontSize,
                        step: 1,
                    }}
                />
            </div>
            <hr />
            <PdfAppearanceSettingComp />
        </div>
    );
}

function PdfAppearanceSettingComp() {
    const [isFullWidth, setIsFullWidth] = useState(
        ScreenVaryAppDocumentManager.isPdfFullWidth,
    );
    const setIsFullWidth1 = (isFullWidth: boolean) => {
        ScreenVaryAppDocumentManager.isPdfFullWidth = isFullWidth;
        for (const { screenVaryAppDocumentManager } of getAllScreenManagers()) {
            screenVaryAppDocumentManager.render();
            screenVaryAppDocumentManager.sendSyncScreen();
        }
        setIsFullWidth(isFullWidth);
    };
    return (
        <div className="d-flex">
            <small>`PDF Setting:</small>
            <div>
                <div className="btn-group" role="group">
                    <input
                        className="btn-check"
                        type="radio"
                        name="setting-not-full-width"
                        id="setting-not-full-width"
                        checked={!isFullWidth}
                        onChange={() => {
                            setIsFullWidth1(false);
                        }}
                    />
                    <label
                        className="btn btn-outline-info"
                        htmlFor="setting-not-full-width"
                    >
                        `Not Full Width
                    </label>
                    <input
                        className="btn-check"
                        type="radio"
                        name="setting-not-full-width"
                        id="setting-full-width"
                        checked={isFullWidth}
                        onChange={() => {
                            setIsFullWidth1(true);
                        }}
                    />
                    <label
                        className="btn btn-outline-info"
                        htmlFor="setting-full-width"
                    >
                        `Full Width
                    </label>
                </div>
            </div>
        </div>
    );
}
