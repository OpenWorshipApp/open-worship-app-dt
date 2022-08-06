import './CustomHTMLPresentPreviewer';
import PresentManager from '../PresentManager';
import { showAppContextMenu } from '../../others/AppContextMenu';
import { usePMEvents } from '../presentHelpers';

export default function DisplayControl({ presentManager }: {
    presentManager: PresentManager,
}) {
    usePMEvents(['display-id'], presentManager);
    const displayId = presentManager.displayId;
    return (
        <div className='d-flex justify-content-center align-items-center'
            title={'Present id:' + presentManager.presentId +
                ', display id:' + displayId}>
            <button className='btn btn-sm btn-outline-secondary'
                onClick={(e) => {
                    const {
                        primaryDisplay,
                        displays,
                    } = PresentManager.getAllDisplays();
                    showAppContextMenu(e, displays.map((display) => {
                        const bounds = display.bounds;
                        const isPrimary = display.id === primaryDisplay.id;
                        const isSelected = display.id === displayId;
                        const title = (isSelected ? '*' : '') +
                            `${display.id}: ${bounds.width}x${bounds.height}` +
                            (isPrimary ? ' (primary)' : '');
                        return {
                            title,
                            onClick: () => {
                                presentManager.displayId = display.id;
                            },
                        };
                    }));
                }}>
                <i className='bi bi-display' />
                {presentManager.presentId}:{displayId}
            </button>
        </div >
    );
}
