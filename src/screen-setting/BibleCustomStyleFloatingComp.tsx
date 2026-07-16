import { lazy } from 'react';
import { createPortal } from 'react-dom';

import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import AppSuspenseComp from '../others/AppSuspenseComp';
import { tran } from '../lang/langHelpers';
import {
    setIsBibleCustomStyleFloatingShowing,
    useBibleCustomStyleFloatingShowing,
} from './bibleCustomStyleFloatingHelpers';

// The heavy style panel (renderToStaticMarkup shadow demos) stays lazy so it is
// only loaded when the user actually opens the floating widget.
const LazyBibleCustomStyleComp = lazy(() => {
    return import('./BibleCustomStyleComp');
});

// Single widget host — mounted once (in the presenter). Any number of
// `BibleCustomStyleFloatingToggleComp` buttons flip the shared store; only this
// one host renders the floating panel, so there is never a duplicate widget.
// It is portaled to the body so an auto-hiding footer that hosts a toggle button
// cannot fade/hide the floating panel.
export default function BibleCustomStyleFloatingComp() {
    const isShowing = useBibleCustomStyleFloatingShowing();
    if (!isShowing) {
        return null;
    }
    const label = tran('Bible Properties');
    return createPortal(
        <FloatingWidgetComp
            title={label}
            onClose={() => {
                setIsBibleCustomStyleFloatingShowing(false);
            }}
            options={{
                width: 420,
                height: 560,
                minWidth: 300,
                minHeight: 220,
            }}
        >
            <AppSuspenseComp>
                <LazyBibleCustomStyleComp />
            </AppSuspenseComp>
        </FloatingWidgetComp>,
        document.body,
    );
}
