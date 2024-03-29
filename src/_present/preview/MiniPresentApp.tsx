import PresentAlert from '../PresentAlert';
import PresentBackground from '../PresentBackground';
import PresentSlide from '../PresentSlide';
import PresentFullText from '../PresentFullText';
import PresentManager from '../PresentManager';
import { RendStyle } from '../transition-effect/RenderTransitionEffect';

const IMAGE_BG =
    `linear-gradient(45deg, var(--bs-gray-700) 25%, var(--bs-gray-800) 25%),
linear-gradient(-45deg, var(--bs-gray-700) 25%, var(--bs-gray-800) 25%),
linear-gradient(45deg, var(--bs-gray-800) 75%, var(--bs-gray-700) 75%),
linear-gradient(-45deg, var(--bs-gray-800) 75%, var(--bs-gray-700) 75%)`;

export default function MiniPresentApp({ id }: Readonly<{ id: number }>) {
    const presentManager = PresentManager.getInstance(id);
    if (presentManager === null) {
        return null;
    }
    return (
        <>
            <RendStyle ptEffectTarget='background'
                presentId={presentManager.presentId} />
            <RendStyle ptEffectTarget='slide'
                presentId={presentManager.presentId} />
            <div style={{
                pointerEvents: 'none',
                position: 'absolute',
                width: '100%',
                height: '100%',
                backgroundImage: IMAGE_BG,
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
            }} />
            <PresentBackground
                presentManager={presentManager} />
            <PresentSlide
                presentManager={presentManager} />
            <PresentFullText
                presentManager={presentManager} />
            <PresentAlert
                presentManager={presentManager} />
        </>
    );
}
