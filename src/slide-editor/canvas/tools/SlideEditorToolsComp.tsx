import './SlideEditorToolsComp.scss';

import { lazy, useMemo } from 'react';

import { useStateSettingString } from '../../../helper/settingHelpers';
import TabRenderComp, { genTabBody } from '../../../others/TabRenderComp';
import SlideEditorPropertiesComp from './SlideEditorPropertiesComp';
import {
    useEditingCanvasItemAndSetterContext,
    useSelectedCanvasItemsAndSetterContext,
} from '../CanvasItem';
import { genLabelIcon } from '../../../others/labelIconHelpers';
import { tran } from '../../../lang/langHelpers';

const LazyToolCanvasItemsComp = lazy(() => {
    return import('./ToolCanvasItemsComp');
});

// The English keys only: a label is translated in render, never at load.
const tabTypeList = [
    ['p', 'Properties'],
    ['c', 'Canvas Items'],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0];

// Icon and words, the words in a span of their own so a narrow Tools column
// can cut the INACTIVE tab to its icon and an ellipsis (F-12 of robot run
// 20261120-2021: at the default width the second tab read "Canv" behind the
// strip's scroll edge). The whole name stays its tooltip.
function genToolsTabTitle(labelKey: string) {
    const label = tran(labelKey);
    return (
        <span className="tools-tab-title" title={label}>
            {genLabelIcon(labelKey)}
            {label}
        </span>
    );
}
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
                    className="tools-tabs"
                    tabs={tabTypeList.map(([key, labelKey]) => {
                        return {
                            key,
                            title: genToolsTabTitle(labelKey),
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
