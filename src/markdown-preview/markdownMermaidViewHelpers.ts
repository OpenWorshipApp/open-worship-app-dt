/**
 * Moving and zooming a drawn diagram of the Markdown Preview (2026-11-21, the
 * user: _like vscode mermaid preview, I want the mermaid preview control in
 * markdown preview_): four buttons in the diagram's top corner, shown under
 * the mouse -- drag to move (a toggle), zoom out, zoom in, reset.
 *
 * Nothing is made until a diagram is first under the mouse, and the page
 * gets ONE set of listeners however many diagrams it holds
 * (`attachMermaidViewControls`). The wheel is the exception: a wheel listener
 * that may stop the scroll keeps the page's own scrolling off the fast path,
 * so one is put on a diagram only while its drag-to-move is on.
 *
 * The view is a `transform` on the diagram's own `<svg>`, written straight
 * to it while a drag moves it -- a variable on its box would have every node
 * of the picture restyled on each move. Being IN the picture, it comes back
 * with it when the page is drawn again (`takeDrawnDiagrams`), so a pause in
 * the typing beside it does not put a zoomed diagram back. Paper takes it
 * off in the print sheet and the Word document in `readSvgPicture`; the
 * buttons are `<button>`s, which that document leaves out, and they are
 * taken off the page before its pictures are kept
 * (`removeMermaidViewControls`).
 */

export type MermaidViewLabelsType = {
    pan: string;
    zoomOut: string;
    zoomIn: string;
    reset: string;
};

type ViewType = { x: number; y: number; scale: number };

const DIAGRAM_SELECTOR = '.app-markdown-mermaid--rendered[data-mermaid-index]';
const CONTROLS_CLASS_NAME = 'app-markdown-mermaid-controls';
const PAN_CLASS_NAME = 'app-markdown-mermaid--pan';
const PANNING_CLASS_NAME = 'app-markdown-mermaid--panning';
const ACTION_ATTRIBUTE = 'data-mermaid-action';

const MIN_SCALE = 0.2;
const MAX_SCALE = 10;
const BUTTON_ZOOM_FACTOR = 1.25;
const WHEEL_ZOOM_RATE = 0.0015;

function findSvg(diagramElement: Element) {
    return diagramElement.querySelector<SVGSVGElement>(':scope > svg');
}

function readView(svgElement: SVGSVGElement): ViewType {
    const [x, y, scale] = (svgElement.dataset.appView ?? '')
        .split(' ')
        .map(Number);
    if (Number.isFinite(x) && Number.isFinite(y) && scale > 0) {
        return { x, y, scale };
    }
    return { x: 0, y: 0, scale: 1 };
}

function applyView(svgElement: SVGSVGElement, { x, y, scale }: ViewType) {
    svgElement.style.transformOrigin = '0 0';
    svgElement.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function writeView(svgElement: SVGSVGElement, view: ViewType) {
    if (view.x === 0 && view.y === 0 && view.scale === 1) {
        svgElement.style.removeProperty('transform');
        svgElement.style.removeProperty('transform-origin');
        delete svgElement.dataset.appView;
        return;
    }
    applyView(svgElement, view);
    svgElement.dataset.appView = `${view.x} ${view.y} ${view.scale}`;
}

/**
 * Zooms by `factor`, the point of the picture under (`clientX`, `clientY`)
 * staying where it is.
 */
function zoomAt(
    svgElement: SVGSVGElement,
    factor: number,
    clientX: number,
    clientY: number,
) {
    const view = readView(svgElement);
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
    if (scale === view.scale) {
        return;
    }
    // The picture's corner is its place on the page plus how far it moved.
    const rect = svgElement.getBoundingClientRect();
    const pointX = clientX - (rect.left - view.x);
    const pointY = clientY - (rect.top - view.y);
    const ratio = scale / view.scale;
    writeView(svgElement, {
        x: pointX - (pointX - view.x) * ratio,
        y: pointY - (pointY - view.y) * ratio,
        scale,
    });
}

function zoomAtCenter(diagramElement: HTMLElement, factor: number) {
    const svgElement = findSvg(diagramElement);
    if (svgElement === null) {
        return;
    }
    const rect = diagramElement.getBoundingClientRect();
    zoomAt(
        svgElement,
        factor,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
    );
}

function handleWheel(event: WheelEvent) {
    const svgElement = findSvg(event.currentTarget as HTMLElement);
    if (svgElement === null) {
        return;
    }
    event.preventDefault();
    zoomAt(
        svgElement,
        Math.exp(-event.deltaY * WHEEL_ZOOM_RATE),
        event.clientX,
        event.clientY,
    );
}

function togglePan(diagramElement: HTMLElement, buttonElement: Element) {
    const isPan = diagramElement.classList.toggle(PAN_CLASS_NAME);
    buttonElement.setAttribute('aria-pressed', String(isPan));
    if (isPan) {
        diagramElement.addEventListener('wheel', handleWheel, {
            passive: false,
        });
    } else {
        diagramElement.removeEventListener('wheel', handleWheel);
    }
}

function startPanning(diagramElement: HTMLElement, event: PointerEvent) {
    const svgElement = findSvg(diagramElement);
    if (svgElement === null) {
        return;
    }
    // Or the drag selects the page's words on its way.
    event.preventDefault();
    const view = readView(svgElement);
    const startX = event.clientX - view.x;
    const startY = event.clientY - view.y;
    const pointerId = event.pointerId;
    const handleMove = (moveEvent: PointerEvent) => {
        view.x = moveEvent.clientX - startX;
        view.y = moveEvent.clientY - startY;
        applyView(svgElement, view);
    };
    const handleEnd = () => {
        diagramElement.removeEventListener('pointermove', handleMove);
        diagramElement.removeEventListener('pointerup', handleEnd);
        diagramElement.removeEventListener('pointercancel', handleEnd);
        diagramElement.classList.remove(PANNING_CLASS_NAME);
        if (diagramElement.hasPointerCapture?.(pointerId)) {
            diagramElement.releasePointerCapture(pointerId);
        }
        writeView(svgElement, view);
    };
    diagramElement.addEventListener('pointermove', handleMove);
    diagramElement.addEventListener('pointerup', handleEnd);
    diagramElement.addEventListener('pointercancel', handleEnd);
    diagramElement.classList.add(PANNING_CLASS_NAME);
    diagramElement.setPointerCapture?.(pointerId);
}

function genControls(labels: MermaidViewLabelsType) {
    const controlsElement = document.createElement('div');
    controlsElement.className = CONTROLS_CLASS_NAME;
    const boxElement = document.createElement('div');
    boxElement.className = `${CONTROLS_CLASS_NAME}-box`;
    const buttons: [string, string, string][] = [
        ['pan', 'bi-arrows-move', labels.pan],
        ['zoom-out', 'bi-zoom-out', labels.zoomOut],
        ['zoom-in', 'bi-zoom-in', labels.zoomIn],
        ['reset', 'bi-fullscreen-exit', labels.reset],
    ];
    for (const [action, iconClassName, label] of buttons) {
        const buttonElement = document.createElement('button');
        buttonElement.type = 'button';
        buttonElement.className = 'btn btn-sm';
        buttonElement.setAttribute(ACTION_ATTRIBUTE, action);
        buttonElement.title = label;
        buttonElement.setAttribute('aria-label', label);
        if (action === 'pan') {
            buttonElement.setAttribute('aria-pressed', 'false');
        }
        const iconElement = document.createElement('i');
        iconElement.className = `bi ${iconClassName}`;
        buttonElement.append(iconElement);
        boxElement.append(buttonElement);
    }
    controlsElement.append(boxElement);
    return controlsElement;
}

/**
 * Takes the buttons off every diagram of `container`: before its pictures
 * are kept for the next draw of the page, which would carry them along.
 */
export function removeMermaidViewControls(container: HTMLElement) {
    for (const element of container.querySelectorAll(
        `.${CONTROLS_CLASS_NAME}`,
    )) {
        element.remove();
    }
}

/**
 * Gives the diagrams of `container` -- those on it now and any drawn into it
 * later -- their buttons. `genLabels` is asked when a diagram first comes
 * under the mouse. Returns the undo.
 */
export function attachMermaidViewControls(
    container: HTMLElement,
    genLabels: () => MermaidViewLabelsType,
) {
    const handleMouseOver = (event: MouseEvent) => {
        const diagramElement = (event.target as Element).closest?.(
            DIAGRAM_SELECTOR,
        );
        if (
            !diagramElement ||
            diagramElement.querySelector(`:scope > .${CONTROLS_CLASS_NAME}`)
        ) {
            return;
        }
        diagramElement.prepend(genControls(genLabels()));
    };
    const handleClick = (event: MouseEvent) => {
        const buttonElement = (event.target as Element).closest?.(
            `[${ACTION_ATTRIBUTE}]`,
        );
        const diagramElement =
            buttonElement?.closest<HTMLElement>(DIAGRAM_SELECTOR);
        if (!buttonElement || !diagramElement) {
            return;
        }
        const action = buttonElement.getAttribute(ACTION_ATTRIBUTE);
        if (action === 'pan') {
            togglePan(diagramElement, buttonElement);
        } else if (action === 'zoom-in') {
            zoomAtCenter(diagramElement, BUTTON_ZOOM_FACTOR);
        } else if (action === 'zoom-out') {
            zoomAtCenter(diagramElement, 1 / BUTTON_ZOOM_FACTOR);
        } else if (action === 'reset') {
            const svgElement = findSvg(diagramElement);
            if (svgElement !== null) {
                writeView(svgElement, { x: 0, y: 0, scale: 1 });
            }
        }
    };
    const handlePointerDown = (event: PointerEvent) => {
        const target = event.target as Element;
        if (event.button !== 0 || target.closest?.(`.${CONTROLS_CLASS_NAME}`)) {
            return;
        }
        const diagramElement = target.closest?.<HTMLElement>(
            `${DIAGRAM_SELECTOR}.${PAN_CLASS_NAME}`,
        );
        if (diagramElement) {
            startPanning(diagramElement, event);
        }
    };
    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('click', handleClick);
    container.addEventListener('pointerdown', handlePointerDown);
    return () => {
        container.removeEventListener('mouseover', handleMouseOver);
        container.removeEventListener('click', handleClick);
        container.removeEventListener('pointerdown', handlePointerDown);
    };
}
