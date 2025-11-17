import { lazy } from 'react';

import {
    handBibleKeyContextMenuOpening,
    deleteBibleXML,
    useBibleXMLInfo,
} from './bibleXMLHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import { useStateSettingBoolean } from '../../helper/settingHelpers';
import AppSuspenseComp from '../../others/AppSuspenseComp';

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
    const handleFileTrashing = async (event: any) => {
        event.stopPropagation();
        const isConfirmed = await showAppConfirm(
            'Delete Bible XML',
            `Are you sure to delete bible XML "${bibleKey}"?`,
            {
                confirmButtonLabel: 'Yes',
            },
        );
        if (!isConfirmed) {
            return;
        }
        await deleteBibleXML(bibleKey);
        loadBibleKeys();
    };
    const title = bibleInfo ? bibleInfo.title : null;
    return (
        <li
            className="list-group-item p-1"
            title={`${title} ${filePath}`}
            onContextMenu={handBibleKeyContextMenuOpening.bind(null, bibleKey)}
        >
            <div className="d-flex w-100">
                <div className="flex-fill d-flex" data-bible-key={bibleKey}>
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
                            title={isShowing ? '`Hide Editor' : '`Show Editor'}
                            onClick={() => {
                                setIsShowing(!isShowing);
                            }}
                        >
                            <i className="bi bi-pencil" />
                        </button>
                        <button
                            className="btn btn-sm btn-danger"
                            title="`Move to Trash"
                            onClick={handleFileTrashing}
                        >
                            <i className="bi bi-trash" />
                        </button>
                    </div>
                </div>
            </div>
            {isShowing ? (
                <AppSuspenseComp>
                    <BibleXMLDataPreviewCompLazy
                        bibleKey={bibleKey}
                        loadBibleKeys={loadBibleKeys}
                    />
                </AppSuspenseComp>
            ) : null}
        </li>
    );
}
