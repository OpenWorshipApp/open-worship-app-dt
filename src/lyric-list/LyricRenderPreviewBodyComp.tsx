import { useMemo, useRef } from 'react';
import { OpenLyric } from 'open-lyric';
import { OpenLyricPluginKmKh } from 'open-lyric-plugin-km-kh';

import { useAppEffect } from '../helper/appHooks';
import { useSelectedLyricContext } from './lyricHelpers';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import { checkIsDarkMode } from '../others/themeHelpers';
import type Lyric from './Lyric';
import { getFontFamilies } from '../server/fontHelpers';

async function updateValue(lyric: Lyric, preview: OpenLyric) {
    const content = await lyric.getContent();
    preview.value = content;
    // TODO: use .reload()
    if (content === '') {
        preview.unmount();
    } else {
        void preview.mount().catch((err) => {
            console.error('Failed to mount preview', err);
        });
    }
}

export default function LyricRenderPreviewBodyComp() {
    const selectedLyric = useSelectedLyricContext();
    const containerRef = useRef<HTMLDivElement>(null);

    const preview = useMemo(() => {
        const newPreview = new OpenLyric();
        const kmKh = new OpenLyricPluginKmKh();
        newPreview.addPlugin('km-KH', kmKh);
        const khmerFontFaces = kmKh.contributes.language?.fontFaces ?? [];
        // TODO: add km lang font-family
        const defaultOption = {
            title: 'Khmer Font',
            fontFaces: khmerFontFaces,
        };
        newPreview.fontFaces = [defaultOption];
        if (khmerFontFaces.length > 0) {
            newPreview.fontFamily = khmerFontFaces[0];
        }
        getFontFamilies().then((fontFamilies) => {
            newPreview.fontFaces = [
                defaultOption,
                {
                    title: 'System Fonts',
                    fontFaces: fontFamilies,
                },
            ];
        });
        return newPreview;
    }, []);
    const isDarkMode = checkIsDarkMode();
    preview.theme = isDarkMode ? 'dark' : 'light';
    (globalThis as any).preview = preview;

    useAppEffect(() => {
        if (selectedLyric === null) {
            return;
        }
        preview.container = containerRef.current as HTMLElement;
        return () => {
            preview.unmount();
            preview.container = null;
        };
    }, [containerRef.current, preview]);

    useAppEffect(() => {
        updateValue(selectedLyric, preview);
    }, [selectedLyric]);

    useFileSourceEvents(
        ['update'],
        async () => {
            updateValue(selectedLyric, preview);
        },
        [selectedLyric, preview],
        selectedLyric.filePath,
    );

    return (
        <div
            className="w-100 h-100 p-1 app-inner-shadow"
            style={{
                overflowX: 'hidden',
                overflowY: 'auto',
            }}
            ref={containerRef}
        />
    );
}
