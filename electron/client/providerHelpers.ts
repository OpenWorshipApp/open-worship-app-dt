import { htmlFiles, toTitleCase } from '../fsServe';

function freezeObject(obj: any) {
    if (!['object', 'array'].includes(typeof obj)) {
        return;
    }
    Object.freeze(obj);
    if (Array.isArray(obj)) {
        obj.forEach((item) => {
            freezeObject(item);
        });
    } else if (obj instanceof Object) {
        for (const key in obj) {
            freezeObject(obj[key]);
        }
    }
}

export function initProvider(provider: { [key: string]: any }) {
    const pathName = window.location.pathname;
    for (const [name, htmlFileFullName] of Object.entries(htmlFiles)) {
        provider[`${name}HomePage`] = `/${htmlFileFullName}`;
        const isCurrentPage = pathName.startsWith(`/${htmlFileFullName}`);
        provider[`isPage${toTitleCase(name)}`] = isCurrentPage;
    }
    freezeObject(provider);
    (global as any).provider = (window as any).provider = provider;
}
