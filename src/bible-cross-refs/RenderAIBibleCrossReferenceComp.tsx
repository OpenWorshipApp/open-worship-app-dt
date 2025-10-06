import { CrossReferenceType } from '../helper/ai/bibleCrossRefHelpers';
import BibleCrossRefAIRenderFoundItemComp from './BibleCrossRefAIRenderFoundItemComp';

export default function RenderAIBibleCrossReferenceComp({
    crossReference,
}: Readonly<{
    crossReference: CrossReferenceType;
}>) {
    return (
        <div>
            <hr />
            <strong
                className="app-selectable-text"
                style={{ color: '#88ff00b8' }}
            >
                {crossReference.title}
            </strong>
            {crossReference.verses.map((item, i) => {
                return (
                    <BibleCrossRefAIRenderFoundItemComp
                        key={item + i}
                        bibleVersesKey={item}
                    />
                );
            })}
        </div>
    );
}
