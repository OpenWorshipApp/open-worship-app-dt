import { useState } from 'react';

import { getAllScreenManagers } from '../_screen/managers/screenManagerHelpers';
import {
    checkIsPdfFullWidth,
    setIsPdfFullWidth,
} from '../_screen/managers/ScreenVaryAppDocumentManager';

export default function PdfAppearanceSettingComp() {
    const [isFullWidth, setIsFullWidth] = useState(checkIsPdfFullWidth());
    const setIsFullWidth1 = (newIsFullWidth: boolean) => {
        setIsPdfFullWidth(newIsFullWidth);
        for (const { screenVaryAppDocumentManager } of getAllScreenManagers()) {
            if (screenVaryAppDocumentManager.varyAppDocumentItemData === null) {
                continue;
            }
            screenVaryAppDocumentManager.varyAppDocumentItemData = {
                ...screenVaryAppDocumentManager.varyAppDocumentItemData,
                isPdfFullWidth: newIsFullWidth,
            };
        }
        setIsFullWidth(newIsFullWidth);
    };
    return (
        <div className="d-flex">
            <small>`On Screen Width:</small>
            <div>
                <fieldset className="btn-group btn-group-sm ms-2" role="group">
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
                        className="btn-check btn-check-sm"
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
