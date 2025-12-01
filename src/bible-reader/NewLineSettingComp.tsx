import { useState } from 'react';

import { useBibleItemsViewControllerContext } from './BibleItemsViewController';

export default function NewLineSettingComp() {
    const viewController = useBibleItemsViewControllerContext();
    const [shouldNewLine, setShouldNewLine] = useState(
        viewController.shouldNewLine,
    );
    const setShouldNewLine1 = (newValue: boolean) => {
        setShouldNewLine(newValue);
        viewController.shouldNewLine = newValue;
    };
    const [useModelNewLine, setUseModelNewLine] = useState(
        viewController.shouldModelNewLine,
    );
    const setUseModelNewLine1 = (newValue: boolean) => {
        setUseModelNewLine(newValue);
        viewController.shouldModelNewLine = newValue;
    };
    return (
        <>
            <div
                className="d-flex mx-1"
                title="Break lines following bible info"
            >
                <label htmlFor="new-line-setting" className="form-label">
                    Should New Lines:
                </label>
                <input
                    className="form-check-input app-caught-hover-pointer"
                    type="checkbox"
                    id="new-line-setting"
                    checked={shouldNewLine}
                    onChange={(event) => {
                        setShouldNewLine1(event.target.checked);
                    }}
                />
            </div>
            <div
                className="d-flex mx-1"
                title="Break lines following model formatting"
                style={{
                    opacity: shouldNewLine ? 1 : 0.5,
                }}
            >
                <label
                    htmlFor="use-model-new-line-setting"
                    className="form-label"
                >
                    Use Model New Lines:
                </label>
                <input
                    className="form-check-input app-caught-hover-pointer"
                    type="checkbox"
                    id="use-model-new-line-setting"
                    disabled={!shouldNewLine}
                    checked={useModelNewLine}
                    onChange={(event) => {
                        setUseModelNewLine1(event.target.checked);
                    }}
                />
            </div>
        </>
    );
}
