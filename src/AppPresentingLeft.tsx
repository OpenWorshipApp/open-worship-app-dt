import React from 'react';
import { resizeSettingNames } from './resize-actor/flexSizeHelpers';
import ResizeActor from './resize-actor/ResizeActor';

const SlideList = React.lazy(() => {
    return import('./slide-list/SlideList');
});
const LyricList = React.lazy(() => {
    return import('./lyric-list/LyricList');
});
const PlaylistList = React.lazy(() => {
    return import('./playlist/PlaylistList');
});

export default function AppPresentingLeft() {
    return (
        <ResizeActor fSizeName={resizeSettingNames.appPresentingLeft}
            flexSizeDefault={{
                'v1': ['1'],
                'v2': ['1'],
                'v3': ['1'],
            }}
            resizeKinds={['v', 'v']}
            dataInput={[
                [SlideList, 'v1', 'flex-item'],
                [LyricList, 'v2', 'flex-item'],
                [PlaylistList, 'v3', 'flex-item'],
            ]} />
    );
}
