import { useState } from 'react';

import { tran } from '../../lang/langHelpers';

/**
 * The body of the "Be careful with AI" confirm: the warning, and under it
 * the box that puts the warning away for a while (`askAiCaution`). The box
 * is a CHOICE made on the dialog itself rather than a third button, so Open
 * and Cancel keep meaning what they did, and ticking it and then pressing
 * Cancel hides nothing.
 */
export default function AiCautionBodyComp({
    text,
    onHideChange,
}: Readonly<{
    text: string;
    onHideChange: (isHidden: boolean) => void;
}>) {
    const [isTicked, setIsTicked] = useState(false);
    return (
        <div className="app-selectable-text">
            <p>{text}</p>
            <label
                className="d-flex align-items-center gap-2 mb-0"
                style={{ cursor: 'pointer' }}
            >
                <input
                    type="checkbox"
                    checked={isTicked}
                    onChange={(event) => {
                        const isHidden = event.target.checked;
                        setIsTicked(isHidden);
                        onHideChange(isHidden);
                    }}
                />
                <span>{tran('Do not show this again for 30 days')}</span>
            </label>
        </div>
    );
}
