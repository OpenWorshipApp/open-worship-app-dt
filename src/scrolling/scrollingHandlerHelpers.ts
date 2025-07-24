export const TO_THE_TOP_CLASSNAME = 'app-to-the-top';
export const PLAY_TO_BOTTOM_CLASSNAME = 'play-to-bottom';
export const TO_THE_TOP_STYLE_STRING = `
.${PLAY_TO_BOTTOM_CLASSNAME} {
    padding: 0;
    margin: 0;
    font-size: 30px;
    text-align: center;
    position: absolute;
    right: 5px;
    bottom: 30px;
    opacity: 0.1;
    transition: opacity 0.3s ease-in-out;
    cursor: pointer;
}
.${PLAY_TO_BOTTOM_CLASSNAME}[data-speed]:not([data-speed=""]) {
    opacity: 0.4;
}
.${PLAY_TO_BOTTOM_CLASSNAME}:hover {
    opacity: 1;
}
.${TO_THE_TOP_CLASSNAME} {
    padding: 0;
    margin: 0;
    border-radius: 50%;
    font-size: 30px;
    text-align: center;
    position: absolute;
    right: 5px;
    bottom: 5px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
}
.${TO_THE_TOP_CLASSNAME}.asking-to-top {
    opacity: 0.4;
}
.${TO_THE_TOP_CLASSNAME}.show {
    opacity: 0.1;
    pointer-events: all;
    cursor: pointer;
}
.${TO_THE_TOP_CLASSNAME}.show:hover {
    opacity: 1;
}
`;
function checkElement(parent: HTMLElement, element: HTMLElement) {
    if (parent.scrollTop > 0) {
        element.classList.add('show');
    } else {
        element.classList.remove('show');
    }
}
export function applyToTheTop(element: HTMLElement) {
    element.title = 'Click or Double Click to scroll to the top';
    const parent = element.parentElement;
    if (parent === null) {
        return;
    }
    const scrollCallback = ((element as any)._scrollCallback = () => {
        checkElement(parent, element);
    });
    parent.addEventListener('scroll', scrollCallback);
    const bringToTop = (event: any) => {
        preventEvent(event);
        const targetElement = parent.querySelector<HTMLElement>(
            '.' + PLAY_TO_BOTTOM_CLASSNAME,
        );
        if (targetElement?.dataset['speed']) {
            parent.classList.add('asking-to-top');
        } else {
            parent.scrollTo({
                top: 0,
                behavior: 'smooth',
            });
        }
    };
    element.ondblclick = bringToTop;
    element.onclick = (event: any) => {
        const playingElement = parent.querySelector(
            `.${PLAY_TO_BOTTOM_CLASSNAME}[data-speed]:not([data-speed=""])`,
        );
        if (playingElement !== null) {
            return;
        }
        bringToTop(event);
    };
    checkElement(parent, element);
}

function startAnimToBottom(
    parent: HTMLElement,
    element: HTMLElement,
    store: {
        speed: number;
        scrollTop: number;
    },
    options: {
        onMoved: () => void;
        onStop: () => void;
        onToTheTop: () => void;
    },
) {
    const shouldStop =
        store.speed <= 0 ||
        parent.scrollTop >= parent.scrollHeight - parent.clientHeight - 5;

    if (shouldStop) {
        options.onStop();
        return;
    }
    const nexTargetCallback = startAnimToBottom.bind(
        null,
        parent,
        element,
        store,
        options,
    );
    if (parent.classList.contains('asking-to-top')) {
        (parent as any)._askingToTop = false;
        store.scrollTop = 0;
        parent.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
        setTimeout(() => {
            parent.classList.remove('asking-to-top');
            options.onToTheTop();
            requestAnimationFrame(nexTargetCallback);
        }, 2e3);
        return;
    }

    store.scrollTop += 0.05 + store.speed;
    store.scrollTop = Math.max(parent.scrollTop, store.scrollTop);
    if (parent.scrollTop !== store.scrollTop) {
        parent.scrollTop = store.scrollTop;
        setTimeout(() => {
            options.onMoved();
        }, 0);
    }
    requestAnimationFrame(nexTargetCallback);
}

function preventEvent(event: Event) {
    event.stopPropagation();
    event.preventDefault();
}
function showOnScrollable(parent: HTMLElement, element: HTMLElement) {
    if (parent.scrollHeight <= parent.clientHeight) {
        element.style.display = 'none';
    } else {
        element.style.display = 'block';
    }
}

export type MoveCheckType = {
    check: (container: HTMLElement) => void;
    threshold: number;
};

const INIT_TITLE =
    'Click to scroll to the bottom, double click to speed up, ' +
    'right click to slow down, Alt + right click to stop';
const speedOffset = 0.07;
export function applyPlayToBottom(
    element: HTMLElement,
    movedCheck?: MoveCheckType,
) {
    const parent = element.parentElement;
    if (parent === null) {
        return;
    }
    element.title = INIT_TITLE;
    const store = {
        speed: 0,
        scrollTop: 0,
    };
    let start = () => {};
    const resetSpeed = () => {
        const speed = parseFloat(element.dataset['speed'] ?? '0');
        store.speed = isNaN(speed) ? 0 : speed;
        element.title = store.speed.toFixed(2);
        start();
    };
    const setSpeed = (newSpeed: number) => {
        const speed = Math.max(0, newSpeed);
        element.dataset['speed'] = speed === 0 ? '' : speed.toString();
        resetSpeed();
    };
    const realStart = (start = () => {
        if (store.speed === 0) {
            return;
        }
        start = () => {};
        store.scrollTop = parent.scrollTop;
        const movedThreshold = movedCheck?.threshold ?? 0;
        let scrollTop = parent.scrollTop - movedThreshold;
        startAnimToBottom(parent, element, store, {
            onToTheTop: () => {
                scrollTop = parent.scrollTop;
            },
            onMoved: movedThreshold
                ? () => {
                      if (parent.scrollTop > scrollTop) {
                          scrollTop = parent.scrollTop + movedThreshold;
                          movedCheck?.check(parent);
                      }
                  }
                : () => {},
            onStop: () => {
                start = realStart;
                setSpeed(0);
                element.title = INIT_TITLE;
            },
        });
    });
    element.onclick = (event) => {
        preventEvent(event);
        setSpeed(store.speed + speedOffset);
    };
    element.oncontextmenu = (event) => {
        preventEvent(event);
        if (!element.dataset['speed']) {
            return;
        }
        if (event.altKey) {
            setSpeed(0);
            return;
        }
        setSpeed(store.speed - speedOffset);
    };
    element.ondblclick = (event) => {
        preventEvent(event);
        setSpeed(store.speed + speedOffset * 3);
    };
    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            showOnScrollable(entry.target as HTMLElement, element);
        }
    });
    resizeObserver.observe(parent);
    showOnScrollable(parent, element);
}
