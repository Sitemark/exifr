import { describe, it, assert } from 'vitest';
import Worker from "./test-browser-webworker.js?worker"

import { parse } from '../dist/esm/index.js';

function parseInWebworker(file, options) {
	const worker = new Worker();
	return new Promise((resolve, reject) => {
		worker.onmessage = ({ data: result }) => {
			console.log("Message from worker: ", result);
			if(result.status == "success") return resolve(result.data);
			else return reject(result.error);
		}
		worker.onmessageerror = (err) => {
			reject(err);
		}
		worker.postMessage({
			file,
			options
		});
	});
}

describe("in browser", () => {
	it("simple file, read/fetch whole file - should succeed", async () => {
		const options = { wholeFile: true }
		const file = await import('./IMG_20180725_163423.jpg?url');
		const blob = await fetch(file.default).then((res) => res.blob());
		const exif = await parse(blob, options)
		assert.equal(exif.Make, 'Google')
	})
});

describe("as worker", () => {
	it("simple file, read/fetch whole file - should succeed", async () => {
		const options = { wholeFile: true }
		const file = await import('./IMG_20180725_163423.jpg?url');
		const blob = await fetch(file.default).then((res) => res.blob());
		const exif = await parseInWebworker(blob, options)
		assert.equal(exif.Make, 'Google')
	})
});
