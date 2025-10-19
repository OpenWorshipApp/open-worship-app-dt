import {
    KeyboardType,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { bringDomToBottomView } from '../helper/helpers';

export const INPUT_TEXT_CLASS = 'bible-lookup-input-text';
export const RENDER_FOUND_CLASS = 'bible-lookup-render-found';

function indexing(listLength: number, index: number, isNext: boolean) {
    return (index + (isNext ? 1 : -1) + listLength) % listLength;
}

function getElements(optionClass: string) {
    return Array.from(
        document.querySelectorAll<HTMLDivElement>(`.${optionClass}`),
    );
}

function calculateIndexer(optionClass: string, selectedClass: string) {
    const elements = getElements(optionClass);
    if (!elements.length) {
        return { elements, indexer: [], rotatedIndexer: [], preIndex: -1 };
    }
    const preIndex = elements.findIndex((element) => {
        return element.classList.contains(selectedClass);
    });
    const cordList = elements.map((element: any) => {
        const rect = (element as HTMLDivElement).getBoundingClientRect();
        return {
            x: rect.x,
            y: rect.y,
        };
    });
    const indexer = [];
    let row: null[] = [];
    let preY = -1;
    for (const cord of cordList) {
        if (cord.y !== preY) {
            preY = cord.y;
            if (row.length) {
                indexer.push(row);
            }
            row = [];
        }
        row.push(null);
    }
    if (row.length) {
        indexer.push(row);
    }
    const rotatedIndexer = [];
    for (let i = 0; i < indexer[0].length; i++) {
        const row = [];
        for (const element of indexer) {
            row.push(element[i]);
        }
        rotatedIndexer.push(
            row.filter((e) => {
                return e === null;
            }),
        );
    }
    return { elements, indexer, rotatedIndexer, preIndex };
}

function indexToCord(hLength: number, index: number) {
    const x = index % hLength;
    const y = Math.floor(index / hLength);
    return { x, y };
}

function cordToIndex(hLength: number, x: number, y: number) {
    return x + y * hLength;
}

function genIndex(
    optionClass: string,
    selectedClass: string,
    key: KeyboardType,
) {
    const { elements, indexer, rotatedIndexer, preIndex } = calculateIndexer(
        optionClass,
        selectedClass,
    );
    if (!indexer.length) {
        return { index: -1, elements: [] };
    }
    if (preIndex === -1) {
        return { index: 0, elements };
    }
    const hLength = indexer[0].length;
    let { x, y } = indexToCord(hLength, preIndex);
    const horizontalLength = indexer[y].length;
    const verticalLength = rotatedIndexer[x].length;
    if (key === 'ArrowLeft') {
        x = indexing(horizontalLength, x, false);
    } else if (key === 'ArrowRight') {
        x = indexing(horizontalLength, x, true);
    } else if (key === 'ArrowUp') {
        y = indexing(verticalLength, y, false);
    } else if (key === 'ArrowDown') {
        y = indexing(verticalLength, y, true);
    }
    return { index: cordToIndex(hLength, x, y), elements };
}

export function getSelectedElement(optionClass: string, selectedClass: string) {
    const elements = getElements(optionClass);
    return elements.find((element) => {
        return element.classList.contains(selectedClass);
    });
}

function blurInputText() {
    const inputText = document.querySelector<HTMLInputElement>(
        `.${INPUT_TEXT_CLASS}`,
    );
    if (inputText) {
        inputText.blur();
    }
}

function checkIsInputTextFocused() {
    const inputText = document.querySelector<HTMLInputElement>(
        `.${INPUT_TEXT_CLASS}`,
    );
    if (inputText) {
        return document.activeElement === inputText;
    }
    return false;
}

export function focusRenderFound() {
    const dive = document.querySelector<HTMLDivElement>(
        `.${RENDER_FOUND_CLASS}`,
    );
    if (dive) {
        dive.focus();
    }
}

function checkIsRenderFoundFocused() {
    const dive = document.querySelector<HTMLDivElement>(
        `.${RENDER_FOUND_CLASS}`,
    );
    if (dive) {
        return document.activeElement === dive;
    }
    return false;
}

export function processSelection(
    optionClass: string,
    selectedClass: string,
    key: KeyboardType,
    event: KeyboardEvent,
) {
    if (!checkIsRenderFoundFocused()) {
        return;
    }
    if (
        (key === 'ArrowLeft' || key === 'ArrowRight') &&
        checkIsBibleLookupInputFocused() &&
        getBibleLookupInputText() !== ''
    ) {
        return;
    }
    event.stopPropagation?.();
    event.preventDefault?.();
    const { index, elements } = genIndex(optionClass, selectedClass, key);
    if (index === -1) {
        return;
    }
    for (const element of elements) {
        element.classList.remove(selectedClass);
    }
    elements[index].classList.add(selectedClass);
    blurInputText();
    bringDomToBottomView(elements[index]);
}

export type SelectBookType = (newBookKey: string, newBook: string) => void;

export function userEnteringSelected(
    optionClass: string,
    selectedClass: string,
) {
    useKeyboardRegistering(
        [{ key: 'Enter' }],
        () => {
            if (!checkIsRenderFoundFocused() && !checkIsInputTextFocused()) {
                return;
            }
            const selectedElement = getSelectedElement(
                optionClass,
                selectedClass,
            );
            selectedElement?.click();
        },
        [optionClass, selectedClass],
    );
}

export const BIBLE_LOOKUP_INPUT_ID = 'app-bible-lookup-input';

export function getBibleLookupInputElement(): HTMLInputElement | null {
    return document.getElementById(BIBLE_LOOKUP_INPUT_ID) as HTMLInputElement;
}
export function getBibleLookupInputText() {
    const inputElement = getBibleLookupInputElement();
    if (inputElement === null) {
        return '';
    }
    return inputElement.value;
}
export function checkIsBibleLookupInputFocused(): boolean {
    const inputElement = getBibleLookupInputElement();
    if (inputElement === null) {
        return false;
    }
    return document.activeElement === inputElement;
}
export function setBibleLookupInputFocus() {
    const inputElement = getBibleLookupInputElement();
    if (inputElement === null) {
        return;
    }
    inputElement.focus();
    const length = inputElement.value.length;
    inputElement.setSelectionRange(length, length);
}
