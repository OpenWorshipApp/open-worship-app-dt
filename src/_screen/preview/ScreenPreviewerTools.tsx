import { lazy } from 'react';

import AppSuspenseComp from '../../others/AppSuspenseComp';

const LazyCustomStyleComp = lazy(() => {
    return import('../../screen-setting/CustomStyleComp');
});

export default function ScreenPreviewerTools({
    onClose,
}: Readonly<{
    onClose: () => void;
}>) {
    return (
        <AppSuspenseComp>
            <LazyCustomStyleComp onClose={onClose} />
        </AppSuspenseComp>
    );
}
