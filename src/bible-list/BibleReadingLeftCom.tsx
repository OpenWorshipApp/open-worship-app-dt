import { lazy } from 'react';

import {
    resizeSettingNames,
    type DataInputType,
    type FlexSizeType,
} from '../resize-actor/flexSizeHelpers';
import ResizeActorDynamicComp from '../resize-actor/ResizeActorDynamicComp';

const LazyBibleListComp = lazy(() => {
    return import('../bible-list/BibleListComp');
});
const LazyNoteComp = lazy(() => {
    return import('./note/NoteListComp');
});

const hFlexSizeDefault: FlexSizeType = {
    h1: ['1'],
    h2: ['1'],
};
const hDataInput: DataInputType[] = [
    {
        children: LazyBibleListComp,
        key: 'h1',
        widgetName: 'Bibles',
    },
    {
        children: LazyNoteComp,
        key: 'h2',
        widgetName: 'Notes',
    },
];
const vFlexSizeDefault: FlexSizeType = {
    v1: ['1'],
    v2: ['1'],
};
const vDataInput: DataInputType[] = [
    {
        children: LazyBibleListComp,
        key: 'v1',
        widgetName: 'Bibles',
    },
    {
        children: LazyNoteComp,
        key: 'v2',
        widgetName: 'Notes',
    },
];
export default function BibleReadingLeftCom() {
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
