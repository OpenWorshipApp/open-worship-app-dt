import type { CrossReferenceType } from '../helper/ai/bibleCrossRefHelpers';
import RenderAIBibleCrossReferenceComp from './RenderAIBibleCrossReferenceComp';

export default function RenderAIBibleCrossReferenceListComp({
    index,
    bibleCrossRef,
}: Readonly<{
    index: number;
    bibleCrossRef: CrossReferenceType[];
}>) {
    return (
        <>
            {index > 0 && <hr />}
            {bibleCrossRef.map((item) => {
                return (
                    <RenderAIBibleCrossReferenceComp
                        key={item.title}
                        crossReference={item}
                    />
                );
            })}
        </>
    );
}
