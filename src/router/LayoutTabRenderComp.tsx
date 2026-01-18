import { useMemo, useCallback } from 'react';

import { TabOptionType, goToPath } from './routeHelpers';
import { genTabs } from './popupLayoutHelpers';

export default function LayoutTabRenderComp() {
    const tabs = useMemo(genTabs, []);
    const handleClicking = useCallback(async (tab: TabOptionType) => {
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
                return (
                    <li key={i} className="nav-item">
                        <button
                            className="btn btn-sm btn-link nav-link"
                            onClick={handleClicking.bind(null, tab)}
                        >
                            {tab.title}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
