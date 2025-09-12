import {
    handBibleKeyContextMenuOpening,
    deleteBibleXML,
} from './bibleXMLHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import { useStateSettingBoolean } from '../../helper/settingHelpers';
import BibleXMLInfoPreviewComp from './BibleXMLInfoPreviewComp';

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
                            className="btn btn-danger"
                            onClick={handleFileTrashing}
                        >
                            Move to Trash
                        </button>
                    </div>
                </div>
            </div>
            {isShowing ? (
                <BibleXMLInfoPreviewComp
                    bibleKey={bibleKey}
                    loadBibleKeys={loadBibleKeys}
                />
            ) : null}
        </li>
    );
}
