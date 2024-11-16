import { lazy } from 'react';

import { resizeSettingNames } from './resize-actor/flexSizeHelpers';
import ResizeActor from './resize-actor/ResizeActor';

const SlideList = lazy(() => {
    return import('./slide-list/SlideList');
});
const LyricList = lazy(() => {
    return import('./lyric-list/LyricList');
});
const PlaylistList = lazy(() => {
    return import('./playlist/PlaylistList');
});

export default function AppPresentingLeft() {
    return (
        <ResizeActor fSizeName={resizeSettingNames.appPresentingLeft}
            isHorizontal={false}
            flexSizeDefault={{
                'v1': ['1'],
                'v2': ['1'],
                'v3': ['1'],
            }}
            dataInput={[
                { children: SlideList, key: 'v1', className: 'flex-item' },
                { children: LyricList, key: 'v2', className: 'flex-item' },
                { children: PlaylistList, key: 'v3', className: 'flex-item' },
            ]} />
    );
}
