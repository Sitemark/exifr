/* Based on https://github.com/mattiasw/ExifReader/blob/master/src/xmp-tags.js
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { DOMParser as XMLDOMParser } from "@xmldom/xmldom";

export default {
    get
};

function get() {
    if (typeof DOMParser !== 'undefined') {
        return DOMParser;
    }
    // If your code uses web workers, workerpool or runs in node, then it will need to use xmldom
    // If the dependency @xmldom/xmldom does not exist then this will return undefined
    return XMLDOMParser;
}
