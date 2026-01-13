import { tran } from '../lang/langHelpers';
import {
    BibleModelInfoEnum,
    bibleModelInfoTitleMap,
    getBibleModelInfoSetting,
    setBibleModelInfoSetting,
} from '../helper/bible-helpers/bibleModelHelpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import appProvider from '../server/appProvider';

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
    const setModel1 = (newModel: BibleModelInfoEnum) => {
        setBibleModelInfoSetting(newModel);
        appProvider.reload();
    };
    return (
        <div className="d-flex mx-1" title={tran('Change Bible Model Info')}>
            <label htmlFor="change-bible-model-info" className="form-label">
                Change Bible Model Info:
            </label>
            <button
                className="btn btn-sm p-1"
                title={bibleModelInfoTitleMap[model]}
                onClick={(event) => {
                    chooseModel(event, model, setModel1);
                }}
            >
                {model}
            </button>
        </div>
    );
}
