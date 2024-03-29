import './PresentCloseButton.scss';
import PresentManager from './PresentManager';

export default function PresentCloseButton({
    presentManager,
}: Readonly<{
    presentManager: PresentManager,
}>) {
    return (
        <button id="close" onClick={() => {
            presentManager.hide();
        }}>x</button>
    );
}
