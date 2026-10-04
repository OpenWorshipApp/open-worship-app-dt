import { tran } from '../../lang/langHelpers';
import { useScreenManagerContext } from '../managers/screenManagerHooks';
import RenderTransitionEffectComp from '../RenderTransitionEffectComp';

export default function ScreenEffectControlComp() {
    const screenManager = useScreenManagerContext();
    return (
        <div className="mx-1" title={tran('Transition')}>
            {/* An untranslated mnemonic, like the BG/SL/BB/FG codes and `St:`
                -- the row is one line tall. The group's own title carries the
                translated word, so hide the letters from a screen reader
                rather than have it announce "Tr colon". */}
            <small className="me-1" aria-hidden="true">
                Tr:
            </small>
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
            {/* What a foreground overlay comes in and goes out with when
                neither its session nor its component chose one. It had no
                button: every text and timer overlay was hardcoded to fade. */}
            <RenderTransitionEffectComp
                title={tran('Foreground') + ':'}
                domTitle={tran('Foreground transition')}
                screenEffectManager={screenManager.foregroundEffectManager}
            />
        </div>
    );
}
