import { get_api_url, get_api_key } from '../_owa-crypto';

export function appApiFetch(pathName: string, options: any = {}) {
    const apiUrl = get_api_url();
    const apiKey = get_api_key();
    options.headers = options.headers ?? {};
    options.headers['x-api-key'] = apiKey;
    return fetch(`${apiUrl}/${pathName}`, options);
}
