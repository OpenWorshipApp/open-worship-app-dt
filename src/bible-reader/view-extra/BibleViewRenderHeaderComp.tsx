import {
    fontSizeToHeightStyle,
    useBibleViewFontSizeContext,
} from '../../helper/bibleViewHelpers';
import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import RenderActionButtonsComp from '../../bible-lookup/RenderActionButtonsComp';
import { HoverMotionHandler } from '../../helper/domHelpers';
import { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import { RenderTitleMaterialComp } from './RenderTitleMaterialComp';

export default function BibleViewRenderHeaderComp({
    bibleItem,
}: Readonly<{ bibleItem: ReadIdOnlyBibleItem }>) {
    const viewController = useBibleItemsViewControllerContext();
    const fontSize = useBibleViewFontSizeContext();
    return (
        <div
            className="card-header d-flex app-top-hover-motion-1 p-0"
            style={{ ...fontSizeToHeightStyle(fontSize) }}
        >
            <RenderTitleMaterialComp
                bibleItem={bibleItem}
                onBibleKeyChange={(
                    isContextMenu: boolean,
                    _oldBibleKey: string,
                    newBibleKey: string,
                ) => {
                    viewController.applyTargetOrBibleKey(
                        bibleItem,
                        isContextMenu
                            ? {
                                  extraBibleKeys: [
                                      ...bibleItem.extraBibleKeys,
                                      newBibleKey,
                                  ],
                              }
                            : {
                                  bibleKey: newBibleKey,
                              },
                    );
                }}
            />
            <div
                className={`${HoverMotionHandler.lowClassname}-1`}
                data-min-parent-width="550"
            >
                <RenderActionButtonsComp bibleItem={bibleItem} />
            </div>
            <div
                className={`${HoverMotionHandler.lowClassname}-0`}
                data-min-parent-width="550"
            >
                <i
                    className="bi bi-x-lg app-caught-hover-pointer"
                    style={{
                        color: 'var(--bs-danger-text-emphasis)',
                    }}
                    onClick={() => {
                        viewController.deleteBibleItem(bibleItem);
                    }}
                />
            </div>
        </div>
    );
}
