import './SlideEditorToolsComp.scss';

import { lazy, useMemo } from 'react';

import { useStateSettingString } from '../../../helper/settingHelpers';
import TabRenderComp, { genTabBody } from '../../../others/TabRenderComp';
import SlideEditorPropertiesComp from './SlideEditorPropertiesComp';
import {
    useEditingCanvasItemAndSetterContext,
    useSelectedCanvasItemsAndSetterContext,
} from '../CanvasItem';
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
    const { canvasItem: editingCanvasItem } =
        useEditingCanvasItemAndSetterContext();
    // While a box is being text-edited it is not in `selectedCanvasItems`, but
    // the properties panel should still show its properties. Fall back to the
    // editing item when there is no explicit selection.
    const propertyCanvasItems = useMemo(() => {
        if (selectedCanvasItems.length > 0) {
            return selectedCanvasItems;
        }
        return editingCanvasItem !== null ? [editingCanvasItem] : [];
    }, [selectedCanvasItems, editingCanvasItem]);
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
                    activeTabs={[tabKey]}
                    setActiveTab={(key) => setTabKey(key)}
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
                        canvasItems={propertyCanvasItems}
                    />
                ) : null}
                {genTabBody<TabKeyType>(tabKey, ['c', LazyToolCanvasItemsComp])}
            </div>
        </div>
    );
}
