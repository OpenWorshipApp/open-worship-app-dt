import { lazy } from 'react';

import {
    resizeSettingNames,
    type DataInputType,
    type FlexSizeType,
} from '../resize-actor/flexSizeHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';

const LazyBibleListComp = lazy(() => {
    return import('../bible-list/BibleListComp');
});
const LazyNoteComp = lazy(() => {
    return import('./note/NoteListComp');
});

const flexSizeDefault: FlexSizeType = {
    h1: ['1'],
    h2: ['1'],
};
const dataInput: DataInputType[] = [
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
export default function BibleReadingLeftCom() {
    return (
        <ResizeActorComp
            flexSizeName={resizeSettingNames.bibleReadingLeft}
            isHorizontal
            flexSizeDefault={flexSizeDefault}
            dataInput={dataInput}
        />
    );
}
