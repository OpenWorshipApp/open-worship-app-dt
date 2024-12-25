import './MiniScreen.scss';

import {
    initReceiveScreenMessage, useScreenManagerEvents,
} from '../managers/screenEventHelpers';
import ScreenPreviewerItemComp from './ScreenPreviewerItemComp';
import MiniScreenFooter, { defaultRangeSize } from './MiniScreenFooter';
import {
    useStateSettingBoolean, useStateSettingNumber,
} from '../../helper/settingHelpers';
import { showAppContextMenu } from '../../others/AppContextMenu';
import ScreenPreviewerTools from './ScreenPreviewerTools';
import { handleCtrlWheel } from '../../others/AppRange';
import {
    genNewScreenManagerInstance, getAllScreenManagerInstances, getScreenManagersSetting,
    ScreenManagerContext,
} from '../managers/screenManagerHelpers';

function openContextMenu(event: any) {
    showAppContextMenu(event, [
        {
            menuTitle: 'Add New Screen',
            onClick() {
                genNewScreenManagerInstance();
            },
        },
    ]);
}

const DEFAULT_PREVIEW_SIZE = 50;
initReceiveScreenMessage();
export default function MiniScreen() {
    const [isShowingTools, setIsShowingTools] = useStateSettingBoolean(
        'mini-screen-previewer-tool', true,
    );
    const [previewScale, setPreviewScale] = useStateSettingNumber(
        'mini-screen-previewer', DEFAULT_PREVIEW_SIZE,
    );
    const setPreviewScale1 = (size: number) => {
        setPreviewScale(size);
        getAllScreenManagerInstances().forEach((screenManager) => {
            screenManager.fireResizeEvent();
        });
    };
    useScreenManagerEvents(['instance']);
    const screenManagers = getScreenManagersSetting();
    const previewWidth = DEFAULT_PREVIEW_SIZE * previewScale;
    return (
        <div className='card w-100 h-100'>
            <div className={'card-body d-flex flex-column'}
                style={{
                    overflow: 'auto',
                }}
                onContextMenu={(event) => {
                    openContextMenu(event);
                }}
                onWheel={(event) => {
                    handleCtrlWheel({
                        event, value: previewScale,
                        setValue: setPreviewScale1,
                        defaultSize: defaultRangeSize,
                    });
                }}>
                {isShowingTools && (
                    <ScreenPreviewerTools />
                )}
                <div className='w-100'>
                    {screenManagers.map((screenManager) => {
                        return (
                            <ScreenManagerContext
                                key={screenManager.key}
                                value={screenManager}>
                                <ScreenPreviewerItemComp
                                    width={previewWidth}
                                />
                            </ScreenManagerContext>
                        );
                    })}
                </div>
            </div>
            <MiniScreenFooter
                previewSizeScale={previewScale}
                setPreviewSizeScale={setPreviewScale1}
                isShowingTools={isShowingTools}
                setIsShowingTools={setIsShowingTools}
            />
        </div>
    );
}
