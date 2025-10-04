import { CrossReferenceType } from '../helper/ai/bibleCrossRefHelpers';
import BibleCrossRefAIRenderFoundItemComp from './BibleCrossRefAIRenderFoundItemComp';

export default function RenderAIBibleCrossReferenceComp({
    crossReference,
    bibleKey,
}: Readonly<{
    crossReference: CrossReferenceType;
    bibleKey: string;
}>) {
    return (
        <div>
            <hr />
            <strong style={{ color: '#88ff00b8' }}>
                {crossReference.title}
            </strong>
            {crossReference.verses.map((item, i) => {
                return (
                    <BibleCrossRefAIRenderFoundItemComp
                        key={item + i}
                        bibleKey={bibleKey}
                        bibleVersesKey={item}
                    />
                );
            })}
        </div>
    );
}
