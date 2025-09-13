import { useBibleXMLKeys } from './bibleXMLHelpers';
import BibleXMLImportComp from './BibleXMLImportComp';
import BibleXMLListComp from './BibleXMLListComp';

export default function SettingBibleXMLComp() {
    const { bibleKeysMap, isPending, loadBibleKeys } = useBibleXMLKeys();
    return (
        <div
            className="w-100 app-border-white-round p-2 d-flex flex-wrap justify-content-center"
            style={{
                overflow: 'auto',
            }}
        >
            <div className="m-1" style={{ minWidth: '400px' }}>
                <BibleXMLImportComp loadBibleKeys={loadBibleKeys} />
            </div>
            <div
                className="app-border-white-round m-1 p-1"
                style={{ minWidth: '600px' }}
            >
                <BibleXMLListComp
                    isPending={isPending}
                    bibleKeysMap={bibleKeysMap}
                    loadBibleKeys={loadBibleKeys}
                />
            </div>
        </div>
    );
}
