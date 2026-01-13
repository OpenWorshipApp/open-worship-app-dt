import { useMemo, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import { useSelectedLyricContext } from './lyricHelpers';
import { HTMLDataType, renderLyricSlide } from './markdownHelpers';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import { genTimeoutAttempt } from '../helper/helpers';
import LoadingComp from '../others/LoadingComp';
import LyricEditingManager, {
    useLyricEditingManagerContext,
} from './LyricEditingManager';
import FontFamilyControlComp from '../others/FontFamilyControlComp';
import AppRangeComp from '../others/AppRangeComp';
import { checkIsDarkMode } from '../others/initHelpers';
import { openPopupLyricEditorWindow } from './lyricEditorHelpers';
import appProvider from '../server/appProvider';
import { forceReloadAppWindows } from '../setting/settingHelpers';

function genOptions(lyricEditingManager: LyricEditingManager) {
    const isDarkMode = checkIsDarkMode();
    return {
        theme: isDarkMode ? 'dark' : 'light',
        fontFamily: lyricEditingManager.lyricEditingProps.fontFamily,
        fontWeight: lyricEditingManager.lyricEditingProps.fontWeight,
    };
}

function RenderControlBodyComp() {
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
    return (
        <div>
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
            <div className="d-flex w-100">
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
            {appProvider.isPageLyricEditor ? (
                <div className="w-100 d-flex justify-content-center py-2">
                    <button
                        className="btn btn-sm btn-outline-warning"
                        title={tran('Editor') + ` "${selectedLyric.filePath}"`}
                        onClick={() => {
                            forceReloadAppWindows();
                        }}
                    >
                        Apply
                    </button>
                </div>
            ) : (
                <div className="w-100 d-flex justify-content-center py-2">
                    <button
                        className="btn btn-sm btn-outline-info"
                        title={tran('Editor') + ` "${selectedLyric.filePath}"`}
                        onClick={() => {
                            openPopupLyricEditorWindow(selectedLyric);
                        }}
                    >
                        Edit <i className="bi bi-box-arrow-up-right"></i>
                    </button>
                </div>
            )}
        </div>
    );
}

function RenderPreviewBodyComp() {
    const selectedLyric = useSelectedLyricContext();
    const lyricEditingManager = useLyricEditingManagerContext();
    const [htmlData, setHtmlData] = useAppStateAsync<HTMLDataType>(() => {
        return renderLyricSlide(selectedLyric, genOptions(lyricEditingManager));
    }, [selectedLyric, lyricEditingManager]);
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    useFileSourceEvents(
        ['update'],
        async () => {
            attemptTimeout(async () => {
                setHtmlData(
                    await renderLyricSlide(
                        selectedLyric,
                        genOptions(lyricEditingManager),
                    ),
                );
            });
        },
        [],
        selectedLyric.filePath,
    );
    if (!htmlData) {
        return (
            <div
                className={
                    'w-100 h-100 d-flex justify-content-center' +
                    ' align-items-center'
                }
            >
                <LoadingComp />
            </div>
        );
    }
    return (
        <div
            className="w-100 h-100 p-3"
            dangerouslySetInnerHTML={{ __html: htmlData.html }}
        />
    );
}

export default function LyricPreviewerComp() {
    return (
        <div className="d-flex w-100 h-100">
            <div className="card h-100">
                <div className="card-header">Control</div>
                <div className="card-body">
                    <RenderControlBodyComp />
                </div>
            </div>
            <div className="card h-100 flex-grow-1">
                <div className="card-header">Preview</div>
                <div className="card-body app-overflow-hidden">
                    <RenderPreviewBodyComp />
                </div>
            </div>
        </div>
    );
}
