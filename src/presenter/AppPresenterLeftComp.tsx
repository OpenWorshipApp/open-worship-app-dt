import { lazy } from 'react';

import { resizeSettingNames } from '../resize-actor/flexSizeHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import { toWidgetLabel } from '../others/labelIconHelpers';

const LazyAppDocumentListComp = lazy(() => {
    return import('../app-document-list/VaryAppDocumentListComp');
});
const LazyPlaylistListComp = lazy(() => {
    return import('../playlist/PlaylistListComp');
});

export default function AppPresenterLeftComp() {
    return (
        <ResizeActorComp
            flexSizeName={resizeSettingNames.appPresenterLeft}
            isHorizontal={false}
            flexSizeDefault={{
                v1: ['3'],
                v2: ['2'],
            }}
            dataInput={[
                {
                    children: LazyAppDocumentListComp,
                    key: 'v1',
                    ...toWidgetLabel('Document List'),
                    className: 'app-flex-item',
                },
                {
                    children: LazyPlaylistListComp,
                    key: 'v2',
                    ...toWidgetLabel('Playlist List'),
                    className: 'app-flex-item',
                },
            ]}
        />
    );
}
