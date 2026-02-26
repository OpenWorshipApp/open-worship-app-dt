import { lazy } from 'react';

import { resizeSettingNames } from '../resize-actor/flexSizeHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import { MultiContextRender } from '../helper/MultiContextRender';
import { useEditingCanvasContextValue } from './canvasEditingHelpers';
import SlideEditorCanvasComp from './canvas/SlideEditorCanvasComp';

const LazySlideEditorToolsComp = lazy(() => {
    return import('./canvas/tools/SlideEditorToolsComp');
});

export default function SlideEditorComp() {
    const contextData = useEditingCanvasContextValue();
    return (
        <div className="slide-editor w-100 h-100 app-overflow-hidden">
            <ResizeActorComp
                flexSizeName={resizeSettingNames.slideEditor}
                isHorizontal
                flexSizeDefault={{
                    h1: ['5'],
                    h2: ['1'],
                }}
                dataInput={[
                    {
                        children: {
                            render: () => {
                                return (
                                    <SlideEditorCanvasComp
                                        contextData={contextData}
                                    />
                                );
                            },
                        },
                        key: 'h1',
                        widgetName: 'Slide Editor Canvas',
                        className: 'flex-item',
                    },
                    {
                        children: {
                            render: () => {
                                return (
                                    <MultiContextRender
                                        contexts={contextData.contextValue}
                                    >
                                        <LazySlideEditorToolsComp />
                                    </MultiContextRender>
                                );
                            },
                        },
                        key: 'h2',
                        widgetName: 'Tools',
                        className: 'flex-item',
                    },
                ]}
            />
        </div>
    );
}
