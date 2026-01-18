import { tran } from '../../lang/langHelpers';
import { useScreenManagerContext } from '../managers/screenManagerHooks';
import RenderTransitionEffectComp from '../RenderTransitionEffectComp';

export default function ScreenEffectControlComp() {
    const screenManager = useScreenManagerContext();
    return (
        <>
            <small>{tran('Transition:')}</small>
            <RenderTransitionEffectComp
                title={tran('Slide') + ':'}
                domTitle={tran('Slide transition')}
                screenEffectManager={screenManager.varyAppDocumentEffectManager}
            />
            <RenderTransitionEffectComp
                title={tran('Background') + ':'}
                domTitle={tran('Background transition')}
                screenEffectManager={screenManager.backgroundEffectManager}
            />
        </>
    );
}
