import { lazy, useMemo } from 'react';

import {
    resizeSettingNames,
    type DataInputType,
    type FlexSizeType,
} from '../resize-actor/flexSizeHelpers';
import ResizeActorDynamicComp from '../resize-actor/ResizeActorDynamicComp';
import { toWidgetLabel } from '../others/labelIconHelpers';

const LazyBibleListComp = lazy(() => {
    return import('./BibleListComp');
});
const LazyNoteComp = lazy(() => {
    return import('./note/BibleNoteListComp');
});

const hFlexSizeDefault: FlexSizeType = {
    h1: ['1'],
    h2: ['1'],
};
const vFlexSizeDefault: FlexSizeType = {
    v1: ['1'],
    v2: ['1'],
};
// Built per render, not once at module scope: `tran()` throws in dev when the
// locale's language data has not been loaded into the cache yet, and module
// evaluation happens well before that — which blanks the whole page in km.
function genDataInput(keyPrefix: string): DataInputType[] {
    return [
        {
            children: LazyBibleListComp,
            key: `${keyPrefix}1`,
            ...toWidgetLabel('Bibles'),
        },
        {
            children: LazyNoteComp,
            key: `${keyPrefix}2`,
            ...toWidgetLabel('Bible Notes'),
        },
    ];
}
export default function BibleReadingLeftComp() {
    const hDataInput = useMemo(() => {
        return genDataInput('h');
    }, []);
    const vDataInput = useMemo(() => {
        return genDataInput('v');
    }, []);
    return (
        <ResizeActorDynamicComp
            flexSizeName={resizeSettingNames.bibleReadingLeft}
            data={{
                minWidth: 400,
                horizontal: {
                    flexSizeDefault: hFlexSizeDefault,
                    dataInput: hDataInput,
                },
                vertical: {
                    flexSizeDefault: vFlexSizeDefault,
                    dataInput: vDataInput,
                },
            }}
        />
    );
}
