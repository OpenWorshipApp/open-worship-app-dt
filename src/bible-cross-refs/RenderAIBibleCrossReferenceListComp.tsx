import type { CrossReferenceType } from '../helper/ai/bibleCrossRefHelpers';
import { tran } from '../lang/langHelpers';
import RenderAIBibleCrossReferenceComp from './RenderAIBibleCrossReferenceComp';

export default function RenderAIBibleCrossReferenceListComp({
    index,
    bibleCrossRef,
}: Readonly<{
    index: number;
    bibleCrossRef: CrossReferenceType[];
}>) {
    const className = index > 0 ? 'app-xref-continued' : undefined;
    if (bibleCrossRef.length === 0) {
        return (
            <div className={className}>
                <div className="app-xref-status">
                    {tran('No cross references for this verse')}
                </div>
            </div>
        );
    }
    const verseCount = bibleCrossRef.reduce((total, item) => {
        return total + item.verses.length;
    }, 0);
    return (
        <div className={className}>
            {/* What there is to read, before the reading starts. */}
            <div className="app-xref-meta app-data">
                {bibleCrossRef.length} {tran('Themes')} · {verseCount}{' '}
                {tran('Verses')}
            </div>
            <div className="app-xref-themes">
                {bibleCrossRef.map((item) => {
                    return (
                        <RenderAIBibleCrossReferenceComp
                            key={item.title}
                            crossReference={item}
                        />
                    );
                })}
            </div>
        </div>
    );
}
