import type { AppColorType } from '../others/color/colorHelpers';

export function renderPresent(_: any) {
    return false;
}
export function renderFG(htmlString: string) {
    renderPresent({
        script: `
const shadow = getShadow('foreground');
shadow.innerHTML = \`${htmlString}\`;
`,
    });
}
export function clearForeground() {
    renderPresent({
        script: `
const shadow = getShadow('foreground');
shadow.innerHTML = '';
    `,
    });
}

function getBackgroundStyle() {
    return `
ele.style.position = 'absolute';
ele.style.width = '100%';
ele.style.height = '100%';
`;
}

export function renderBackgroundImage(path: string) {
    const src = new URL(path).toString();
    renderPresent({
        script: `
const shadow = getShadow('background');
const ele = document.createElement('img');
${getBackgroundStyle()}
ele.src = '${src}';
shadow.appendChild(ele);
clearOldBackground();
`,
    });
}

export function renderBackgroundColor(color: AppColorType) {
    renderPresent({
        script: `
const shadow = getShadow('background');
const ele = document.createElement('div');
${getBackgroundStyle()}
ele.style.backgroundColor = '${color}';
shadow.appendChild(ele);
clearOldBackground();
    `,
    });
}

export function renderBackgroundVideo(src: string) {
    renderPresent({
        script: `
const shadow = getShadow('background');
const ele = document.createElement('video');
${getBackgroundStyle()}
ele.style.objectFit = 'cover';
ele.src = '${src}';
ele.autoplay = true;
ele.loop = true;
ele.playsinline = true;
ele.muted = true;
shadow.appendChild(ele);
clearOldBackground();
`,
    });
}

export function clearBackground() {
    renderPresent({
        script: `
const shadow = getShadow('background');
shadow.innerHTML = '';
`,
    });
}
