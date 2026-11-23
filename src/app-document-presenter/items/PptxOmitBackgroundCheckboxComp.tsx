import { type ChangeEvent, useCallback } from 'react';

import FileSource from '../../helper/FileSource';
import { useAppCurrentRef, useAppStateAsync } from '../../helper/appHooks';
import { tran } from '../../lang/langHelpers';
import {
    getPptxOmitBackground,
    setPptxOmitBackground,
} from '../../server/pptxBuildOptionHelpers';

/**
 * A PowerPoint file's own choice to build its slides without their
 * background, so the background the app puts behind them shows through. On
 * by default, kept per file (`pptxBuildOptionHelpers`). A change is told to
 * the deck's file source: the slides previewer's `update` listener then asks
 * for the slides again, and `getPptxData` rebuilds the preview the other way.
 */
export default function PptxOmitBackgroundCheckboxComp({
    filePath,
}: Readonly<{ filePath: string }>) {
    const [isOmit, setIsOmit] = useAppStateAsync<boolean>(
        () => {
            return getPptxOmitBackground(filePath);
        },
        [filePath],
        true,
    );
    const filePathRef = useAppCurrentRef(filePath);
    const handleChange = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            const checked = event.target.checked;
            // Read before the write is awaited: a deck picked meanwhile must
            // not be the one rebuilt.
            const changedFilePath = filePathRef.current;
            setIsOmit(checked);
            await setPptxOmitBackground(changedFilePath, checked);
            FileSource.getInstance(changedFilePath).fireUpdateEvent();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <label
            className="d-flex align-items-center gap-1 text-nowrap m-0 px-2"
            style={{ height: 22, cursor: 'pointer' }}
        >
            <input
                className="form-check-input mt-0"
                type="checkbox"
                checked={isOmit ?? true}
                onChange={handleChange}
            />
            {tran('Omit Background')}
        </label>
    );
}
