import { CrossReferenceType } from '../helper/ai/bibleCrossRefHelpers';
import BibleCrossRefAIRenderFoundItemComp from './BibleCrossRefAIRenderFoundItemComp';

export default function RenderAIBibleCrossReferenceComp({
    crossReference,
}: Readonly<{
    crossReference: CrossReferenceType;
}>) {
    const { title, titleEn, verses } = crossReference;
    return (
        <div>
            <hr />
            <strong
                className="app-selectable-text"
                title={titleEn}
                style={{ color: '#88ff00b8' }}
            >
                <span dangerouslySetInnerHTML={{ __html: title }} />
            </strong>
            {verses.map((item, i) => {
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
