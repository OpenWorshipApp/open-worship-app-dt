import { lazy, useState } from 'react';

import { InputTextContext } from './InputHandlerComp';
import { SelectedBibleKeyContext } from '../bible-list/bibleHelpers';
import { BibleNotAvailableComp } from './RenderLookupSuggestionComp';
import BibleLookupBodyPreviewerComp from './BibleLookupBodyPreviewerComp';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import { MultiContextRender } from '../helper/MultiContextRender';
import RenderBibleLookupHeaderComp from './RenderBibleLookupHeaderComp';
import RenderExtraButtonsRightComp from './RenderExtraButtonsRightComp';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import { useAppEffect, useAppStateAsync } from '../helper/debuggerHelpers';
import {
    EditingResultContext,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import { EditingResultType } from '../helper/bible-helpers/serverBibleHelpers2';
import LoadingComp from '../others/LoadingComp';
import { getBibleInfo } from '../helper/bible-helpers/bibleInfoHelpers';

const LazyBibleSearchBodyPreviewerComp = lazy(() => {
    return import('../bible-find/BibleFindPreviewerComp');
});

const LOOKUP_ONLINE_SETTING_NAME = 'bible-lookup-online';

export function useSelectedBibleKey() {
    const viewController = useLookupBibleItemControllerContext();
    const [bibleKey, setBibleKey] = useState<string>(
        viewController.selectedBibleItem.bibleKey,
    );
    const [bibleInfo] = useAppStateAsync(() => {
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
    if (bibleInfo === undefined) {
        return { bibleKey };
    }
    return { isValid: bibleInfo !== null, bibleKey };
}

export default function RenderBibleLookupComp() {
    const viewController = useLookupBibleItemControllerContext();
    const [isBibleSearching, setIsBibleSearching] = useStateSettingBoolean(
        LOOKUP_ONLINE_SETTING_NAME,
        false,
    );
    useAppEffect(() => {
        viewController.setIsBibleSearching = setIsBibleSearching;
        return () => {
            viewController.setIsBibleSearching = (_: boolean) => {};
        };
    }, []);
    const [inputText, setInputText] = useState<string>(
        viewController.inputText,
    );
    const [editingResult, setEditingResult] =
        useAppStateAsync<EditingResultType>(() => {
            return viewController.getEditingResult();
        }, []);
    const { isValid: isValidBibleKey, bibleKey } = useSelectedBibleKey();
    useAppEffect(() => {
        viewController.reloadEditingResult = (inputText) => {
            viewController
                .getEditingResult(inputText)
                .then((newEditingResult) => {
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
    }, []);
    if (!isValidBibleKey) {
        return (
            <div className="card w-100 h-100">
                <div className="card-header">
                    <div className="float-end">
                        <RenderExtraButtonsRightComp
                            setIsLookupOnline={setIsBibleSearching}
                            isLookupOnline={isBibleSearching}
                        />
                    </div>
                </div>
                <div className="card-body">
                    {isValidBibleKey === undefined ? (
                        <LoadingComp />
                    ) : (
                        <BibleNotAvailableComp bibleKey={bibleKey} />
                    )}
                </div>
            </div>
        );
    }
    const lookupBody = (
        <EditingResultContext value={editingResult ?? null}>
            <BibleLookupBodyPreviewerComp />
        </EditingResultContext>
    );
    const resizeData = [
        {
            children: {
                render: () => {
                    return lookupBody;
                },
            },
            key: 'h2',
            widgetName: 'Lookup',
        },
        {
            children: LazyBibleSearchBodyPreviewerComp,
            key: 'h1',
            widgetName: 'Bible Online Lookup',
        },
    ];
    return (
        <MultiContextRender
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
            ]}
        >
            <div id="bible-lookup-popup" className="shadow card w-100 h-100">
                <RenderBibleLookupHeaderComp
                    isLookupOnline={isBibleSearching}
                    setIsLookupOnline={setIsBibleSearching}
                />
                <div
                    className={
                        'card-body d-flex w-100 h-100 app-overflow-hidden'
                    }
                >
                    {isBibleSearching ? (
                        <ResizeActorComp
                            flexSizeName="bible-lookup-popup-body"
                            isHorizontal
                            isDisableQuickResize
                            flexSizeDefault={{ h1: ['1'], h2: ['3'] }}
                            dataInput={resizeData}
                        />
                    ) : (
                        lookupBody
                    )}
                </div>
            </div>
        </MultiContextRender>
    );
}
