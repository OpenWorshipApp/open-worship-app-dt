import { useCallback, useMemo, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { useSelectedLyricContext } from './lyricHelpers';
import { useLyricEditingManagerContext } from './LyricEditingManager';
import FontFamilyControlComp from '../others/FontFamilyControlComp';
import AppRangeComp from '../others/AppRangeComp';
import { openPopupLyricEditorWindow } from './lyricEditorHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';

export default function LyricRenderControlBodyComp() {
    const selectedLyric = useSelectedLyricContext();
    const lyricEditingManager = useLyricEditingManagerContext();
    const [localFontFamily, setLocalFontFamily] = useState(
        lyricEditingManager.fontFamily,
    );
    const setLocalFontFamily1 = (fontFamily: string) => {
        setLocalFontFamily(fontFamily);
        lyricEditingManager.fontFamily = fontFamily;
    };
    const [localFontWeight, setLocalFontWeight] = useState(
        lyricEditingManager.fontWeight,
    );
    const setLocalFontWeight1 = (fontWeight: string) => {
        setLocalFontWeight(fontWeight);
        lyricEditingManager.fontWeight = fontWeight;
    };
    const [localScale, setLocalScale] = useState(lyricEditingManager.scale);
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const setLocalScale1 = (scale: number) => {
        attemptTimeout(() => {
            setLocalScale(scale);
            lyricEditingManager.scale = scale;
        });
    };
    const selectedLyricRef = useAppCurrentRef(selectedLyric);
    const handleEdit = useCallback(() => {
        openPopupLyricEditorWindow(selectedLyricRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="d-flex align-items-center justify-content-evenly">
            <div className="d-flex">
                <strong>Font:</strong>
                <FontFamilyControlComp
                    fontFamily={localFontFamily}
                    setFontFamily={setLocalFontFamily1}
                    fontWeight={localFontWeight}
                    setFontWeight={setLocalFontWeight1}
                    isShowingLabel={false}
                />
            </div>
            <div className="d-flex" style={{ maxWidth: '250px' }}>
                <strong>Scale:</strong>
                <div className="flex-grow-1">
                    <AppRangeComp
                        value={localScale}
                        title="Font Size"
                        setValue={setLocalScale1}
                        defaultSize={{
                            size: localScale,
                            min: 5,
                            max: 100,
                            step: 1,
                        }}
                    />
                </div>
            </div>
            <button
                className="btn btn-sm btn-outline-info"
                title={tran('Editor') + ` "${selectedLyric.filePath}"`}
                onClick={handleEdit}
            >
                {tran('Edit')} <i className="bi bi-box-arrow-up-right" />
            </button>
        </div>
    );
}
