import { lazy } from 'react';

import {
    handBibleKeyContextMenuOpening,
    deleteBibleXML,
    useBibleXMLInfo,
} from './bibleXMLHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import { useStateSettingBoolean } from '../../helper/settingHelpers';
import AppSuspenseComp from '../../others/AppSuspenseComp';

const BibleXMLInfoPreviewCompLazy = lazy(
    () => import('./BibleXMLInfoPreviewComp'),
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
            className="list-group-item"
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
                        className="overflow-hidden app-ellipsis"
                        style={{ maxWidth: '300px', margin: 'auto 0' }}
                    >
                        {title ? `(${title})` : null}
                    </div>
                </div>
                <div>
                    <div className="btn-group">
                        <button
                            className={`btn btn-${isShowing ? '' : 'outline-'}primary`}
                            onClick={() => {
                                setIsShowing(!isShowing);
                            }}
                        >
                            `Edit
                        </button>
                        <button
                            className="btn btn-sm btn-danger"
                            onClick={handleFileTrashing}
                        >
                            `Move to Trash
                        </button>
                    </div>
                </div>
            </div>
            {isShowing ? (
                <AppSuspenseComp>
                    <BibleXMLInfoPreviewCompLazy
                        bibleKey={bibleKey}
                        loadBibleKeys={loadBibleKeys}
                    />
                </AppSuspenseComp>
            ) : null}
        </li>
    );
}
