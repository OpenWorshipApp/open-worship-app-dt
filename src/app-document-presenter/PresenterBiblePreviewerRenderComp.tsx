import { lazy } from 'react';

import AppSuspenseComp from '../others/AppSuspenseComp';
import BibleCustomStyleFloatingToggleComp from '../screen-setting/BibleCustomStyleFloatingToggleComp';

const LazyBiblePreviewerRenderComp = lazy(() => {
    return import('../bible-reader/BiblePreviewerRenderComp');
});

export default function PresenterBiblePreviewerRenderComp() {
    return (
        <div className="w-100 h-100">
            <AppSuspenseComp>
                <LazyBiblePreviewerRenderComp
                    footerExtra={<BibleCustomStyleFloatingToggleComp />}
                />
            </AppSuspenseComp>
        </div>
    );
}
