import './SlideEditorToolsComp.scss';

import { lazy } from 'react';

import { useStateSettingString } from '../../../helper/settingHelpers';
import TabRenderComp, { genTabBody } from '../../../others/TabRenderComp';
import SlideEditorPropertiesComp from './SlideEditorPropertiesComp';
import { useSelectedCanvasItemsAndSetterContext } from '../CanvasItem';
import { tran } from '../../../lang/langHelpers';

const LazyToolCanvasItemsComp = lazy(() => {
    return import('./ToolCanvasItemsComp');
});

const tabTypeList = [
    ['p', tran('Properties')],
    ['c', tran('Canvas Items')],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0];
export default function SlideEditorToolsComp() {
    const { canvasItems: selectedCanvasItems } =
        useSelectedCanvasItemsAndSetterContext();
    const [tabKey, setTabKey] = useStateSettingString<TabKeyType>(
        'editor-tools-tab',
        'p',
    );
    return (
        <div
            className={
                'app-tools d-flex flex-column w-100 h-100 app-overflow-hidden'
            }
        >
            <div className="tools-header d-flex">
                <TabRenderComp<TabKeyType>
                    tabs={tabTypeList.map(([key, name]) => {
                        return {
                            key,
                            title: name,
                        };
                    })}
                    activeTab={tabKey}
                    setActiveTab={setTabKey}
                />
            </div>
            <div
                className="tools-body w-100 h-100"
                style={{
                    overflow: 'auto',
                }}
            >
                {tabKey === 'p' ? (
                    <SlideEditorPropertiesComp
                        canvasItems={selectedCanvasItems}
                    />
                ) : null}
                {genTabBody<TabKeyType>(tabKey, ['c', LazyToolCanvasItemsComp])}
            </div>
        </div>
    );
}
