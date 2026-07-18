import { type ChangeEvent, useCallback, useState } from 'react';

import { useBibleItemsViewControllerContext } from './BibleItemsViewController';
import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

export default function NewLineSettingComp() {
    const viewController = useBibleItemsViewControllerContext();
    const [shouldNewLine, setShouldNewLine] = useState(
        viewController.shouldNewLine,
    );
    const viewControllerRef = useAppCurrentRef(viewController);
    const setShouldNewLine1 = useCallback(
        (newValue: boolean) => {
            setShouldNewLine(newValue);
            viewControllerRef.current.shouldNewLine = newValue;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const [useModelNewLine, setUseModelNewLine] = useState(
        viewController.shouldModelNewLine,
    );
    const setUseModelNewLine1 = useCallback(
        (newValue: boolean) => {
            setUseModelNewLine(newValue);
            viewControllerRef.current.shouldModelNewLine = newValue;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
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
        <div className="d-flex align-items-center gap-2">
            <label
                htmlFor="new-line-setting"
                className={
                    'form-label mb-0 text-nowrap app-caught-hover-pointer ' +
                    'd-flex align-items-center gap-1'
                }
                title={`${tran('Should New Lines')} — break lines following bible info`}
            >
                <input
                    className="form-check-input mt-0 app-caught-hover-pointer"
                    type="checkbox"
                    id="new-line-setting"
                    checked={shouldNewLine}
                    onChange={handleNewLineChange}
                />
                <i className="bi bi-arrow-return-left" />
            </label>
            <label
                htmlFor="use-model-new-line-setting"
                className={
                    'form-label mb-0 text-nowrap app-caught-hover-pointer ' +
                    'd-flex align-items-center gap-1'
                }
                title={tran('Break lines following model formatting')}
                style={{
                    opacity: shouldNewLine ? 1 : 0.5,
                }}
            >
                <input
                    className="form-check-input mt-0 app-caught-hover-pointer"
                    type="checkbox"
                    id="use-model-new-line-setting"
                    disabled={!shouldNewLine}
                    checked={useModelNewLine}
                    onChange={handleModelNewLineChange}
                />
                <i className="bi bi-file-text" />
            </label>
        </div>
    );
}
