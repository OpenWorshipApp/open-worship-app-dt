import http from 'node:http';
import https from 'node:https';

const httpUtils = {
    request(options: { [key: string]: any }, callback: (res: any) => void) {
        return https.request(options, callback);
    },
    // Plain HTTP is a separate module in node, so the caller must pick by the
    // URL's protocol. Needed for local/LAN servers (e.g. a laptop sharing a
    // presenting flow archive over `http://<host>:8000`) which have no TLS at all.
    requestHttp(options: { [key: string]: any }, callback: (res: any) => void) {
        return http.request(options, callback);
    },
};

export default httpUtils;
