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

	it("should throw for invalid dates", async () => {
		const file = await import('./gremsy-vio-thermal.tiff?url')
		const source = await fetch(file.default).then((res) => res.arrayBuffer())
		const validDate = new TextEncoder().encode('2020-01-02T03:04:05-0500')
		for (const invalidDate of ['2020-99-02T03:04:05-0500', '2020-02-31T03:04:05-0500']) {
			const input = source.slice(0)
			const inputBytes = new Uint8Array(input)
			const dateOffset = inputBytes.findIndex((value, index) => validDate.every((dateValue, dateIndex) => inputBytes[index + dateIndex] === dateValue))
			assert.isAtLeast(dateOffset, 0)
			inputBytes.set(new TextEncoder().encode(invalidDate), dateOffset)
			var error
			try {
				await parse(input)
			} catch (caughtError) {
				error = caughtError
			}
			assert.equal(error?.message, `Invalid EXIF date: ${invalidDate}`)
		}
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
