import { type CSSProperties, type ReactNode, useMemo } from 'react';

import { tran } from '../lang/langHelpers';
import type { BibleTextEffectType } from '../_screen/bibleTextStyleHelpers';
import BibleTextLookTileComp from './BibleTextLookTileComp';
import {
    findBibleTextLookId,
    genBibleTextLookList,
    type BibleBackdropType,
    type BibleTextLookIdType,
} from './bibleTextLookHelpers';

// Literal keys, one call each, so `tranKeyCoverage.test.ts` can read them: a
// name looked up through a map is invisible to that gate, and a missing Khmer
// string THROWS in dev the moment the panel opens.
function genLookLabelMap(): Record<BibleTextLookIdType, string> {
    return {
        normal: tran('Normal'),
        'thin-outline': tran('Thin Outline'),
        outline: tran('Outline'),
        'heavy-outline': tran('Heavy Outline'),
        'soft-shadow': tran('Soft Shadow'),
        'deep-shadow': tran('Deep Shadow'),
        'hard-shadow': tran('Hard Shadow'),
        lifted: tran('Lifted'),
        glow: tran('Glow'),
        haze: tran('Haze'),
        halo: tran('Halo'),
        'blue-edge': tran('Blue Edge'),
    };
}

/**
 * The looks worth one press, each drawn as itself.
 *
 * They used to be twelve buttons reading `G3:Outline1` .. `G4:Outline3`: a
 * codename says nothing, and the only way to learn what one did was to put it
 * on the projector. A tile wears its look on the background it is meant for,
 * so choosing one is choosing a picture. The looks somebody saved follow in
 * the same grid (`children`).
 */
export default function BibleTextLooksComp({
    backdrop,
    textShadow,
    sample,
    sampleStyle,
    onLookChange,
    children,
}: Readonly<{
    backdrop: BibleBackdropType;
    /** What the screen draws now, which is what lights a tile. */
    textShadow: string;
    sample: string;
    sampleStyle: CSSProperties;
    onLookChange: (effect: BibleTextEffectType) => void;
    children?: ReactNode;
}>) {
    const lookList = useMemo(() => {
        return genBibleTextLookList(backdrop);
    }, [backdrop]);
    const selectedLookId = findBibleTextLookId(lookList, textShadow);
    const labelMap = genLookLabelMap();
    return (
        <div
            className="bible-style-looks"
            role="group"
            aria-label={tran('Presets')}
        >
            {lookList.map((look) => {
                return (
                    <BibleTextLookTileComp
                        key={look.id}
                        label={labelMap[look.id]}
                        sample={sample}
                        sampleStyle={{
                            ...sampleStyle,
                            textShadow: look.textShadow,
                        }}
                        backdrop={backdrop}
                        isOn={look.id === selectedLookId}
                        onPick={() => {
                            onLookChange(look.effect);
                        }}
                    />
                );
            })}
            {children}
        </div>
    );
}
