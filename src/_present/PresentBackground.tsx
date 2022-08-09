import { useEffect, useRef } from 'react';
import ReactDOMServer from 'react-dom/server';
import { AppColorType } from '../others/ColorPicker';
import { BackgroundSrcType } from './PresentBGManager';
import PresentManager from './PresentManager';
import PresentTransitionEffect from './PresentTransitionEffect';
import PresentBackgroundColor from './PresentBackgroundColor';
import PresentBackgroundImage from './PresentBackgroundImage';
import PresentBackgroundVideo from './PresentBackgroundVideo';

export default function PresentBackground({ presentManager }: {
    presentManager: PresentManager;
}) {
    const div = useRef<HTMLDivElement>(null);
    const { presentBGManager } = presentManager;
    useEffect(() => {
        if (div.current) {
            presentBGManager.div = div.current;
        }
    });
    return (
        <div id="background" ref={div}
            style={presentBGManager.backgroundStyle} />
    );
}

export function genHtmlBG(bgSrc: BackgroundSrcType,
    presentManager: PresentManager) {
    const str = ReactDOMServer.renderToStaticMarkup(
        <RenderBG bgSrc={bgSrc}
            presentManager={presentManager} />);
    const div = document.createElement('div');
    div.innerHTML = str;
    return div.firstChild as HTMLDivElement;
}

export function RenderBG({
    bgSrc, presentManager,
}: {
    bgSrc: BackgroundSrcType,
    presentManager: PresentManager;
}) {
    const ptEffect = PresentTransitionEffect.getInstance('background');
    const { presentBGManager } = presentManager;
    return (
        <div style={{
            ...presentBGManager.backgroundStyle,
            ...ptEffect.cssPropsIn,
        }}>
            <RenderPresentBackground
                presentManager={presentManager}
                bgSrc={bgSrc} />
        </div>
    );
}

function RenderPresentBackground({
    bgSrc, presentManager,
}: {
    bgSrc: BackgroundSrcType,
    presentManager: PresentManager;
}) {
    if (bgSrc === null) {
        return null;
    }
    if (bgSrc.type === 'image') {
        return (
            <PresentBackgroundImage bgSrc={bgSrc}
                presetManager={presentManager} />
        );
    }
    if (bgSrc.type === 'video') {
        return (
            <PresentBackgroundVideo bgSrc={bgSrc}
                presetManager={presentManager} />
        );
    }
    if (bgSrc.type === 'color') {
        return (
            <PresentBackgroundColor
                color={bgSrc.src as AppColorType} />
        );
    }
    return null;
}
