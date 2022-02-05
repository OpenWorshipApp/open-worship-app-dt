import FlexResizer, { getPresentingFlexSize } from './FlexResizer';
import SlideList from './slide-list/SlideList';
import SlideItemThumbEditor from './editor/SlideItemThumbEditor';
import SlideItemThumbList from './slide-presenting/SlideItemThumbList';
import { getWindowMode } from './App';

export default function AppEditing() {
    const resizeSettingName = `${getWindowMode()}-window-size`;
    const flexSize = getPresentingFlexSize(resizeSettingName, {
        'h1': '1',
        'h1-v1': '1',
        'h1-v2': '2',
        'h2': '3',
    });
    return (
        <>
            <div data-fs="h1" className="flex v" style={{ flex: flexSize['h1'] || 1 }}>
                <div data-fs="h1-v1" className="flex-item" style={{ flex: flexSize['h1-v1'] || 1 }}>
                    <SlideList />
                </div>
                <FlexResizer settingName={resizeSettingName} type={'v'} />
                <div data-fs="h1-v2" className="flex-item" style={{ flex: flexSize['h1-v2'] || 1 }}>
                    <SlideItemThumbList />
                </div>
            </div>
            <FlexResizer settingName={resizeSettingName} type={'h'} />
            <div data-fs="h2" className="flex v" style={{ flex: flexSize['h2'] || 1 }}>
                <SlideItemThumbEditor />
            </div>
        </>
    );
}
