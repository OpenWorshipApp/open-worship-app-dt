import { lazy, useCallback } from 'react';

import { tran } from '../../lang/langHelpers';
import {
    handBibleKeyContextMenuOpening,
    deleteBibleXML,
    useBibleXMLInfo,
} from './bibleXMLHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import { useStateSettingBoolean } from '../../helper/settingHelpers';
import AppSuspenseComp from '../../others/AppSuspenseComp';
import { useAppCurrentRef } from '../../helper/appHooks';
import { warnIfBibleKeyDirty } from './bibleEditorDirtyHelpers';

const BibleXMLDataPreviewCompLazy = lazy(
    () => import('./BibleXMLDataPreviewComp'),
);

export default function BibleXMLInfoComp({
    bibleKey,
    loadBibleKeys,
    filePath,
}: Readonly<{
    bibleKey: string;
    loadBibleKeys: () => void;
    filePath: string;
}>) {
    const [isShowing, setIsShowing] = useStateSettingBoolean(
        `bible-xml-${bibleKey}`,
        false,
    );
    const { bibleInfo } = useBibleXMLInfo(bibleKey);
    const isShowingRef = useAppCurrentRef(isShowing);
    const setIsShowingRef = useAppCurrentRef(setIsShowing);
    const bibleKeyRef = useAppCurrentRef(bibleKey);
    const handleToggleShowing = useCallback(() => {
        // Block collapsing the editor while it has unsaved changes, mirroring the
        // window-reload guard, so edits are not silently discarded.
        if (
            isShowingRef.current &&
            warnIfBibleKeyDirty(
                bibleKeyRef.current,
                'Save or discard unsaved Bible changes before closing ' +
                    'the editor.',
            )
        ) {
            return;
        }
        setIsShowingRef.current(!isShowingRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const loadBibleKeysRef = useAppCurrentRef(loadBibleKeys);
    const handleFileTrashing = useCallback(async (event: any) => {
        event.stopPropagation();
        const isConfirmed = await showAppConfirm(
            'Delete Bible XML',
            `Are you sure to delete bible XML "${bibleKeyRef.current}"?`,
            {
                confirmButtonLabel: 'Yes',
            },
        );
        if (!isConfirmed) {
            return;
        }
        await deleteBibleXML(bibleKeyRef.current);
        loadBibleKeysRef.current();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const title = bibleInfo ? bibleInfo.title : null;
    return (
        <li
            className="list-group-item p-1"
            title={`${title} ${filePath}`}
            onContextMenu={handBibleKeyContextMenuOpening.bind(null, bibleKey)}
        >
            <div className="d-flex w-100">
                <div className="flex-fill d-flex" data-bible-key-ff={bibleKey}>
                    <div
                        className="badge bg-secondary mx-1"
                        style={{
                            margin: 'auto',
                        }}
                    >
                        {bibleKey}
                    </div>{' '}
                    <div
                        className="app-overflow-hidden app-ellipsis"
                        style={{ maxWidth: '450px', margin: 'auto 0' }}
                    >
                        {title}
                    </div>
                </div>
                <div>
                    <div className="btn-group">
                        <button
                            className={`btn btn-${isShowing ? '' : 'outline-'}primary`}
                            title={
                                isShowing
                                    ? tran('Hide Editor')
                                    : tran('Show Editor')
                            }
                            onClick={handleToggleShowing}
                        >
                            <i className="bi bi-pencil" />
                        </button>
                        <button
                            className="btn btn-sm btn-danger"
                            title={tran('Move to Trash')}
                            onClick={handleFileTrashing}
                        >
                            <i className="bi bi-trash" />
                        </button>
                    </div>
                </div>
            </div>
            {isShowing ? (
                <AppSuspenseComp>
                    <BibleXMLDataPreviewCompLazy bibleKey={bibleKey} />
                </AppSuspenseComp>
            ) : null}
        </li>
    );
}
