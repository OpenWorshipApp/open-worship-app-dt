import {
    checkIsVerticalAtBottom,
    checkIsVerticalPartialInvisible,
} from '../helper/helpers';

function getContainer(element: HTMLElement) {
    const parentElement = element.parentElement;
    if (!parentElement) {
        return null;
    }
    const dataset = parentElement.dataset;
    if (dataset.scrollVersesContainer) {
        return parentElement;
    }
    return getContainer(parentElement);
}
export function checkIsVersePartialInvisible(target: HTMLElement) {
    const container = getContainer(target);
    if (container === null) {
        return null;
    }
    return checkIsVerticalPartialInvisible(container, target, 1);
}
export function checkIsVerseAtBottom(target: HTMLElement) {
    const container = getContainer(target);
    if (container === null) {
        return null;
    }
    return checkIsVerticalAtBottom(container, target);
}
