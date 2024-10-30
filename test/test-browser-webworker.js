import { parse } from '../dist/esm/index.js';

self.onmessage = async (e) => {
	try {
		const data = e.data;
		const exif = await parse(data.file, data.options);
		self.postMessage({
			status: "success",
			data: exif,
		});
	} catch(err) {
		self.postMessage({
			status: "error",
			error: err,
		});
	}
}
