import ShowingScreenIconComp from '../_screen/preview/ShowingScreenIcon';
import { tran } from '../lang/langHelpers';

/**
 * What this component has on a screen right now, and the way to take it off.
 *
 * It used to be a bordered box holding one FULL-SIZE grey button per screen,
 * sitting under the widget — so with two screens up an operator read the same
 * seventeen characters twice, in a box inside a panel that already has a
 * border. It is a row of chips now, and it sits beside the button that put
 * the thing there, because "get it off the wall" is looked for where it went
 * up rather than at the bottom of a panel.
 *
 * The words do NOT shrink. Every chip keeps the widget's own `Hide <name>`
 * text, visible and not only in a tooltip: it is what `owa_list_screens`
 * reports as the control the assistant should press, what `owa_click` aims
 * at, and what a screen reader reads. A chip reading only `✕ 1` would save a
 * little more width and cost the app its most important control's name.
 */
export default function ScreensRendererComp<T>({
    title,
    genTitle,
    buttonText,
    showingScreenIdDataList,
    handleForegroundHiding,
    isMini = false,
}: Readonly<{
    title?: string;
    genTitle?: (data: T) => string;
    buttonText: string;
    showingScreenIdDataList: [number, T][];
    handleForegroundHiding: (screenId: number, data: T) => void;
    isMini?: boolean;
}>) {
    if (showingScreenIdDataList.length === 0) {
        return null;
    }
    return (
        <div className="fg-onscreen" title={title}>
            {showingScreenIdDataList.map(([screenId, data], i) => {
                const itemTitle = genTitle ? genTitle(data) : undefined;
                const onClick = handleForegroundHiding.bind(
                    null,
                    screenId,
                    data,
                );
                if (isMini) {
                    return (
                        <ShowingScreenIconComp
                            key={screenId + '-' + i}
                            screenId={screenId}
                            onClick={onClick}
                            title={tran('Remove from screen ') + screenId}
                        />
                    );
                }
                return (
                    <button
                        type="button"
                        className="fg-hide"
                        // Only a title the CALLER gave (the camera's device,
                        // the clock's id). Defaulting it to the button's own
                        // words made `labelOf` join the same sentence three
                        // times -- the doubled-label shape that once had a
                        // model pressing a badge instead of the toggle.
                        title={itemTitle}
                        aria-label={`${buttonText} ${screenId}`}
                        key={screenId + '-' + i}
                        onClick={onClick}
                    >
                        <span>{buttonText}</span>
                        {/*
                         * No `onClick` of its own: the chip around it already
                         * carries the press, and the icon's would fire the
                         * same hide a second time on its way out.
                         */}
                        <ShowingScreenIconComp
                            screenId={screenId}
                            title={tran('Remove from screen ') + screenId}
                        />
                    </button>
                );
            })}
        </div>
    );
}
