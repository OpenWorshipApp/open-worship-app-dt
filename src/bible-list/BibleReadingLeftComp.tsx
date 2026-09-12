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
function genDataInput(
    keyPrefix: string,
    biblesLabel: string,
    bibleNotesLabel: string,
): DataInputType[] {
    return [
        {
            children: LazyBibleListComp,
            key: `${keyPrefix}1`,
            ...toWidgetLabel(biblesLabel),
        },
        {
            children: LazyNoteComp,
            key: `${keyPrefix}2`,
            ...toWidgetLabel(bibleNotesLabel),
        },
    ];
}

/**
 * The names are props, and for the same reason `BibleReaderComp`'s
 * `bibleAndNotesLabel` is one: the bible-lookup popup overlays the presenter,
 * whose right column already mounts this component. Two mounts on one page must
 * differ in BOTH — the label, or the View menu shows two identical checkboxes
 * (`checkAreNamesUnique`), and the `flexSizeName`, or the two panes collide on
 * one `flexSizeName::key` widget id, so one silently takes over the other's menu
 * entry and un-mounting it unregisters the survivor's.
 *
 * The labels are `tran` KEYS, never composed strings — a key that is not in the
 * dictionary verbatim throws in dev under km.
 */
export default function BibleReadingLeftComp({
    flexSizeName = resizeSettingNames.bibleReadingLeft,
    biblesLabel = 'Bibles',
    bibleNotesLabel = 'Bible Notes',
}: Readonly<{
    flexSizeName?: string;
    biblesLabel?: string;
    bibleNotesLabel?: string;
}>) {
    const hDataInput = useMemo(() => {
        return genDataInput('h', biblesLabel, bibleNotesLabel);
    }, [biblesLabel, bibleNotesLabel]);
    const vDataInput = useMemo(() => {
        return genDataInput('v', biblesLabel, bibleNotesLabel);
    }, [biblesLabel, bibleNotesLabel]);
    return (
        <ResizeActorDynamicComp
            flexSizeName={flexSizeName}
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
