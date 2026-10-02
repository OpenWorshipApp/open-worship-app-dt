import { lazy, useCallback, useMemo, useRef, useState } from 'react';

import { InputTextContext } from './InputHandlerComp';
import { SelectedBibleKeyContext } from '../bible-list/bibleHelpers';
import { BibleNotAvailableComp } from './RenderLookupSuggestionComp';
import BibleLookupBodyPreviewerComp from './BibleLookupBodyPreviewerComp';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import { MultiContextRenderComp } from '../helper/MultiContextRenderComp';
import RenderBibleLookupHeaderComp from './RenderBibleLookupHeaderComp';
import RenderExtraButtonsRightComp from './RenderExtraButtonsRightComp';
import { getSetting } from '../helper/settingHelpers';
import { useAppEffect, useAppStateAsync } from '../helper/appHooks';
import {
    EditingResultContext,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import type { EditingResultType } from '../helper/bible-helpers/bibleLogicHelpers2';
import LoadingComp from '../others/LoadingComp';
import { getBibleInfo } from '../helper/bible-helpers/bibleInfoHelpers';
import { registerBibleListChangedListener } from '../helper/bible-helpers/bibleListChangeHelpers';
import appProvider from '../server/appProvider';
import { toWidgetLabel } from '../others/labelIconHelpers';
import type { DataInputType } from '../resize-actor/flexSizeHelpers';
import { getFlexSizeSetting } from '../resize-actor/flexSizeHelpers';
import {
    getWidgetEntries,
    subscribeWidgetsChanged,
    toggleWidget,
    toWidgetId,
} from '../resize-actor/widgetRegistry';
import {
    ADVANCE_LOOKUP_WIDGET_KEY,
    genLookupFlexSizeDefault,
    migrateLookupLayout,
} from './lookupLayoutHelpers';

const LazyBibleSearchBodyPreviewerComp = lazy(() => {
    return import('../bible-find/BibleFindPreviewerComp');
});

const LOOKUP_ONLINE_SETTING_NAME = 'bible-lookup-online';

export function useSelectedBibleKey() {
    const viewController = useLookupBibleItemControllerContext();
    const [bibleKey, setBibleKey] = useState<string>(
        viewController.selectedBibleItem.bibleKey,
    );
    const [bibleInfo, setBibleInfo] = useAppStateAsync(() => {
        return getBibleInfo(bibleKey);
    }, [bibleKey]);
    useAppEffect(() => {
        viewController.setBibleKey = (newBibleKey: string) => {
            setBibleKey(newBibleKey);
        };
        return () => {
            viewController.setBibleKey = (_: string) => {};
        };
    }, []);
    const isUnavailable = bibleInfo === null;
    useAppEffect(() => {
        if (!isUnavailable) {
            return;
        }
        // The answer above is kept, so "not available" would stand even after
        // the bible is created in Settings (its key picker leaves the current
        // key out, so it cannot be re-picked either). Ask again when another
        // window changes the installed bibles, and when this window is come
        // back to — the second covers a file copied in by hand.
        let isActive = true;
        const recheck = async () => {
            const newBibleInfo = await getBibleInfo(bibleKey, true);
            if (isActive && newBibleInfo !== null) {
                setBibleInfo(newBibleInfo);
            }
        };
        const unregister = registerBibleListChangedListener(recheck);
        globalThis.addEventListener('focus', recheck);
        return () => {
            isActive = false;
            unregister();
            globalThis.removeEventListener('focus', recheck);
        };
    }, [isUnavailable, bibleKey]);
    if (bibleInfo === undefined) {
        return { bibleKey };
    }
    return { isValid: bibleInfo !== null, bibleKey };
}
const advanceLookupSettingKey =
    LOOKUP_ONLINE_SETTING_NAME +
    '-' +
    appProvider.currentHomePage.split('/')[0];

export default function RenderBibleLookupComp({
    flexSizeName = 'bible-lookup-container-body',
    leadingWidgets,
}: Readonly<{
    flexSizeName?: string;
    leadingWidgets?: DataInputType[];
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const hasBibleAndNotes = !!leadingWidgets?.length;
    const flexSizeDefault = useMemo(() => {
        return genLookupFlexSizeDefault(hasBibleAndNotes);
    }, [hasBibleAndNotes]);
    const [isAdvanceLookupOpened, setAdvanceLookupVisible] = useState(() => {
        migrateLookupLayout(
            flexSizeName,
            hasBibleAndNotes,
            getSetting(advanceLookupSettingKey) === 'true',
        );
        return !getFlexSizeSetting(flexSizeName, flexSizeDefault)[
            ADVANCE_LOOKUP_WIDGET_KEY
        ][1];
    });
    const advanceWidgetId = toWidgetId(flexSizeName, ADVANCE_LOOKUP_WIDGET_KEY);
    const toggleAdvanceLookup = useCallback(() => {
        toggleWidget(advanceWidgetId);
    }, [advanceWidgetId]);
    useAppEffect(() => {
        const update = () => {
            const entry = getWidgetEntries().find(({ id }) => {
                return id === advanceWidgetId;
            });
            if (entry) {
                setAdvanceLookupVisible(!entry.isHidden);
            }
        };
        update();
        return subscribeWidgetsChanged(update);
    }, [advanceWidgetId]);
    const setIsAdvanceLookupOpened = useCallback(
        (isOpen: boolean) => {
            const entry = getWidgetEntries().find(
                ({ id }) => id === advanceWidgetId,
            );
            if (entry && entry.isHidden === isOpen) {
                toggleWidget(advanceWidgetId);
            }
        },
        [advanceWidgetId],
    );
    useAppEffect(() => {
        viewController.setIsAdvanceLookupOpened = setIsAdvanceLookupOpened;
        return () => {
            viewController.setIsAdvanceLookupOpened = (_: boolean) => {};
        };
    }, [viewController, setIsAdvanceLookupOpened]);
    const [inputText, setInputText] = useState<string>(
        viewController.inputText,
    );
    const [editingResult, setEditingResult] =
        useAppStateAsync<EditingResultType>(() => {
            return viewController.getEditingResult();
        }, []);
    const { isValid: isValidBibleKey, bibleKey } = useSelectedBibleKey();
    // Every keystroke asks for a new result, and the lookups resolve in
    // whatever order their parsing finishes -- `Psal` can land AFTER
    // `Psalm 23:1`. Applying each one as it arrived left the editing pane
    // frozen on a half-typed book (`Psal`, one `Psalm` button) while the box
    // and the other view read the full reference. Only the newest request may
    // set the result.
    const latestReloadIdRef = useRef(0);
    useAppEffect(() => {
        viewController.reloadEditingResult = (inputText) => {
            latestReloadIdRef.current += 1;
            const reloadId = latestReloadIdRef.current;
            viewController
                .getEditingResult(inputText)
                .then((newEditingResult) => {
                    if (reloadId !== latestReloadIdRef.current) {
                        return;
                    }
                    setEditingResult(newEditingResult);
                });
        };
        viewController.setInputText = async (newInputText: string) => {
            setInputText(newInputText);
            viewController.reloadEditingResult(newInputText);
        };
        return () => {
            viewController.setInputText = (_: string) => {};
            viewController.reloadEditingResult = (_: string) => {};
        };
    }, [viewController]);
    const lookupBody = isValidBibleKey ? (
        <BibleLookupBodyPreviewerComp />
    ) : isValidBibleKey === undefined ? (
        <LoadingComp />
    ) : (
        <BibleNotAvailableComp bibleKey={bibleKey} />
    );
    const resizeData = [
        ...(leadingWidgets ?? []),
        {
            children: {
                render: () => {
                    return lookupBody;
                },
            },
            key: 'h2',
            ...toWidgetLabel('Bible Lookup'),
        },
        {
            children: LazyBibleSearchBodyPreviewerComp,
            key: ADVANCE_LOOKUP_WIDGET_KEY,
            ...toWidgetLabel('Advance Lookup'),
        },
    ];
    return (
        <MultiContextRenderComp
            contexts={[
                {
                    context: SelectedBibleKeyContext,
                    value: bibleKey,
                },
                {
                    context: InputTextContext,
                    value: {
                        inputText,
                    },
                },
                {
                    context: EditingResultContext,
                    value: editingResult ?? null,
                },
            ]}
        >
            <div
                id="bible-lookup-container"
                className={
                    'shadow card w-100 h-100 overflow-hidden' +
                    ' card app-zero-border-radius'
                }
            >
                {isValidBibleKey ? (
                    <RenderBibleLookupHeaderComp
                        isAdvanceLookupOpened={isAdvanceLookupOpened}
                        toggleAdvanceLookup={toggleAdvanceLookup}
                    />
                ) : (
                    <div className="card-header d-flex justify-content-end">
                        <RenderExtraButtonsRightComp
                            toggleAdvanceLookup={toggleAdvanceLookup}
                            isAdvanceLookupOpened={isAdvanceLookupOpened}
                        />
                    </div>
                )}
                <div
                    className={'card-body d-flex w-100 app-overflow-hidden'}
                    style={{
                        height: 'calc(100% - 38px)',
                    }}
                >
                    <ResizeActorComp
                        flexSizeName={flexSizeName}
                        isHorizontal
                        flexSizeDefault={flexSizeDefault}
                        dataInput={resizeData}
                    />
                </div>
            </div>
        </MultiContextRenderComp>
    );
}
