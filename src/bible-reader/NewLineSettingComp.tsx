import { type ChangeEvent, useCallback, useState } from 'react';

import { useBibleItemsViewControllerContext } from './BibleItemsViewController';
import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

export default function NewLineSettingComp() {
    const viewController = useBibleItemsViewControllerContext();
    const [shouldNewLine, setShouldNewLine] = useState(
        viewController.shouldNewLine,
    );
    const setShouldNewLine1 = useCallback(
        (newValue: boolean) => {
            setShouldNewLine(newValue);
            viewController.shouldNewLine = newValue;
        },
        [viewController],
    );
    const [useModelNewLine, setUseModelNewLine] = useState(
        viewController.shouldModelNewLine,
    );
    const setUseModelNewLine1 = useCallback(
        (newValue: boolean) => {
            setUseModelNewLine(newValue);
            viewController.shouldModelNewLine = newValue;
        },
        [viewController],
    );
    const setShouldNewLine1Ref = useAppCurrentRef(setShouldNewLine1);
    const handleNewLineChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setShouldNewLine1Ref.current(event.target.checked);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const setUseModelNewLine1Ref = useAppCurrentRef(setUseModelNewLine1);
    const handleModelNewLineChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setUseModelNewLine1Ref.current(event.target.checked);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <>
            <div
                className="d-flex mx-1"
                title="Break lines following bible info"
            >
                <label htmlFor="new-line-setting" className="form-label">
                    {tran('Should New Lines')}:
                </label>
                <input
                    className="form-check-input app-caught-hover-pointer"
                    type="checkbox"
                    id="new-line-setting"
                    checked={shouldNewLine}
                    onChange={handleNewLineChange}
                />
            </div>
            <div
                className="d-flex mx-1"
                title={tran('Break lines following model formatting')}
                style={{
                    opacity: shouldNewLine ? 1 : 0.5,
                }}
            >
                <label
                    htmlFor="use-model-new-line-setting"
                    className="form-label"
                >
                    {tran('Use Model New Lines')}:
                </label>
                <input
                    className="form-check-input app-caught-hover-pointer"
                    type="checkbox"
                    id="use-model-new-line-setting"
                    disabled={!shouldNewLine}
                    checked={useModelNewLine}
                    onChange={handleModelNewLineChange}
                />
            </div>
        </>
    );
}
