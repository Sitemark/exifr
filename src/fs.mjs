import {isNode} from './buff-util.mjs';

let _fs = undefined; // lazy-loaded

/**
 * A safe way of accessing the Node.js fs module. This shouldn't be used in code run by the browser.
 */
export function fs() {
    if (!isNode) {
        throw new Error('Node.js fs module is not available outside of node.');
    }
    if (!_fs) {
        // Doing it with eval() avoids web bundlers from replacing it with a generic import and bundling the module.
        const fs = eval('require')('fs');
        _fs = fs != null ? fs.promises : undefined;
    }
    if (!_fs) {
        throw new Error('Node.js fs module is not available.');
    }
    return _fs;
}
