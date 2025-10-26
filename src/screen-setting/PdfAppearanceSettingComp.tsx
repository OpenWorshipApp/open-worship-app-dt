import { useState } from 'react';

import { getAllScreenManagers } from '../_screen/managers/screenManagerHelpers';
import ScreenVaryAppDocumentManager from '../_screen/managers/ScreenVaryAppDocumentManager';

export default function PdfAppearanceSettingComp() {
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
                <fieldset className="btn-group">
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
                </fieldset>
            </div>
        </div>
    );
}
