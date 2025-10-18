import {
    CrossReferenceType,
    useBibleKeyContext,
} from '../helper/ai/bibleCrossRefHelpers';
import BibleCrossRefAIRenderFoundItemComp from './BibleCrossRefAIRenderFoundItemComp';

export default function RenderAIBibleCrossReferenceComp({
    crossReference,
}: Readonly<{
    crossReference: CrossReferenceType;
}>) {
    const bibleKey = useBibleKeyContext();
    const { title, titleEn, verses } = crossReference;
    return (
        <div>
            <strong
                className="app-selectable-text"
                data-bible-key={bibleKey}
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
            <hr />
        </div>
    );
}
