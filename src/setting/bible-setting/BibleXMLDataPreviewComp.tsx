import BibleXMLInfoPreviewComp from './BibleXMLInfoPreviewComp';

export default function BibleXMLDataPreviewComp({
    bibleKey,
    loadBibleKeys,
}: Readonly<{
    bibleKey: string;
    loadBibleKeys: () => void;
}>) {
    return (
        <BibleXMLInfoPreviewComp
            bibleKey={bibleKey}
            loadBibleKeys={loadBibleKeys}
        />
    );
}
