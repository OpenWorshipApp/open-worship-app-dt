import { useMemo, useCallback } from 'react';

import type { TabOptionType } from './routeHelpers';
import { goToPath } from './routeHelpers';
import { genTabs } from './layoutHelpers';

export default function LayoutTabRenderComp() {
    const tabs = useMemo(genTabs, []);
    const handleClicking = useCallback(async (tab: TabOptionType) => {
        if (tab.onOpen !== undefined) {
            tab.onOpen();
            return;
        }
        if (tab.preCheck) {
            const isPassed = await tab.preCheck();
            if (!isPassed) {
                return;
            }
        }
        goToPath(tab.routePath);
    }, []);

    return (
        <ul className="nav nav-tabs">
            {tabs.map((tab, i) => {
                const { externalOpen } = tab;
                return (
                    <li key={i} className="nav-item d-flex">
                        <button
                            className="btn btn-sm btn-link nav-link"
                            type="button"
                            onClick={handleClicking.bind(null, tab)}
                        >
                            {tab.title}
                        </button>
                        {externalOpen === undefined ? null : (
                            <button
                                className="btn btn-sm btn-link nav-link ps-0"
                                type="button"
                                style={{ color: externalOpen.color }}
                                title={externalOpen.title}
                                aria-label={externalOpen.title}
                                onClick={externalOpen.onOpen}
                            >
                                <i className="bi bi-box-arrow-up-right" />
                            </button>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
