import { useMemo, useState } from 'react';

import LoadingComp from '../../others/LoadingComp';
import {
    handBibleInfoContextMenuOpening,
    handBibleKeyContextMenuOpening,
    updateBibleXMLInfo,
    useBibleXMLInfo,
    deleteBibleXML,
    cacheBibleXMLData,
    getBibleXMLDataFromKey,
} from './bibleXMLHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { useStateSettingBoolean } from '../../helper/settingHelpers';

function PreviewBibleXMLInfoComp({
    bibleKey,
    loadBibleKeys,
}: Readonly<{
    bibleKey: string;
    loadBibleKeys: () => void;
}>) {
    const { bibleInfo, setBibleInfo, isPending } = useBibleXMLInfo(bibleKey);
    const [isChanged, setIsChanged] = useState(false);
    if (isPending) {
        return <LoadingComp />;
    }
    if (bibleInfo === null) {
        return null;
    }
    return (
        <div
            className="app-border-white-round p-2"
            onContextMenu={(event) => {
                handBibleInfoContextMenuOpening(
                    event,
                    bibleInfo,
                    (newOutputJson) => {
                        setBibleInfo(newOutputJson);
                        setIsChanged(true);
                    },
                );
            }}
        >
            <button
                className="btn btn-success"
                style={{
                    position: 'absolute',
                }}
                disabled={!isChanged}
                onClick={() => {
                    updateBibleXMLInfo(bibleInfo);
                    loadBibleKeys();
                }}
            >
                Save
            </button>
            <textarea
                className="w-100 mt-5"
                style={{
                    height: '500px',
                }}
                value={JSON.stringify(bibleInfo, null, 2)}
                onChange={(event) => {
                    try {
                        setBibleInfo(JSON.parse(event.target.value));
                        setIsChanged(true);
                    } catch (_error) {}
                }}
            />
        </div>
    );
}

function BibleXMLInfoComp({
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
    const handleReloading = async (event: any) => {
        event.stopPropagation();
        const jsonData = await getBibleXMLDataFromKey(bibleKey);
        if (jsonData === null) {
            showSimpleToast('Loading', 'Failed to load Bible XML');
            return;
        }
        await cacheBibleXMLData(jsonData);
        showSimpleToast('Loading', 'Bible XML reloaded');
    };
    return (
        <li
            className="list-group-item"
            title={filePath}
            onContextMenu={handBibleKeyContextMenuOpening.bind(null, bibleKey)}
        >
            <div className="d-flex w-100">
                <div className="flex-fill" data-bible-key={bibleKey}>
                    {bibleKey}
                </div>
                <div>
                    <div className="btn-group">
                        <button
                            className={`btn btn-${isShowing ? '' : 'outline-'}primary`}
                            onClick={() => {
                                setIsShowing(!isShowing);
                            }}
                        >
                            Edit
                        </button>
                        <button
                            className="btn btn-info"
                            onClick={handleReloading}
                        >
                            Reload Cache
                        </button>
                        <button
                            className="btn btn-danger"
                            onClick={handleFileTrashing}
                        >
                            Move to Trash
                        </button>
                    </div>
                </div>
            </div>
            {isShowing ? (
                <PreviewBibleXMLInfoComp
                    bibleKey={bibleKey}
                    loadBibleKeys={loadBibleKeys}
                />
            ) : null}
        </li>
    );
}

export default function BibleXMLListComp({
    isPending,
    bibleKeysMap,
    loadBibleKeys,
}: Readonly<{
    isPending: boolean;
    bibleKeysMap: { [key: string]: string } | null;
    loadBibleKeys: () => void;
}>) {
    if (isPending) {
        return <LoadingComp />;
    }
    const buttons = (
        <>
            <button
                title="Refresh"
                className="btn btn-info"
                onClick={() => {
                    loadBibleKeys();
                }}
            >
                <i className="bi bi-arrow-clockwise" /> Refresh
            </button>
            <a
                className="btn btn-secondary ms-2"
                href={'https://www.google.com/search?q=holy+bible+xml+format'}
                target="_blank"
            >
                Search XML
            </a>
        </>
    );
    if (bibleKeysMap === null || Object.keys(bibleKeysMap).length === 0) {
        return <div>No Bible XML files {buttons}</div>;
    }
    const bibleKeys = useMemo(() => {
        const localBibleKeys = Object.keys(bibleKeysMap).sort((a, b) =>
            a.localeCompare(b),
        );
        return localBibleKeys;
    }, [bibleKeysMap]);
    return (
        <>
            <h3>Bibles XML {buttons}</h3>
            <div className="w-100">
                <ul className="list-group d-flex flex-fill">
                    {bibleKeys.map((bibleKey) => {
                        return (
                            <BibleXMLInfoComp
                                key={bibleKey}
                                bibleKey={bibleKey}
                                loadBibleKeys={loadBibleKeys}
                                filePath={bibleKeysMap[bibleKey]}
                            />
                        );
                    })}
                </ul>
            </div>
        </>
    );
}
