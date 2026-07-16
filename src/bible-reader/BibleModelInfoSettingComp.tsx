import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import type { BibleModelInfoEnum } from '../helper/bible-helpers/bibleModelHelpers';
import {
    bibleModelInfoTitleMap,
    getBibleModelInfoSetting,
    setBibleModelInfoSetting,
} from '../helper/bible-helpers/bibleModelHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import appProvider from '../server/appProvider';
import { useAppCurrentRef } from '../helper/appHooks';

function chooseModel(
    event: any,
    currentModel: BibleModelInfoEnum,
    setModel: (newModel: BibleModelInfoEnum) => void,
) {
    const items: ContextMenuItemType[] = Object.keys(
        bibleModelInfoTitleMap,
    ).map((key) => {
        const title = bibleModelInfoTitleMap[key as BibleModelInfoEnum];
        return {
            menuElement: `${key} - (${title})`,
            title,
            disabled: key === currentModel,
            onSelect: () => {
                setModel(key as BibleModelInfoEnum);
            },
        };
    });
    showAppContextMenu(event, items);
}

export default function BibleModelInfoSettingComp() {
    const model = getBibleModelInfoSetting();
    const setModel1 = useCallback((newModel: BibleModelInfoEnum) => {
        setBibleModelInfoSetting(newModel);
        appProvider.reload();
    }, []);
    const modelRef = useAppCurrentRef(model);
    const setModel1Ref = useAppCurrentRef(setModel1);
    const handleClick = useCallback((event: any) => {
        chooseModel(event, modelRef.current, setModel1Ref.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button
            className={
                'btn btn-sm btn-outline-secondary p-1 text-nowrap ' +
                'd-flex align-items-center gap-1'
            }
            title={`${tran('Change Bible Model Info')} (${bibleModelInfoTitleMap[model]})`}
            onClick={handleClick}
        >
            <i className="bi bi-book" />
            {model}
        </button>
    );
}
