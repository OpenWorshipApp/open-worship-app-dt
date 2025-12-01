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
    const [useKJVNewLine, setUseKJVNewLine] = useState(
        viewController.shouldKJVNewLine,
    );
    const setUseKJVNewLine1 = (newValue: boolean) => {
        setUseKJVNewLine(newValue);
        viewController.shouldKJVNewLine = newValue;
    };
    return (
        <>
            <div
                className="d-flex mx-1"
                title="Break lines following KJV formatting"
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
                title="Break lines following KJV formatting"
                style={{
                    opacity: shouldNewLine ? 1 : 0.5,
                }}
            >
                <label
                    htmlFor="use-kjv-new-line-setting"
                    className="form-label"
                >
                    Use KJV New Lines:
                </label>
                <input
                    className="form-check-input app-caught-hover-pointer"
                    type="checkbox"
                    id="use-kjv-new-line-setting"
                    disabled={!shouldNewLine}
                    checked={useKJVNewLine}
                    onChange={(event) => {
                        setUseKJVNewLine1(event.target.checked);
                    }}
                />
            </div>
        </>
    );
}
