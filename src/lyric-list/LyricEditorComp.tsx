import { lazy } from 'react';

import ResizeActorComp from '../resize-actor/ResizeActorComp';

const LazyLyricEditorComp = lazy(() => {
    return import('./LyricEditorIDEComp');
});
const LazyLyricPreviewerComp = lazy(() => {
    return import('./LyricPreviewerComp');
});

export default function LyricEditorComp() {
    return (
        <ResizeActorComp
            flexSizeName={'lyric-previewer'}
            isHorizontal
            flexSizeDefault={{
                h1: ['1'],
                h2: ['1'],
            }}
            dataInput={[
                {
                    children: LazyLyricEditorComp,
                    key: 'h1',
                    widgetName: 'Editor',
                },
                {
                    children: LazyLyricPreviewerComp,
                    key: 'h2',
                    widgetName: 'Previewer',
                },
            ]}
        />
    );
}
