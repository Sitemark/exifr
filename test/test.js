var isBrowser = typeof navigator === 'object'
var isNode = typeof require === 'function' && !isBrowser

if (isBrowser) {
	mocha.setup('bdd')
	setTimeout(() => mocha.run(), 100)
} else {
	var chai = require('chai')
	var path = require('path')
	var fs = require('fs').promises
	var exifr = require('../dist/cjs/index.js')
}
var {ExifParser, parse, thumbnailBuffer, thumbnailUrl} = exifr
var assert = chai.assert




function createImg(url) {
	var img = document.createElement('img')
	img.src = url
	document.querySelector('#temp')
		.append(img)
	return img
}
/*
function createBufferOrArrayBuffer(url) {
	if (isNode)
		return fs.readFile(url)
	else
		return createArrayBuffer(url)
}
*/
function createArrayBuffer(url) {
	return fetch(url).then(res => res.arrayBuffer())
}

function createBlob(url) {
	return fetch(url).then(res => res.blob())
}

function getPath(filepath) {
	if (isNode)
		return path.join(__dirname, filepath)
	else
		return filepath
}

function getUrl(filepath) {
	return location.href
		.split('/')
		.slice(0, -1)
		.concat(filepath)
		.join('/')
		.replace(/\\/g, '/')
}

async function createObjectUrl(url) {
	return URL.createObjectURL(await createBlob(url))
}

async function createBase64Url(url) {
	if (isBrowser) {
		return new Promise(async (resolve, reject) => {
			var blob = await createBlob(url)
			var reader = new FileReader()
			reader.onloadend = () => resolve(reader.result)
			reader.onerror = reject
			reader.readAsDataURL(blob)
		})
	} else if (isNode) {
		var buffer = await fs.readFile(url)
		return 'data:image/jpeg;base64,' + buffer.toString('base64')
	}
}


describe('reader (input formats)', () => {

	isNode && it(`Buffer`, async () => {
		var buffer = await fs.readFile(getPath('IMG_20180725_163423.jpg'))
		var exif = await parse(buffer)
		assert.exists(exif, `exif doesn't exist`)
	})

	isBrowser && it(`ArrayBuffer`, async () => {
		var arrayBuffer = await createArrayBuffer(getPath('IMG_20180725_163423.jpg'))
		var exif = await parse(arrayBuffer)
		assert.exists(exif, `exif doesn't exist`)
	})

	isBrowser && it(`Blob`, async () => {
		var blob = await createBlob(getPath('IMG_20180725_163423.jpg'))
		var exif = await parse(blob)
		assert.exists(exif, `exif doesn't exist`)
	})

	isNode && it(`string file path`, async () => {
		let path = getPath('IMG_20180725_163423.jpg')
		var exif = await parse(path)
		assert.exists(exif, `exif doesn't exist`)
	})

	isBrowser && it(`string URL`, async () => {
		let url = getUrl('IMG_20180725_163423.jpg')
		var exif = await parse(url)
		assert.exists(exif, `exif doesn't exist`)
	})

	isBrowser && it(`Object URL`, async () => {
		var blob = await createObjectUrl(getPath('IMG_20180725_163423.jpg'))
		var exif = await parse(blob)
		assert.exists(exif, `exif doesn't exist`)
	})

	it(`base64 URL`, async () => {
		var blob = await createBase64Url(getPath('IMG_20180725_163423.jpg'))
		var exif = await parse(blob)
		assert.exists(exif, `exif doesn't exist`)
	})

	isBrowser && it(`<img> element with normal URL`, async () => {
		var img = createImg(getPath('IMG_20180725_163423.jpg'))
		var exif = await parse(img)
		assert.exists(exif, `exif doesn't exist`)
	})

	isBrowser && it(`<img> element with Object URL`, async () => {
		var img = createImg(await createObjectUrl(getPath('IMG_20180725_163423.jpg')))
		var exif = await parse(img)
		assert.exists(exif, `exif doesn't exist`)
	})

	//isBrowser && it(`<img> element with base64 URL`, async () => {
	//	var img = createImg(await createBase64Url(getPath('IMG_20180725_163423.jpg')))
	//	await parse(img)
	//})



	// file with short exif where all segments are together at the
	// start of the file, within single chunk

	it(`simple file, read/fetch whole file - should succeed`, async () => {
		let options = {wholeFile: true}
		var exif = await parse(getPath('IMG_20180725_163423.jpg'), options)
		assert.equal(exif.Make, 'Google')
	})

	it(`simple file, chunked mode, allow additional chunks - should succeed`, async () => {
		let options = {wholeFile: undefined}
		var exif = await parse(getPath('IMG_20180725_163423.jpg'), options)
		assert.equal(exif.Make, 'Google')
	})

	it(`simple file, chunked mode, no additional chunks - should succeed`, async () => {
		let options = {wholeFile: false}
		var exif = await parse(getPath('IMG_20180725_163423.jpg'), options)
		assert.equal(exif.Make, 'Google')
	})

	// Exif is scattered throughout the file.
	// Header at the beginning of file, data at the end.
	// tiff offset at 0; ID0 offset at 677442

	it(`scattered file, read/fetch whole file - should succeed`, async () => {
		let options = {wholeFile: true}
		var exif = await parse(getPath('001.tif'), options)
		assert.equal(exif.Make, 'DJI')
	})

	/*
	TODO: rewrite chunked reader for 3.0.0
		it(`scattered file, chunked mode, allow additional chunks - should succeed`, async () => {
			let options = {wholeFile: undefined}
			var exif = await parse(getPath('001.tif'), options)
			assert.equal(exif.Make, 'DJI')
		})

		it(`scattered file, chunked mode, no additional chunks - should fail`, async () => {
			let options = {wholeFile: false}
			var exif = await parse(getPath('001.tif'), options)
			assert.equal(exif, undefined)
		})
	*/

})



describe('parser (exif data)', () => {

	let buffers = {}

	before(async () => {
		let images = [
			'IMG_20180725_163423.jpg',
			'PANO_20180725_162444.jpg',
			'cookiezen.jpg',
			'Bush-dog.jpg',
			'img_1771.jpg',
			'img_1771_no_exif.jpg',
			'fast-exif-issue-2.jpg',
			'node-exif-issue-58.jpg',
			'001.tif',
			'002.tiff',
			'003.jpg',
			'003b.jpg',
			'exif-js-issue-124.tiff',
			'noexif.jpg',
			'DJI_Zenmuse_X3.JPG',
			'DJI_Zenmuse_XT2_640_R_13mm.jpg',
			'DJI_Zenmuse_XT2_640_R_13mm.tiff',
			'FLIR_DUO_PRO_640_R_13mm.JPG',
			'FLIR_DUO_PRO_640_R_13mm.TIFF',
			'FLIR_DUO_PRO_640_R_19mm.JPG',
			'MicaSense_RedEdge_M.tif',
			'MicaSense_Altum_TRM.tif',
			'MicaSense_Altum_MSP.tif',
			'Delair_UX11.jpg',
			'FLIR_Tau_2_640_R_19mm.jpg',
			'Sensefly_Thermomap_9mm.tif',
			'Sensefly_SODA.JPG',
			'Wiris_2nd_Gen_640_19mm.tiff',
			'WingtraOne_Sony_DSC_RX1RII.JPG',
			"DJI_ZH20T.JPG",
			"Phantom 4 RTK.jpg",
			"YUN_0001.JPG"
		]
		for (let name of images) {
			if (isNode)
				buffers[name] = await fs.readFile(getPath(name))
			else
				buffers[name] = await fetch(getPath(name)).then(res => res.arrayBuffer())
		}
	})

	it(`should return undefined if no exif was found`, async () => {
		var exif = await parse(buffers['img_1771_no_exif.jpg'])
		assert.equal(exif, undefined)
	})

	it(`should return undefined if no exif was found (internal .parse() method)`, async () => {
		let intput = buffers['noexif.jpg']
		let parser = new ExifParser()
		await parser.parse(intput)
		let exif = await parser.parse()
		assert.isUndefined(exif)
	})

	describe('TIFF Segment', () => {

		it(`should contain IFD0 block (as exif.image)`, async () => {
			var exif = await parse(buffers['IMG_20180725_163423.jpg'], {mergeOutput: false})
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.image.Make, 'Google')
			assert.equal(exif.image.Model, 'Pixel')
		})

		it(`should contain Exif block (as exif.exif)`, async () => {
			var exif = await parse(buffers['IMG_20180725_163423.jpg'], {mergeOutput: false})
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.exif.ExposureTime, 0.000376)
		})

		it(`should contain GPS block (as exif.gps)`, async () => {
			var exif = await parse(buffers['IMG_20180725_163423.jpg'], {mergeOutput: false})
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.gps.GPSLatitude.length, 3)
			assert.equal(exif.gps.GPSLongitude.length, 3)
		})

		it(`should contain interop if requested`, async () => {
			var exif = await parse(buffers['IMG_20180725_163423.jpg'], {mergeOutput: false, interop: true})
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.interop.InteropIndex, 'R98')
		})

		it(`should contain thumbnail (IFD1) if requested`, async () => {
			var exif = await parse(buffers['IMG_20180725_163423.jpg'], {mergeOutput: false, thumbnail: true})
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.thumbnail.ImageHeight, 189)
		})

		it(`should contain GPS block (as exif.gps) and processing method`, async () => {
			var exif = await parse(buffers['PANO_20180725_162444.jpg'], {mergeOutput: false})
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.gps.GPSProcessingMethod, 'fused', `exif doesn't contain gps`)
		})

		it(`should contain Exif block (as exif.exif) if requested`, async () => {
			var exif = await parse(buffers['img_1771.jpg'])
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.ApertureValue, 4.65625)
		})

	})

	describe('Other segments', () => {

		it(`should contain XMP segment (if whole file buffer is provided and options.xmp is enabled)`, async () => {
			var exif = await parse(buffers['cookiezen.jpg'], {mergeOutput: false, xmp: true, xmpParser: null})
			assert.exists(exif, `exif doesn't exist`)
			assert.typeOf(exif.xmp, 'string', `exif doesn't contain xmp`)
		})

		it(`should contain IPTC segment (as exif.iptc) if requested`, async () => {
			var exif = await parse(buffers['Bush-dog.jpg'], {mergeOutput: false, iptc: true})
			assert.exists(exif, `exif doesn't exist`)
			assert.typeOf(exif.iptc.caption, 'string')
			assert.equal(exif.iptc.credit, 'AP')
			assert.equal(exif.iptc.headline, 'BUSH')
		})

		//it(`should contain ICC segment (as exif.icc) if requested`, async () => {
		//	var exif = await parse(buffers['Bush-dog.jpg'], {mergeOutput: false, icc: true})
		//	assert.exists(exif.icc)
		//})

	})

	describe('output', () => {

		it(`should merge all segments by default`, async () => {
			var exif = await parse(buffers['IMG_20180725_163423.jpg'])
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.Make, 'Google')
			assert.equal(exif.ExposureTime, 0.000376)
			assert.equal(exif.GPSLongitude.length, 3)
		})

		it(`should translate values to string by default`, async () => {
			var exif = await parse(buffers['IMG_20180725_163423.jpg'])
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.Contrast, 'Normal')
			assert.equal(exif.MeteringMode, 'CenterWeightedAverage')
		})

		it(`should not translate values to string if options.postProcess = false`, async () => {
			var exif = await parse(buffers['IMG_20180725_163423.jpg'], {postProcess: false})
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.Contrast, 0)
			assert.equal(exif.MeteringMode, 2)
		})

		// Sitemark: We disabled this, because they get the timezone of the system parsing the exif data
		// it(`should revive dates as Date instance by default`, async () => {
		// 	var exif = await parse(buffers['IMG_20180725_163423.jpg'])
		// 	assert.exists(exif, `exif doesn't exist`)
		// 	assert.instanceOf(exif.DateTimeOriginal, Date)
		// })

		// Sitemark: We return dates as ISO strings without milliseconds and timezone
		it(`should revive dates as Date instance by default`, async () => {
			var exif = await parse(buffers['IMG_20180725_163423.jpg'])
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.DateTimeOriginal, '2018-07-25T16:34:23')
		})

		it(`should not revive dates as Date instance if options.postProcess = false`, async () => {
			var exif = await parse(buffers['IMG_20180725_163423.jpg'], {postProcess: false})
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.DateTimeOriginal, '2018:07:25 16:34:23')
		})

	})

	describe('issues (special cases)', () => {

		it(`#2 - 001.tif starting with 49 49`, async () => {
			var exif = await parse(buffers['001.tif'])
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.Make, 'DJI')
			assert.equal(exif.ImageWidth, '640')
			//assert.equal(exif.ImageHeight, '512')
			assert.equal(exif.latitude, 50.86259891666667)
		})

		it(`#2 - 002.tiff with value type 13 (IFD pointer) instead of 4`, async () => {
			let options = {
				gps: true,
				mergeOutput: false,
			}
			var exif = await parse(buffers['002.tiff'], options)
			assert.exists(exif.gps)
		})

		describe(`#3 - jpeg with additional FLIR APP1 segment`, () => {

			it(`003.jpg`, async () => {
				var exif = await parse(buffers['003.jpg'], { flir: true, mergeOutput: false })
				assert.exists(exif.flir, `flir doesn't exist`)
				assert.equal(exif.flir.creator, 'ATAU_RBFO')
				assert.equal(exif.flir.version, 100)
				assert.equal(exif.flir.RawThermalImageWidth, 640)
				assert.equal(exif.flir.RawThermalImageHeight, 512)
				assert.equal(exif.flir.Emissivity, 1)
				assert.equal(exif.flir.ObjectDistance, 20)
				assert.equal(exif.flir.ReflectedApparentTemperature, 295.1499938964844)
				assert.equal(exif.flir.AtmosphericTemperature, 295.1499938964844)
				assert.equal(exif.flir.IRWindowTemperature, 295.1499938964844)
				assert.equal(exif.flir.IRWindowTransmission, 1)
				assert.equal(exif.flir.RelativeHumidity, 0.5)
				assert.equal(exif.flir.PlanckR1, 17096.453125)
				assert.equal(exif.flir.PlanckB, 1428)
				assert.equal(exif.flir.PlanckF, 1)
				assert.equal(exif.flir.AtmosphericTransAlpha1, 0.006568999961018562)
				assert.equal(exif.flir.AtmosphericTransAlpha2, 0.012620000168681145)
				assert.equal(exif.flir.AtmosphericTransBeta1, -0.00227600010111928)
				assert.equal(exif.flir.AtmosphericTransBeta2, -0.006670000031590462)
				assert.equal(exif.flir.AtmosphericTransX, 1.899999976158142)
				assert.equal(exif.flir.CameraTemperatureRangeMax, 408.1499938964844)
				assert.equal(exif.flir.CameraTemperatureRangeMin, 248.14999389648438)
				assert.equal(exif.flir.UnknownTemperature1, 423.1499938964844)
				assert.equal(exif.flir.UnknownTemperature2, 213.14999389648438)
				assert.equal(exif.flir.UnknownTemperature3, 408.1499938964844)
				assert.equal(exif.flir.UnknownTemperature4, 248.14999389648438)
				assert.equal(exif.flir.UnknownTemperature5, 423.1499938964844)
				assert.equal(exif.flir.UnknownTemperature6, 213.14999389648438)
				assert.equal(exif.flir.CameraModel, '')
				assert.equal(exif.flir.CameraPartNumber, '')
				assert.equal(exif.flir.CameraSerialNumber, '')
				assert.equal(exif.flir.CameraSoftware, '')
				assert.equal(exif.flir.LensModel, '')
				assert.equal(exif.flir.LensPartNumber, '')
				assert.equal(exif.flir.LensSerialNumber, '')
				assert.equal(exif.flir.FieldOfView, 0)
				assert.equal(exif.flir.FilterModel, '')
				assert.equal(exif.flir.FilterPartNumber, '')
				assert.equal(exif.flir.FilterSerialNumber, '')
				assert.equal(exif.flir.PlanckO, -70)
				assert.equal(exif.flir.PlanckR2, 0.0441913828253746)
				assert.equal(exif.flir.RawValueMedian, 3408)
				assert.equal(exif.flir.RawValueRange, 3291)
				assert.equal(exif.flir.FocusStepCount, 0)
				assert.equal(exif.flir.FocusDistance, 0)
			})

			it(`003b.jpg`, async () => {
				var exif = await parse(buffers['003b.jpg'], { flir: true, mergeOutput: false })
				assert.exists(exif.flir, `flir doesn't exist`)
				assert.equal(exif.flir.creator, 'ATAU_RBFO')
				assert.equal(exif.flir.version, 100)
				assert.equal(exif.flir.RawThermalImageWidth, 640)
				assert.equal(exif.flir.RawThermalImageHeight, 512)
				assert.equal(exif.flir.Emissivity, 1)
				assert.equal(exif.flir.ObjectDistance, 10)
				assert.equal(exif.flir.ReflectedApparentTemperature, 295.1499938964844)
				assert.equal(exif.flir.AtmosphericTemperature, 295.1499938964844)
				assert.equal(exif.flir.IRWindowTemperature, 295.1499938964844)
				assert.equal(exif.flir.IRWindowTransmission, 1)
				assert.equal(exif.flir.RelativeHumidity, 0.5)
				assert.equal(exif.flir.PlanckR1, 53035)
				assert.equal(exif.flir.PlanckB, 1470)
				assert.equal(exif.flir.PlanckF, 1)
				assert.equal(exif.flir.AtmosphericTransAlpha1, 0.006568999961018562)
				assert.equal(exif.flir.AtmosphericTransAlpha2, 0.012620000168681145)
				assert.equal(exif.flir.AtmosphericTransBeta1, -0.00227600010111928)
				assert.equal(exif.flir.AtmosphericTransBeta2, -0.006670000031590462)
				assert.equal(exif.flir.AtmosphericTransX, 1.899999976158142)
				assert.equal(exif.flir.CameraTemperatureRangeMax, 408.1499938964844)
				assert.equal(exif.flir.CameraTemperatureRangeMin, 248.14999389648438)
				assert.equal(exif.flir.UnknownTemperature1, 408.1499938964844)
				assert.equal(exif.flir.UnknownTemperature2, 228.14999389648438)
				assert.equal(exif.flir.UnknownTemperature3, 408.1499938964844)
				assert.equal(exif.flir.UnknownTemperature4, 248.14999389648438)
				assert.equal(exif.flir.UnknownTemperature5, 423.1499938964844)
				assert.equal(exif.flir.UnknownTemperature6, 223.14999389648438)
				assert.equal(exif.flir.CameraModel, 'FLIR Tau 2 640')
				assert.equal(exif.flir.CameraPartNumber, '46640019H-SRNLX')
				assert.equal(exif.flir.CameraSerialNumber, '148722')
				assert.equal(exif.flir.CameraSoftware, '')
				assert.equal(exif.flir.LensModel, 'FOL19')
				assert.equal(exif.flir.LensPartNumber, '*')
				assert.equal(exif.flir.LensSerialNumber, '*')
				assert.equal(exif.flir.FieldOfView, 0)
				assert.equal(exif.flir.FilterModel, '')
				assert.equal(exif.flir.FilterPartNumber, '')
				assert.equal(exif.flir.FilterSerialNumber, '')
				assert.equal(exif.flir.PlanckO, -781)
				assert.equal(exif.flir.PlanckR2, 1)
				assert.equal(exif.flir.RawValueMedian, 1263)
				assert.equal(exif.flir.RawValueRange, 282)
				assert.equal(exif.flir.FocusStepCount, 0)
				assert.equal(exif.flir.FocusDistance, 0)
				assert.equal(exif.flir.PaletteName, 'Rainbow')
				assert.equal(exif.flir.GPSMapDatum, 'WGS-84')
			})

		})

		it(`fast-exif #2 - should not skip exif if 0xFF byte precedes marker`, async () => {
			var exif = await parse(buffers['fast-exif-issue-2.jpg'], {})
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.ApertureValue, 5.655638)
			assert.equal(exif.LensModel, '24.0-70.0 mm f/2.8')
		})

		it(`node-exif #58 - should properly detect EXIF`, async () => {
			var exif = await parse(buffers['node-exif-issue-58.jpg'], { xmp: true })
			assert.exists(exif, `exif doesn't exist`)
			assert.exists(exif.xmp)
		})

		it(`exif-js #124`, async () => {
			var exif = await parse(buffers['exif-js-issue-124.tiff'], {})
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.Make, 'FLIR')
		})

	})

	describe('thumbnail', () => {

		let options = {
			thumbnail: true,
			mergeOutput: false,
		}

		it(`#extractThumbnail() returns Buffer or ArrayBuffer of thumbnail`, async () => {
			let intput = buffers['IMG_20180725_163423.jpg']
			let parser = new ExifParser(options)
			await parser.read(intput)
			var output = await parser.extractThumbnail()
			output = new Uint8Array(output)
			assert.equal(output[0], 0xff)
			assert.equal(output[1], 0xd8)
		})

		it(`#extractThumbnail() returns Buffer or ArrayBuffer of thumbnail (forced after with mergeOutput)`, async () => {
			let intput = buffers['IMG_20180725_163423.jpg']
			let parser = new ExifParser(true)
			await parser.read(intput)
			var output = await parser.extractThumbnail()
			output = new Uint8Array(output)
			assert.equal(output[0], 0xff)
			assert.equal(output[1], 0xd8)
		})

		it(`#extractThumbnail() returns Buffer or ArrayBuffer of thumbnail (default)`, async () => {
			let intput = buffers['IMG_20180725_163423.jpg']
			let parser = new ExifParser()
			await parser.read(intput)
			var output = await parser.extractThumbnail()
			output = new Uint8Array(output)
			assert.equal(output[0], 0xff)
			assert.equal(output[1], 0xd8)
		})

		it(`#extractThumbnail() returns undefined if there's no exif`, async () => {
			let intput = buffers['cookiezen.jpg']
			let parser = new ExifParser()
			await parser.read(intput)
			var output = await parser.extractThumbnail()
			assert.isUndefined(output)
		})

		it(`#extractThumbnail() returns undefined if there's no thumbnail`, async () => {
			let intput = buffers['noexif.jpg']
			let parser = new ExifParser(options)
			await parser.read(intput)
			assert.isUndefined(await parser.extractThumbnail())
		})

		it(`thumbnailBuffer()`, async () => {
			let intput = buffers['IMG_20180725_163423.jpg']
			var output = await thumbnailBuffer(intput, options)
			// Buffer in Node, ArrayBuffer in browser
			output = new Uint8Array(output)
			assert.equal(output[0], 0xff)
			assert.equal(output[1], 0xd8)
		})

		isBrowser && it(`thumbnailUrl()`, async () => {
			let intput = buffers['IMG_20180725_163423.jpg']
			var url = await thumbnailUrl(intput, options)
			assert.typeOf(url, 'string')
		})

	})

	describe('cameras', () => {

		const options = { xmp: true, flir: true, sof: true }

		it('DJI Zenmuse X3', async () => {
			const exif = await parse(buffers['DJI_Zenmuse_X3.JPG'], options)
			assert.exists(exif, `exif doesn't exist`)
			assert.strictEqual(exif.ImageDescription, "DCIM\\100MEDIA\\DJI_0002.JPG")
			assert.strictEqual(exif.Make, "DJI")
			assert.strictEqual(exif.Model, "FC350")
			assert.strictEqual(exif.Orientation, 1)
			assert.strictEqual(exif.XResolution, 72)
			assert.strictEqual(exif.YResolution, 72)
			assert.strictEqual(exif.ResolutionUnit, 2)
			assert.strictEqual(exif.Software, "v02.70.5440")
			assert.strictEqual(exif.ModifyDate, "2017-03-14T14:15:40")
			assert.strictEqual(exif.YCbCrPositioning, 1)
			assert.strictEqual(exif.ExposureTime, 0.001995)
			assert.strictEqual(exif.FNumber, 2.8)
			assert.strictEqual(exif.ExposureProgram, "Shutter priority")
			assert.strictEqual(exif.ISO, 139)
			assert.strictEqual(exif.ExifVersion, "0230")
			assert.strictEqual(exif.DateTimeOriginal, "2017-03-14T14:15:40")
			assert.strictEqual(exif.DateTimeDigitized, "2017-03-14T14:15:40")
			assert.strictEqual(exif.ComponentsConfiguration, "-, Cr, Cb, Y")
			assert.strictEqual(exif.CompressedBitsPerPixel, 3.377127111111111)
			assert.strictEqual(exif.ShutterSpeedValue, 8.968)
			assert.strictEqual(exif.ApertureValue, 2.97)
			assert.strictEqual(exif.ExposureBiasValue, 0)
			assert.strictEqual(exif.MaxApertureValue, 1)
			assert.strictEqual(exif.SubjectDistance, 0)
			assert.strictEqual(exif.MeteringMode, "CenterWeightedAverage")
			assert.strictEqual(exif.LightSource, "Unknown")
			assert.strictEqual(exif.Flash, "No flash function")
			assert.strictEqual(exif.FocalLength, 3.61)
			assert.strictEqual(exif.FlashpixVersion, "0010")
			assert.strictEqual(exif.ColorSpace, 1)
			assert.strictEqual(exif.PixelXDimension, 4000)
			assert.strictEqual(exif.PixelYDimension, 2250)
			assert.strictEqual(exif.InteroperabilityIFDPointer, 656)
			assert.strictEqual(exif.SceneType, "")
			assert.strictEqual(exif.CustomRendered, "Normal process")
			assert.strictEqual(exif.ExposureMode, "Auto exposure")
			assert.strictEqual(exif.WhiteBalance, "Auto white balance")
			assert.strictEqual(exif.FocalLengthIn35mmFormat, 20)
			assert.strictEqual(exif.SceneCaptureType, "Standard")
			assert.strictEqual(exif.GainControl, "None")
			assert.strictEqual(exif.Contrast, "Normal")
			assert.strictEqual(exif.Saturation, "Normal")
			assert.strictEqual(exif.Sharpness, "Normal")
			assert.strictEqual(exif.SubjectDistanceRange, "Unknown")
			assert.strictEqual(exif.GPSVersionID, "0.0.0.0")
			assert.strictEqual(exif.GPSLatitudeRef, "N")
			assert.deepEqual(exif.GPSLatitude, [50, 51, 32.5779])
			assert.strictEqual(exif.GPSLongitudeRef, "E")
			assert.deepEqual(exif.GPSLongitude, [4, 40, 43.3816])
			assert.strictEqual(exif.GPSAltitudeRef, 1)
			assert.strictEqual(exif.GPSAltitude, 116.63)
			assert.strictEqual(exif.latitude, 50.85904941666667)
			assert.strictEqual(exif.longitude, 4.678717111111111)

			// XMP
			assert.exists(exif.xmp)
			assert.strictEqual(exif.xmp['rdf:about'], 'DJI Meta Data')
			assert.strictEqual(exif.xmp['xmp:ModifyDate'], '2017-03-14')
			assert.strictEqual(exif.xmp['xmp:CreateDate'], '2017-03-14')
			assert.strictEqual(exif.xmp['tiff:Make'], 'DJI')
			assert.strictEqual(exif.xmp['tiff:Model'], 'FC350')
			assert.strictEqual(exif.xmp['dc:format'], 'image/jpeg')
			assert.strictEqual(exif.xmp['drone-dji:AbsoluteAltitude'], -116.63)
			assert.strictEqual(exif.xmp['drone-dji:RelativeAltitude'], 29.40)
			assert.strictEqual(exif.xmp['drone-dji:GimbalRollDegree'], 0.00)
			assert.strictEqual(exif.xmp['drone-dji:GimbalYawDegree'], 46.60)
			assert.strictEqual(exif.xmp['drone-dji:GimbalPitchDegree'], -90.00)
			assert.strictEqual(exif.xmp['drone-dji:FlightRollDegree'], -8.70)
			assert.strictEqual(exif.xmp['drone-dji:FlightYawDegree'], 44.70)
			assert.strictEqual(exif.xmp['drone-dji:FlightPitchDegree'], 0.20)
			assert.strictEqual(exif.xmp['drone-dji:FlightXSpeed'], -0.20)
			assert.strictEqual(exif.xmp['drone-dji:FlightYSpeed'], 0.10)
			assert.strictEqual(exif.xmp['drone-dji:FlightZSpeed'], 0.00)
			assert.strictEqual(exif.xmp['drone-dji:CamReverse'], false)
			assert.strictEqual(exif.xmp['drone-dji:GimbalReverse'], false)
			assert.strictEqual(exif.xmp['crs:Version'], '7.0')
			assert.strictEqual(exif.xmp['crs:HasSettings'], false)
			assert.strictEqual(exif.xmp['crs:HasCrop'], false)
			assert.strictEqual(exif.xmp['crs:AlreadyApplied'], false)

			// SOF
			assert.strictEqual(exif.sof.ImageHeight, 2250)
			assert.strictEqual(exif.sof.ImageWidth, 4000)
		})


		describe('DJI Zenmuse XT2 640 R 13mm', () => {

			it('RGB', async () => {
				const exif = await parse(buffers['DJI_Zenmuse_XT2_640_R_13mm.jpg'], options)
				assert.exists(exif, `exif doesn't exist`)
				assert.strictEqual(exif.ImageDescription, 'DCIM/102MEDIA/DJI_0002.jpg')
				assert.strictEqual(exif.Make, 'DJI')
				assert.strictEqual(exif.Model, 'XT2')
				assert.strictEqual(exif.PixelXDimension, 4000)
				assert.strictEqual(exif.PixelYDimension, 3000)
				assert.strictEqual(exif.Orientation, 1)
				assert.strictEqual(exif.XResolution, 72)
				assert.strictEqual(exif.YResolution, 72)
				assert.strictEqual(exif.ResolutionUnit, 2)
				assert.strictEqual(exif.Software, 'V06.02.20')
				assert.strictEqual(exif.ModifyDate, '2019-05-24T15:24:01')
				assert.strictEqual(exif.YCbCrPositioning, 1)
				assert.strictEqual(exif.ExposureTime, 0.01)
				assert.strictEqual(exif.FNumber, 1.8)
				assert.strictEqual(exif.ExposureProgram, 'Normal program')
				assert.strictEqual(exif.ISO, 128)
				assert.strictEqual(exif.ExifVersion, '0210')
				assert.strictEqual(exif.DateTimeOriginal, '2019-05-24T15:24:01')
				assert.strictEqual(exif.DateTimeDigitized, '2019-05-24T15:24:01')
				assert.strictEqual(exif.ComponentsConfiguration, 'Y, Cb, Cr, -')
				assert.strictEqual(exif.ShutterSpeedValue, 6.643)
				assert.strictEqual(exif.ApertureValue, 1.7)
				assert.strictEqual(exif.ExposureBiasValue, 0)
				assert.strictEqual(exif.MaxApertureValue, 1.7)
				assert.strictEqual(exif.MeteringMode, 'Spot')
				assert.strictEqual(exif.LightSource, 'Unknown')
				assert.strictEqual(exif.Flash, 'Flash did not fire')
				assert.strictEqual(exif.FocalLength, 8)
				assert.deepEqual(exif.SubjectArea, [ 2000, 1500, 4000, 3000 ])
				assert.strictEqual(exif.FlashpixVersion, '0100')
				assert.strictEqual(exif.ColorSpace, 1)
				assert.strictEqual(exif.PixelXDimension, 4000)
				assert.strictEqual(exif.PixelYDimension, 3000)
				assert.strictEqual(exif.SceneType, 'Directly photographed')
				assert.strictEqual(exif.GPSVersionID, '2.2.0.0')
				assert.strictEqual(exif.GPSLatitudeRef, 'N')
				assert.deepEqual(exif.GPSLatitude, [ 39, 55, 3.4927368 ])
				assert.strictEqual(exif.GPSLongitudeRef, 'W')
				assert.deepEqual(exif.GPSLongitude, [ 2, 49, 22.7140048 ])
				assert.strictEqual(exif.GPSAltitudeRef, 0)
				assert.strictEqual(exif.GPSAltitude, 881.609)
				assert.strictEqual(exif.latitude, 39.91763687133333)
				assert.strictEqual(exif.longitude, -2.822976112444444)

				// XMP
				assert.exists(exif.xmp)
				assert.strictEqual(exif.xmp['rdf:about'], 'DJI Meta Data')
				assert.strictEqual(exif.xmp['drone-dji:AbsoluteAltitude'], 881.609192)
				assert.strictEqual(exif.xmp['drone-dji:RelativeAltitude'], 34.400002)
				assert.strictEqual(exif.xmp['drone-dji:GimbalRollDegree'], 0)
				assert.strictEqual(exif.xmp['drone-dji:GimbalYawDegree'], 89.300003)
				assert.strictEqual(exif.xmp['drone-dji:GimbalPitchDegree'], -89.900002)
				assert.strictEqual(exif.xmp['drone-dji:FlightRollDegree'], -6.5)
				assert.strictEqual(exif.xmp['drone-dji:FlightYawDegree'], 90)
				assert.strictEqual(exif.xmp['drone-dji:FlightPitchDegree'], -2.4)
				assert.strictEqual(exif.xmp['drone-dji:CamReverse'], false)
				assert.strictEqual(exif.xmp['drone-dji:GimbalReverse'], false)
				assert.strictEqual(exif.xmp['drone-dji:RtkFlag'], 0)

				// SOF
				assert.strictEqual(exif.sof.ImageHeight, 3000)
				assert.strictEqual(exif.sof.ImageWidth, 4000)
			})

			it('TRM', async () => {
				const exif = await parse(buffers['DJI_Zenmuse_XT2_640_R_13mm.tiff'], options)
				assert.exists(exif, `exif doesn't exist`)
				assert.strictEqual(exif.ImageWidth, 640)
				assert.strictEqual(exif.ImageHeight, 512)
				assert.strictEqual(exif.BitsPerSample, 16)
				assert.strictEqual(exif.Compression, 1)
				assert.strictEqual(exif.PhotometricInterpretation, 1)
				assert.strictEqual(exif.Make, 'DJI')
				assert.strictEqual(exif.Model, 'XT2')
				assert.strictEqual(exif.StripOffsets, 8)
				assert.strictEqual(exif.SamplesPerPixel, 1)
				assert.strictEqual(exif.RowsPerStrip, 512)
				assert.strictEqual(exif.StripByteCounts, 655360)
				assert.strictEqual(exif.XResolution, 1)
				assert.strictEqual(exif.YResolution, 1)
				assert.strictEqual(exif.PlanarConfiguration, 1)
				assert.strictEqual(exif.ResolutionUnit, 1)
				assert.deepEqual(exif.PageNumber, [ 0, 1 ])
				assert.strictEqual(exif.Software, 'V06.02.20')
				assert.strictEqual(exif.SampleFormat, 1)
				assert.strictEqual(exif.CameraSerialNumber, '297394')
				assert.strictEqual(exif.FNumber, 1.25)
				assert.strictEqual(exif.DateTimeOriginal, '2019-05-24T15:24:01')
				assert.strictEqual(exif.FocalLength, 13)
				assert.strictEqual(exif.ImageNumber, 0)
				assert.strictEqual(exif.SubSecTimeOriginal, '52')
				assert.strictEqual(exif.FocalPlaneXResolution, 3.84)
				assert.strictEqual(exif.FocalPlaneYResolution, 3.072)
				assert.strictEqual(exif.FocalPlaneResolutionUnit, 4)
				assert.strictEqual(exif.SensingMethod, 15)
				assert.strictEqual(exif.GPSLatitudeRef, 'N')
				assert.deepEqual(exif.GPSLatitude, [ 39, 55, 3.493 ])
				assert.strictEqual(exif.GPSLongitudeRef, 'W')
				assert.deepEqual(exif.GPSLongitude, [ 2, 49, 22.714 ])
				assert.strictEqual(exif.GPSAltitudeRef, 0)
				assert.strictEqual(exif.GPSAltitude, 881.609)
				assert.strictEqual(exif.GPSMapDatum, 'WGS-84')
				assert.strictEqual(exif.latitude, 39.91763694444444)
				assert.strictEqual(exif.longitude, -2.8229761111111107)

				// XMP
				assert.exists(exif.xmp)
				assert.strictEqual(exif.xmp['rdf:about'], 'DJI Meta Data')
				assert.strictEqual(exif.xmp['drone-dji:AbsoluteAltitude'], 881.609192)
				assert.strictEqual(exif.xmp['drone-dji:RelativeAltitude'], 34.400002)
				assert.strictEqual(exif.xmp['drone-dji:GimbalRollDegree'], 0)
				assert.strictEqual(exif.xmp['drone-dji:GimbalYawDegree'], 89.300003)
				assert.strictEqual(exif.xmp['drone-dji:GimbalPitchDegree'], -89.900002)
				assert.strictEqual(exif.xmp['drone-dji:FlightRollDegree'], -6.500000)
				assert.strictEqual(exif.xmp['drone-dji:FlightYawDegree'], 90)
				assert.strictEqual(exif.xmp['drone-dji:FlightPitchDegree'], -2.4)
				assert.strictEqual(exif.xmp['drone-dji:CamReverse'], false)
				assert.strictEqual(exif.xmp['drone-dji:GimbalReverse'], false)
				assert.strictEqual(exif.xmp['drone-dji:RtkFlag'], 0)
				assert.strictEqual(exif.xmp['FLIR:TlinearGain'], 0.04)
				assert.deepEqual(exif.xmp['FLIR:BandName'], [
					{ value: 'LWIR', attributes: {}, description: 'LWIR' }
				])
				assert.deepEqual(exif.xmp['FLIR:CentralWavelength'], [
					{ value: 10000, attributes: {}, description: '10000' }
				])
				assert.deepEqual(exif.xmp['FLIR:WavelengthFWHM'], [
					{ value: 4500, attributes: {}, description: '4500' }
				])
			})

		})

		describe('FLIR DUO PRO 640 R 13mm', () => {

			it('RGB', async () => {
				const exif = await parse(buffers['FLIR_DUO_PRO_640_R_13mm.JPG'], options)
				assert.exists(exif, `exif doesn't exist`)
				assert.strictEqual(exif.Make, 'FLIR')
				assert.strictEqual(exif.Model, 'Duo Pro R')
				assert.strictEqual(exif.XResolution, 72)
				assert.strictEqual(exif.YResolution, 72)
				assert.strictEqual(exif.ResolutionUnit, 2)
				assert.strictEqual(exif.Software, 'V01.02.05')
				assert.strictEqual(exif.YCbCrPositioning, 1)
				assert.strictEqual(exif.FNumber, 1.8)
				assert.strictEqual(exif.FocalLength, 8)
				assert.strictEqual(exif.FocalPlaneXResolution, 10.88)
				assert.strictEqual(exif.FocalPlaneYResolution, 8.704)
				assert.strictEqual(exif.FocalPlaneResolutionUnit, 4)
				assert.strictEqual(exif.ExifVersion, '0210')
				assert.strictEqual(exif.ComponentsConfiguration, 'Y, Cb, Cr, -')
				assert.deepEqual(exif.SubjectArea, [ 2000, 1500, 4000, 3000 ])
				assert.strictEqual(exif.FlashpixVersion, '0100')
				assert.strictEqual(exif.ColorSpace, 1)
				assert.strictEqual(exif.PixelXDimension, 4000)
				assert.strictEqual(exif.PixelYDimension, 3000)
				assert.strictEqual(exif.GPSVersionID, '3.2.0.0')
				assert.strictEqual(exif.GPSLatitudeRef, 'S')
				assert.deepEqual(exif.GPSLatitude, [ 0, 0, 0 ])
				assert.strictEqual(exif.GPSLongitudeRef, 'W')
				assert.deepEqual(exif.GPSLongitude, [ 0, 0, 0 ])
				assert.strictEqual(exif.GPSAltitudeRef, 0)
				assert.strictEqual(exif.GPSAltitude, 0)
				assert.strictEqual(exif.GPSTimeStamp, '12:1:23')
				assert.strictEqual(exif.GPSSpeedRef, 'K')
				assert.strictEqual(exif.GPSSpeed, 0)
				assert.strictEqual(exif.GPSTrackRef, 'T')
				assert.strictEqual(exif.GPSTrack, 0)
				assert.strictEqual(exif.latitude, 0)
				assert.strictEqual(exif.longitude, 0)

				// XMP
				assert.exists(exif.xmp)
				assert.strictEqual(exif.xmp['rdf:about'], '')
				assert.deepEqual(exif.xmp['Camera:BandName'], [
					{ value: 'LWIR', attributes: {}, description: 'LWIR' },
				])
				assert.strictEqual(exif.xmp['Camera:Yaw'], '16319/100')
				assert.strictEqual(exif.xmp['Camera:Pitch'], '-8759/100')
				assert.strictEqual(exif.xmp['Camera:Roll'], '-9509/100')
				assert.strictEqual(exif.xmp['Camera:GPSXYAccuracy'], 4294967.5)
				assert.strictEqual(exif.xmp['Camera:GPSZAccuracy'], 3750005.75)
				assert.strictEqual(exif.xmp['Camera:GyroRate'], 0)
				assert.strictEqual(exif.xmp['Camera:DetectorBitDepth'], 16)
				assert.strictEqual(exif.xmp['Camera:IsNormalized'], true)
				assert.strictEqual(exif.xmp['FLIR:MAVVersionID'], '0.3.0.0')
				assert.strictEqual(exif.xmp['FLIR:MAVComponentID'], 100)
				assert.strictEqual(exif.xmp['FLIR:MAVRelativeAltitude'], '0/1000')
				assert.strictEqual(exif.xmp['FLIR:MAVRateOfClimbRef'], 'M')
				assert.strictEqual(exif.xmp['FLIR:MAVRateOfClimb'], '0/1000')
				assert.strictEqual(exif.xmp['FLIR:MAVYaw'], '0/100')
				assert.strictEqual(exif.xmp['FLIR:MAVPitch'], '0/100')
				assert.strictEqual(exif.xmp['FLIR:MAVRoll'], '0/100')
				assert.strictEqual(exif.xmp['FLIR:MAVYawRate'], '0/100')
				assert.strictEqual(exif.xmp['FLIR:MAVPitchRate'], '0/100')
				assert.strictEqual(exif.xmp['FLIR:MAVRollRate'], '0/100' )

				// SOF
				assert.strictEqual(exif.sof.ImageHeight, 3000)
				assert.strictEqual(exif.sof.ImageWidth, 4000)
			})

			it('TRM', async () => {
				const exif = await parse(buffers['FLIR_DUO_PRO_640_R_13mm.TIFF'], options)
				assert.exists(exif, `exif doesn't exist`)
				assert.strictEqual(exif.ImageWidth, 640)
				assert.strictEqual(exif.ImageHeight, 512)
				assert.strictEqual(exif.BitsPerSample, 16)
				assert.strictEqual(exif.Compression, 1)
				assert.strictEqual(exif.PhotometricInterpretation, 1)
				assert.strictEqual(exif.Make, 'FLIR')
				assert.strictEqual(exif.Model, 'Duo Pro R')
				assert.strictEqual(exif.StripOffsets, 8)
				assert.strictEqual(exif.SamplesPerPixel, 1)
				assert.strictEqual(exif.RowsPerStrip, 512)
				assert.strictEqual(exif.StripByteCounts, 655360)
				assert.strictEqual(exif.XResolution, 1)
				assert.strictEqual(exif.YResolution, 1)
				assert.strictEqual(exif.PlanarConfiguration, 1)
				assert.strictEqual(exif.ResolutionUnit, 1)
				assert.deepEqual(exif.PageNumber, [ 0, 1 ])
				assert.strictEqual(exif.Software, 'V01.02.05')
				assert.strictEqual(exif.SampleFormat, 1)
				assert.strictEqual(exif.CameraSerialNumber, '298067')
				assert.strictEqual(exif.FNumber, 1.25)
				assert.strictEqual(exif.DateTimeOriginal, '2019-06-14T12:01:23')
				assert.strictEqual(exif.FocalLength, 13)
				assert.strictEqual(exif.ImageNumber, 0)
				assert.strictEqual(exif.SubSecTimeOriginal, '51')
				assert.strictEqual(exif.FocalPlaneXResolution, 10.88)
				assert.strictEqual(exif.FocalPlaneYResolution, 8.7)
				assert.strictEqual(exif.FocalPlaneResolutionUnit, 4)
				assert.strictEqual(exif.SensingMethod, 15)
				assert.strictEqual(exif.GPSVersionID, '3.2.0.0')
				assert.strictEqual(exif.GPSLatitudeRef, 'S')
				assert.deepEqual(exif.GPSLatitude, [ 0, 0, 0 ])
				assert.strictEqual(exif.GPSLongitudeRef, 'W')
				assert.deepEqual(exif.GPSLongitude, [ 0, 0, 0 ])
				assert.strictEqual(exif.GPSAltitudeRef, 0)
				assert.strictEqual(exif.GPSAltitude, 0)
				assert.strictEqual(exif.GPSMapDatum, 'WGS-84')
				assert.strictEqual(exif.latitude, 0)
				assert.strictEqual(exif.longitude, 0)

				// XMP
				assert.exists(exif.xmp)
				assert.strictEqual(exif.xmp['rdf:about'], '')
				assert.deepEqual(exif.xmp['Camera:BandName'], [
					{ value: 'LWIR', attributes: {}, description: 'LWIR' },
				])
				assert.deepEqual(exif.xmp['Camera:CentralWavelength'], [
					{ value: 10000, attributes: {}, description: '10000' },
				])
				assert.deepEqual(exif.xmp['Camera:WavelengthFWHM'], [
					{ value: 4500, attributes: {}, description: '4500' },
				])
				assert.strictEqual(exif.xmp['Camera:TlinearGain'], 0.04)
				assert.strictEqual(exif.xmp['Camera:Yaw'], '16319/100')
				assert.strictEqual(exif.xmp['Camera:Pitch'], '-8759/100')
				assert.strictEqual(exif.xmp['Camera:Roll'], '-9509/100')
				assert.strictEqual(exif.xmp['Camera:GPSXYAccuracy'], 4294967.5)
				assert.strictEqual(exif.xmp['Camera:GPSZAccuracy'], 3750005.75)
				assert.strictEqual(exif.xmp['Camera:GyroRate'], 0)
				assert.strictEqual(exif.xmp['Camera:DetectorBitDepth'], 16)
				assert.strictEqual(exif.xmp['Camera:IsNormalized'], true)
				assert.strictEqual(exif.xmp['FLIR:ImageOffsetX'], 0)
				assert.strictEqual(exif.xmp['FLIR:ImageOffsetY'], 0)
				assert.strictEqual(exif.xmp['FLIR:ImageValidStartX'], 0)
				assert.strictEqual(exif.xmp['FLIR:ImageValidEndX'], 639)
				assert.strictEqual(exif.xmp['FLIR:ImageValidStartY'], 0)
				assert.strictEqual(exif.xmp['FLIR:ImageValidEndY'], 511)
				assert.strictEqual(exif.xmp['FLIR:ImageUpsampleMode'], 2)
				assert.strictEqual(exif.xmp['FLIR:MAVVersionID'], '0.3.0.0')
				assert.strictEqual(exif.xmp['FLIR:MAVComponentID'], 100)
				assert.strictEqual(exif.xmp['FLIR:MAVRelativeAltitude'], '0/1000')
				assert.strictEqual(exif.xmp['FLIR:MAVRateOfClimbRef'], 'M')
				assert.strictEqual(exif.xmp['FLIR:MAVRateOfClimb'], '0/1000')
				assert.strictEqual(exif.xmp['FLIR:MAVYaw'], '0/100')
				assert.strictEqual(exif.xmp['FLIR:MAVPitch'], '0/100')
				assert.strictEqual(exif.xmp['FLIR:MAVRoll'], '0/100')
				assert.strictEqual(exif.xmp['FLIR:MAVYawRate'], '0/100')
				assert.strictEqual(exif.xmp['FLIR:MAVPitchRate'], '0/100')
				assert.strictEqual(exif.xmp['FLIR:MAVRollRate'], '0/100')
			})

		})

		describe('FLIR DUO PRO 640 R 19mm', () => {

			it('RGB', async () => {
				const exif = await parse(buffers['FLIR_DUO_PRO_640_R_19mm.JPG'], options)
				assert.exists(exif, `exif doesn't exist`)
				assert.strictEqual(exif.Make, 'FLIR')
				assert.strictEqual(exif.Model, 'Duo Pro R')
				assert.strictEqual(exif.XResolution, 1)
				assert.strictEqual(exif.YResolution, 1)
				assert.strictEqual(exif.ResolutionUnit, 1)
				assert.strictEqual(exif.YCbCrPositioning, 1)
				assert.strictEqual(exif.CameraSerialNumber, '8340254')
				assert.strictEqual(exif.ExifVersion, '0231')
				assert.strictEqual(exif.ComponentsConfiguration, 'Y, Cb, Cr, -')
				assert.strictEqual(exif.FocalLength, 19)
				assert.strictEqual(exif.FlashpixVersion, '0100')
				assert.strictEqual(exif.ColorSpace, 65535)
				assert.strictEqual(exif.FocalPlaneXResolution, 10.88)
				assert.strictEqual(exif.FocalPlaneYResolution, 8.704)
				assert.strictEqual(exif.FocalPlaneResolutionUnit, 4)
				assert.strictEqual(exif.GPSVersionID, '2.2.0.0')
				assert.strictEqual(exif.GPSLatitudeRef, 'N')
				assert.deepEqual(exif.GPSLatitude, [ 51, 23, 21.55 ])
				assert.strictEqual(exif.GPSLongitudeRef, 'E')
				assert.deepEqual(exif.GPSLongitude, [ 12, 30, 40.62 ])
				assert.strictEqual(exif.GPSAltitudeRef, 0)
				assert.strictEqual(exif.GPSAltitude, 170.6)
				assert.strictEqual(exif.GPSTimeStamp, '11:45:50')
				assert.strictEqual(exif.GPSSpeedRef, 'K')
				assert.strictEqual(exif.GPSSpeed, 0.52)
				assert.strictEqual(exif.GPSTrackRef, 'T')
				assert.strictEqual(exif.GPSTrack, 281.62)
				assert.strictEqual(exif.GPSMapDatum, 'WGS84')
				assert.strictEqual(exif.latitude, 51.389319444444446)
				assert.strictEqual(exif.longitude, 12.511283333333333)

                // XMP
				assert.strictEqual(exif.xmp['rdf:about'], '')
				assert.strictEqual(exif.xmp['xmpDM:cameraModel'], 'Duo Pro R')

				// SOF
				assert.strictEqual(exif.sof.ImageHeight, 3000)
				assert.strictEqual(exif.sof.ImageWidth, 4000)
			})

		})


		it('MicaSense RedEdge M', async () => {
			const exif = await parse(buffers['MicaSense_RedEdge_M.tif'], options)
			assert.exists(exif, `exif doesn't exist`)
			// TODO: Unknown tags
			assert.strictEqual(exif.SubfileType, 0)
			assert.strictEqual(exif.ImageWidth, 1280)
			assert.strictEqual(exif.ImageHeight, 960)
			assert.strictEqual(exif.BitsPerSample, 16)
			assert.strictEqual(exif.Compression, 1)
			assert.strictEqual(exif.PhotometricInterpretation, 1)
			assert.strictEqual(exif.Make, 'MicaSense')
			assert.strictEqual(exif.Model, 'RedEdge-M')
			assert.deepEqual(exif.StripOffsets, [ 8, 256008, 512008, 768008, 1024008, 1280008, 1536008, 1792008, 2048008, 2304008 ])
			assert.strictEqual(exif.Orientation, 1)
			assert.strictEqual(exif.SamplesPerPixel, 1)
			assert.strictEqual(exif.RowsPerStrip, 100)
			assert.deepEqual(exif.StripByteCounts, [ 256000, 256000, 256000, 256000, 256000, 256000, 256000, 256000, 256000, 153600 ])
			assert.strictEqual(exif.PlanarConfiguration, 1)
			assert.strictEqual(exif.Software, 'v3.3.0')
			assert.strictEqual(exif.ModifyDate, '2018-09-02T12:21:05')
			assert.deepEqual(exif.BlackLevelRepeatDim, [ 2, 2 ])
			assert.deepEqual(exif.BlackLevel, [ 4800, 4800, 4800, 4800 ])
			assert.strictEqual(exif.ExposureTime, 0.00108)
			assert.strictEqual(exif.FNumber, 2.8)
			assert.strictEqual(exif.ExposureProgram, 'Normal program')
			assert.strictEqual(exif.ISOSpeed, 200)
			assert.strictEqual(exif.ExifVersion, '0230')
			assert.strictEqual(exif.DateTimeOriginal, '2018-09-02T12:21:05')
			assert.strictEqual(exif.DateTimeDigitized, '2018-09-02T12:21:05')
			assert.strictEqual(exif.MeteringMode, 'Average')
			assert.strictEqual(exif.FocalLength, 5.5)
			assert.strictEqual(exif.SubSecTime, '-394485')
			assert.strictEqual(exif.FocalPlaneXResolution, 266.666667)
			assert.strictEqual(exif.FocalPlaneYResolution, 266.666667)
			assert.strictEqual(exif.FocalPlaneResolutionUnit, 4)
			assert.strictEqual(exif.BodySerialNumber, 'RM01-1817125-SC')
			assert.strictEqual(exif.GPSVersionID, '2.2.0.0')
			assert.strictEqual(exif.GPSLatitudeRef, 'N')
			assert.deepEqual(exif.GPSLatitude, [ 50, 44, 36.80376 ])
			assert.strictEqual(exif.GPSLongitudeRef, 'E')
			assert.deepEqual(exif.GPSLongitude, [ 4, 55, 41.41272 ])
			assert.strictEqual(exif.GPSAltitudeRef, 0)
			assert.strictEqual(exif.GPSAltitude, 155.125)
			assert.strictEqual(exif.GPSDOP, 1)
			assert.strictEqual(exif.latitude, 50.7435566)
			assert.strictEqual(exif.longitude, 4.9281702)

			// XMP
			assert.exists(exif.xmp)
			assert.strictEqual(exif.xmp['rdf:about'], 'Pix4D Camera Information')
			assert.strictEqual(exif.xmp['MicaSense:BootTimestamp'], 388)
			assert.deepEqual(exif.xmp['MicaSense:RadiometricCalibration'], [
				{ value: 0.00025158791998971484, attributes: {}, description: '0.00025158791998971484' },
				{ value: 7.5512765893711309e-08, attributes: {}, description: '7.5512765893711309e-08' },
				{ value: 5.1259784808667235e-06, attributes: {}, description: '5.1259784808667235e-06' }
			])
			assert.strictEqual(exif.xmp['MicaSense:FlightId'], 'G1R5fuqhYObiVDDUoPY0')
			assert.strictEqual(exif.xmp['MicaSense:CaptureId'], 'G01ph6LOYyFMzjpFQtbV')
			assert.strictEqual(exif.xmp['MicaSense:TriggerMethod'], 4)
			assert.strictEqual(exif.xmp['MicaSense:PressureAlt'], 69.928153991699219)
			assert.deepEqual(exif.xmp['MicaSense:DarkRowValue'], [
				{ value: 5296, attributes: {}, description: '5296' },
				{ value: 5297, attributes: {}, description: '5297' },
				{ value: 5103, attributes: {}, description: '5103' },
				{ value: 5121, attributes: {}, description: '5121' }
			])
			assert.strictEqual(exif.xmp['Camera:BandName'], 'Red')
			assert.strictEqual(exif.xmp['Camera:CentralWavelength'], 668)
			assert.strictEqual(exif.xmp['Camera:WavelengthFWHM'], 10)
			assert.deepEqual(exif.xmp['Camera:VignettingCenter'], [
				{ value: 612.48288362060873, attributes: {}, description: '612.48288362060873' },
				{ value: 479.92852377966585, attributes: {}, description: '479.92852377966585' }
			])
			assert.deepEqual(exif.xmp['Camera:VignettingPolynomial'], [
				{ value: -0.00012364905090800595, attributes: {}, description: '-0.00012364905090800595' },
				{ value: 1.5285817101337687e-06, attributes: {}, description: '1.5285817101337687e-06' },
				{ value: -1.248939732320383e-08, attributes: {}, description: '-1.248939732320383e-08' },
				{ value: 3.615681445589148e-11, attributes: {}, description: '3.615681445589148e-11' },
				{ value: -4.6263897219279838e-14, attributes: {}, description: '-4.6263897219279838e-14' },
				{ value: 2.1225983889505411e-17, attributes: {}, description: '2.1225983889505411e-17' }
			])
			assert.strictEqual(exif.xmp['Camera:ModelType'], 'perspective')
			assert.strictEqual(exif.xmp['Camera:PrincipalPoint'], '2.28596,1.80131')
			assert.strictEqual(exif.xmp['Camera:PerspectiveFocalLength'], 5.4200334330371822)
			assert.strictEqual(exif.xmp['Camera:PerspectiveFocalLengthUnits'], 'mm')
			assert.deepEqual(exif.xmp['Camera:PerspectiveDistortion'], [
				{ value: -0.10090111395504248, attributes: {}, description: '-0.10090111395504248' },
				{ value: 0.14382399474370602, attributes: {}, description: '0.14382399474370602' },
				{ value: -0.026905090009498728, attributes: {}, description: '-0.026905090009498728' },
				{ value: -0.00018872727641257986, attributes: {}, description: '-0.00018872727641257986' },
				{ value: 0.00052417834650675681, attributes: {}, description: '0.00052417834650675681' }
			])
			assert.strictEqual(exif.xmp['Camera:BandSensitivity'], 0.15135489626960455)
			assert.strictEqual(exif.xmp['Camera:RigCameraIndex'], 2)
			assert.strictEqual(exif.xmp['Camera:IrradianceExposureTime'], 0.10100000351667404)
			assert.strictEqual(exif.xmp['Camera:IrradianceGain'], 16)
			assert.strictEqual(exif.xmp['Camera:Irradiance'], 0.84336173534393311)
			assert.strictEqual(exif.xmp['Camera:IrradianceYaw'], 85.346926915151712)
			assert.strictEqual(exif.xmp['Camera:IrradiancePitch'], -8.7011030729229155)
			assert.strictEqual(exif.xmp['Camera:IrradianceRoll'], -2.9012786841546623)
			assert.strictEqual(exif.xmp['DLS:Serial'], 'DL06-1820013-SC')
			assert.strictEqual(exif.xmp['DLS:SwVersion'], 'v1.0.1')
			assert.strictEqual(exif.xmp['DLS:SensorId'], 2)
			assert.strictEqual(exif.xmp['DLS:CenterWavelength'], 668)
			assert.strictEqual(exif.xmp['DLS:Bandwidth'], 10)
			assert.strictEqual(exif.xmp['DLS:TimeStamp'], 393084)
			assert.strictEqual(exif.xmp['DLS:Exposure'], 0.10100000351667404)
			assert.strictEqual(exif.xmp['DLS:Gain'], 16)
			assert.strictEqual(exif.xmp['DLS:SpectralIrradiance'], 0.84336173534393311)
			assert.strictEqual(exif.xmp['DLS:RawMeasurement'], 731)
			assert.strictEqual(exif.xmp['DLS:OffMeasurement'], 2878)
			assert.strictEqual(exif.xmp['DLS:Yaw'], 1.4895848811283643)
			assert.strictEqual(exif.xmp['DLS:Pitch'], -0.15186289717790113)
			assert.strictEqual(exif.xmp['DLS:Roll'], -0.050636865556427491 )
		})

		describe('MicaSense Altum', () => {

			it('MSP', async () => {
				const exif = await parse(buffers['MicaSense_Altum_MSP.tif'], options)
				assert.exists(exif, `exif doesn't exist`)
				// TODO: Unknown tags: 48020, 48021, 48022
				assert.strictEqual(exif.SubfileType, 0)
				assert.strictEqual(exif.ImageWidth, 2064)
				assert.strictEqual(exif.ImageHeight, 1544)
				assert.strictEqual(exif.BitsPerSample, 16)
				assert.strictEqual(exif.Compression, 1)
				assert.strictEqual(exif.PhotometricInterpretation, 1)
				assert.strictEqual(exif.Make, 'MicaSense')
				assert.strictEqual(exif.Model, 'Altum')
				assert.deepEqual(exif.StripOffsets, [
					8,  412808,  825608,
					1238408, 1651208, 2064008,
					2476808, 2889608, 3302408,
					3715208, 4128008, 4540808,
					4953608, 5366408, 5779208,
					6192008
				])
				assert.strictEqual(exif.Orientation, 1)
				assert.strictEqual(exif.SamplesPerPixel, 1)
				assert.strictEqual(exif.RowsPerStrip, 100)
				assert.deepEqual(exif.StripByteCounts, [
					412800, 412800, 412800,
					412800, 412800, 412800,
					412800, 412800, 412800,
					412800, 412800, 412800,
					412800, 412800, 412800,
					181632
				])
				assert.strictEqual(exif.PlanarConfiguration, 1)
				assert.strictEqual(exif.Software, 'v2.0.0')
				assert.strictEqual(exif.ModifyDate, '2020-05-24T16:14:05')
				assert.deepEqual(exif.BlackLevelRepeatDim, [ 2, 2 ])
				assert.deepEqual(exif.BlackLevel, [ 4800, 4800, 4800, 4800 ])
				assert.ok(exif.OpcodeList3 instanceof Buffer)
				assert.strictEqual(exif.ExposureTime, 0.00156121)
				assert.strictEqual(exif.FNumber, 1.8)
				assert.strictEqual(exif.ExposureProgram, 'Normal program')
				assert.strictEqual(exif.ISOSpeed, 800)
				assert.strictEqual(exif.ExifVersion, '0230')
				assert.strictEqual(exif.DateTimeOriginal, '2020-05-24T16:14:05')
				assert.strictEqual(exif.DateTimeDigitized, '2020-05-24T16:14:05')
				assert.strictEqual(exif.MeteringMode, 'Average')
				assert.strictEqual(exif.FocalLength, 8)
				assert.strictEqual(exif.SubSecTime, '499630718')
				assert.strictEqual(exif.FocalPlaneXResolution, 289.855072)
				assert.strictEqual(exif.FocalPlaneYResolution, 289.855072)
				assert.strictEqual(exif.FocalPlaneResolutionUnit, 4)
				assert.strictEqual(exif.BodySerialNumber, 'AL05-1934188-SC')
				assert.strictEqual(exif.GPSVersionID, '2.2.0.0')
				assert.strictEqual(exif.GPSLatitudeRef, 'N')
				assert.deepEqual(exif.GPSLatitude, [ 48, 12, 8.77572 ])
				assert.strictEqual(exif.GPSLongitudeRef, 'E')
				assert.deepEqual(exif.GPSLongitude, [ 6, 24, 9.88776 ])
				assert.strictEqual(exif.GPSAltitudeRef, 0)
				assert.strictEqual(exif.GPSAltitude, 373.829)
				assert.strictEqual(exif.GPSDOP, 0)
				assert.strictEqual(exif.latitude, 48.202437700000004)
				assert.strictEqual(exif.longitude, 6.4027466)

				// XMP
				assert.strictEqual(exif.xmp['rdf:about'], 'Pix4D Camera Information')
				assert.strictEqual(exif.xmp['Camera:RigName'], 'Altum')
				assert.strictEqual(exif.xmp['Camera:BandName'], 'Red edge')
				assert.strictEqual(exif.xmp['Camera:CentralWavelength'], 717)
				assert.strictEqual(exif.xmp['Camera:WavelengthFWHM'], 12)
				assert.strictEqual(exif.xmp['Camera:ModelType'], 'perspective')
				assert.strictEqual(exif.xmp['Camera:PrincipalPoint'], '3.55453,2.56811')
				assert.strictEqual(exif.xmp['Camera:PerspectiveFocalLength'], 7.8035429249999995)
				assert.strictEqual(exif.xmp['Camera:PerspectiveFocalLengthUnits'], 'mm')
				assert.deepEqual(exif.xmp['Camera:PerspectiveDistortion'], [
					{
						value: -0.1400263,
						attributes: {},
						description: '-0.14002629999999999'
					},
					{
						value: 0.2719171,
						attributes: {},
						description: '0.27191710000000002'
					},
					{
						value: -0.2464207,
						attributes: {},
						description: '-0.24642069999999999'
					},
					{
						value: 0.0004405664,
						attributes: {},
						description: '0.00044056640000000001'
					},
					{
						value: -0.0002721236,
						attributes: {},
						description: '-0.00027212360000000002'
					}
				])
				assert.deepEqual(exif.xmp['Camera:VignettingCenter'], [
					{
						value: 1030.9989,
						attributes: {},
						description: '1030.9989'
					},
					{
						value: 771.4899,
						attributes: {},
						description: '771.48990000000003'
					}
				])
				assert.deepEqual(exif.xmp['Camera:VignettingPolynomial'], [
					{
						value: 0.0005019178,
						attributes: {},
						description: '0.0005019178'
					},
					{
						value: -0.000003113451,
						attributes: {},
						description: '-3.1134510000000001e-06'
					},
					{
						value: 6.180023e-9,
						attributes: {},
						description: '6.1800229999999996e-09'
					},
					{
						value: -7.505961e-12,
						attributes: {},
						description: '-7.5059609999999998e-12'
					},
					{
						value: 4.614833e-15,
						attributes: {},
						description: '4.6148330000000003e-15'
					},
					{
						value: -1.099016e-18,
						attributes: {},
						description: '-1.099016e-18'
					}
				])
				assert.strictEqual(exif.xmp['Camera:BandSensitivity'], 0.054773235383806254)
				assert.strictEqual(exif.xmp['Camera:RigRelatives'], '-0.127427, 0.183305, 0.058653')
				assert.strictEqual(exif.xmp['Camera:RigCameraIndex'], 4)
				assert.strictEqual(exif.xmp['Camera:RigRelativesReferenceRigCameraIndex'], 1)
				assert.strictEqual(exif.xmp['Camera:GPSXYAccuracy'], 1.2660000324249268)
				assert.strictEqual(exif.xmp['Camera:GPSZAccuracy'], 1.7960000038146973)
				assert.strictEqual(exif.xmp['Camera:Irradiance'], 17.480027584834886)
				assert.strictEqual(exif.xmp['Camera:IrradianceYaw'], -73.92680924112054)
				assert.strictEqual(exif.xmp['Camera:IrradiancePitch'], 1.8317880329439193)
				assert.strictEqual(exif.xmp['Camera:IrradianceRoll'], 2.173869336004512)
				assert.strictEqual(exif.xmp['MicaSense:BootTimestamp'], 252)
				assert.deepEqual(exif.xmp['MicaSense:RadiometricCalibration'], [
					{
						value: 0.0002873074,
						attributes: {},
						description: '0.00028730740000000002'
					},
					{
						value: 5.132566e-9,
						attributes: {},
						description: '5.1325660000000002e-09'
					},
					{
						value: 0.00004434347,
						attributes: {},
						description: '4.4343469999999998e-05'
					}
				])
				assert.strictEqual(exif.xmp['MicaSense:ImagerTemperatureC'], 26.83)
				assert.strictEqual(exif.xmp['MicaSense:FlightId'], 'F6jw5edf8CKQuysC6Ze6')
				assert.strictEqual(exif.xmp['MicaSense:CaptureId'], 'j0QNcuaNsiIJN3yCl26P')
				assert.strictEqual(exif.xmp['MicaSense:TriggerMethod'], 2)
				assert.strictEqual(exif.xmp['MicaSense:PressureAlt'], 0)
				assert.deepEqual(exif.xmp['MicaSense:DarkRowValue'], [
					{ value: 3934, attributes: {}, description: '3934' },
					{ value: 3934, attributes: {}, description: '3934' },
					{ value: 3934, attributes: {}, description: '3934' },
					{ value: 3934, attributes: {}, description: '3934' }
				])
				assert.strictEqual(exif.xmp['DLS:Serial'], 'DA03-2002222-MS')
				assert.strictEqual(exif.xmp['DLS:SwVersion'], 'v1.2.4')
				assert.strictEqual(exif.xmp['DLS:CenterWavelength'], 717)
				assert.strictEqual(exif.xmp['DLS:Bandwidth'], 12)
				assert.strictEqual(exif.xmp['DLS:TimeStamp'], 264730)
				assert.strictEqual(exif.xmp['DLS:SpectralIrradiance'], 17.480027584834886)
				assert.strictEqual(exif.xmp['DLS:HorizontalIrradiance'], 14.211778962123237)
				assert.strictEqual(exif.xmp['DLS:DirectIrradiance'], 13.999149989113818)
				assert.strictEqual(exif.xmp['DLS:ScatteredIrradiance'], 7.594971827479635)
				assert.strictEqual(exif.xmp['DLS:SolarElevation'], 0.4923042795502525)
				assert.strictEqual(exif.xmp['DLS:SolarAzimuth'], 4.721351881011877)
				assert.deepEqual(exif.xmp['DLS:EstimatedDirectLightVector'], [
					{
						value: 0.6277619625516219,
						attributes: {},
						description: '0.62776196255162187'
					},
					{
						value: -0.37169480418569933,
						attributes: {},
						description: '-0.37169480418569933'
					},
					{
						value: -0.6839282790722216,
						attributes: {},
						description: '-0.68392827907222165'
					}
				])
				assert.strictEqual(exif.xmp['DLS:Yaw'], -1.2902662267513239)
				assert.strictEqual(exif.xmp['DLS:Pitch'], 0.03197073237350175)
				assert.strictEqual(exif.xmp['DLS:Roll'], 0.03794117742142165)
			})

			it('TRM', async () => {
				const exif = await parse(buffers['MicaSense_Altum_TRM.tif'], options)
				assert.exists(exif, `exif doesn't exist`)
				// TODO: Unknown tags: 48020, 48021, 48022
				assert.strictEqual(exif.SubfileType, 0)
				assert.strictEqual(exif.ImageWidth, 160)
				assert.strictEqual(exif.ImageHeight, 120)
				assert.strictEqual(exif.BitsPerSample, 16)
				assert.strictEqual(exif.Compression, 1)
				assert.strictEqual(exif.PhotometricInterpretation, 1)
				assert.strictEqual(exif.Make, 'MicaSense')
				assert.strictEqual(exif.Model, 'Altum')
				assert.deepEqual(exif.StripOffsets, [ 8, 32008 ])
				assert.strictEqual(exif.Orientation, 1)
				assert.strictEqual(exif.SamplesPerPixel, 1)
				assert.strictEqual(exif.RowsPerStrip, 100)
				assert.deepEqual(exif.StripByteCounts, [ 32000, 6400 ])
				assert.strictEqual(exif.PlanarConfiguration, 1)
				assert.strictEqual(exif.Software, 'v2.0.0')
				assert.strictEqual(exif.ModifyDate, '2020-05-24T16:15:31')
				assert.ok(exif.OpcodeList3 instanceof Buffer)
				assert.strictEqual(exif.ExposureTime, 0.033333333)
				assert.strictEqual(exif.FNumber, 1.1)
				assert.strictEqual(exif.ExposureProgram, 'Normal program')
				assert.strictEqual(exif.ISOSpeed, 100)
				assert.strictEqual(exif.ExifVersion, '0230')
				assert.strictEqual(exif.DateTimeOriginal, '2020-05-24T16:15:31')
				assert.strictEqual(exif.DateTimeDigitized, '2020-05-24T16:15:31')
				assert.strictEqual(exif.MeteringMode, 'Average')
				assert.strictEqual(exif.FocalLength, 1.77)
				assert.strictEqual(exif.SubSecTime, '531891187')
				assert.strictEqual(exif.FocalPlaneXResolution, 83.3333333)
				assert.strictEqual(exif.FocalPlaneYResolution, 83.3333333)
				assert.strictEqual(exif.FocalPlaneResolutionUnit, 4)
				assert.strictEqual(exif.BodySerialNumber, 'AL05-1934188-SC')
				assert.strictEqual(exif.GPSVersionID, '2.2.0.0')
				assert.strictEqual(exif.GPSLatitudeRef, 'N')
				assert.deepEqual(exif.GPSLatitude, [ 48, 12, 7.34256 ])
				assert.strictEqual(exif.GPSLongitudeRef, 'E')
				assert.deepEqual(exif.GPSLongitude, [ 6, 24, 10.26756 ])
				assert.strictEqual(exif.GPSAltitudeRef, 0)
				assert.strictEqual(exif.GPSAltitude, 396.324)
				assert.strictEqual(exif.GPSDOP, 0)
				assert.strictEqual(exif.latitude, 48.202039600000006)
				assert.strictEqual(exif.longitude, 6.4028521000000005)

				// XMP
				assert.strictEqual(exif.xmp['rdf:about'], 'Pix4D Camera Information')
				assert.strictEqual(exif.xmp['Camera:RigName'], 'Altum')
				assert.strictEqual(exif.xmp['Camera:BandName'], 'LWIR')
				assert.strictEqual(exif.xmp['Camera:CentralWavelength'], 11000)
				assert.strictEqual(exif.xmp['Camera:WavelengthFWHM'], 6000)
				assert.strictEqual(exif.xmp['Camera:ModelType'], 'perspective')
				assert.strictEqual(exif.xmp['Camera:PrincipalPoint'], '0.996829,0.729053')
				assert.strictEqual(exif.xmp['Camera:PerspectiveFocalLength'], 2.013042)
				assert.strictEqual(exif.xmp['Camera:PerspectiveFocalLengthUnits'], 'mm')
				assert.deepEqual(exif.xmp['Camera:PerspectiveDistortion'], [
					{
						value: -0.3614497,
						attributes: {},
						description: '-0.36144969999999998'
					},
					{
						value: 0.4130033,
						attributes: {},
						description: '0.41300330000000002'
					},
					{
						value: -0.5163066,
						attributes: {},
						description: '-0.51630659999999995'
					},
					{ value: 0.003318821, attributes: {}, description: '0.003318821' },
					{
						value: 0.0005368207,
						attributes: {},
						description: '0.00053682070000000005'
					}
				])
				assert.strictEqual(exif.xmp['Camera:BandSensitivity'], 'inf')
				assert.strictEqual(exif.xmp['Camera:RigRelatives'], '-0.267442, 0.130632, 0.126688')
				assert.strictEqual(exif.xmp['Camera:RigCameraIndex'], 5)
				assert.strictEqual(exif.xmp['Camera:RigRelativesReferenceRigCameraIndex'], 1)
				assert.strictEqual(exif.xmp['Camera:GPSXYAccuracy'], 0.9760000109672546)
				assert.strictEqual(exif.xmp['Camera:GPSZAccuracy'], 1.4079999923706055)
				assert.strictEqual(exif.xmp['Camera:IrradianceYaw'], 91.6579239059755)
				assert.strictEqual(exif.xmp['Camera:IrradiancePitch'], -1.0693416258173318)
				assert.strictEqual(exif.xmp['Camera:IrradianceRoll'], 1.8326883911906495)
				assert.strictEqual(exif.xmp['MicaSense:BootTimestamp'], 338)
				assert.deepEqual(exif.xmp['MicaSense:RadiometricCalibration'], [
					{ value: 0, attributes: {}, description: '0' },
					{ value: 0, attributes: {}, description: '0' },
					{ value: 0, attributes: {}, description: '0' }
				])
				assert.strictEqual(exif.xmp['MicaSense:SceneTemperature'], 17.53000000000003)
				assert.strictEqual(exif.xmp['MicaSense:ImagerTemperatureC'], 20.010003662109398)
				assert.strictEqual(exif.xmp['MicaSense:FlightId'], 'F6jw5edf8CKQuysC6Ze6')
				assert.strictEqual(exif.xmp['MicaSense:CaptureId'], 'MVKJH2SswDyQBblb9faX')
				assert.strictEqual(exif.xmp['MicaSense:TriggerMethod'], 2)
				assert.strictEqual(exif.xmp['MicaSense:PressureAlt'], 0)
				assert.deepEqual(exif.xmp['MicaSense:ThermalCalibrationParameters'], [
					{
						value: 0.7320556640625,
						attributes: {},
						description: '0.7320556640625'
					},
					{
						value: 293.1700134277344,
						attributes: {},
						description: '293.17001342773438'
					},
					{
						value: 356132,
						attributes: {},
						description: '356132'
					},
					{
						value: 1435,
						attributes: {},
						description: '1435'
					},
					{
						value: 1,
						attributes: {},
						description: '1'
					},
					{
						value: 444.726,
						attributes: {},
						description: '444.726'
					}
				])
				assert.strictEqual(exif.xmp['DLS:Serial'], 'DA03-2002222-MS')
				assert.strictEqual(exif.xmp['DLS:SwVersion'], 'v1.2.4')
				assert.strictEqual(exif.xmp['DLS:Yaw'], 1.5997325577016939)
				assert.strictEqual(exif.xmp['DLS:Pitch'], -0.01866353219914164)
				assert.strictEqual(exif.xmp['DLS:Roll'], 0.03198644658935467)
			})

		})

		it('Delair UX11', async () => {
			const exif = await parse(buffers['Delair_UX11.jpg'], options)
			assert.exists(exif, `exif doesn't exist`)
			assert.strictEqual(exif.ProcessingSoftware, 'Delair After Flight 46780')
			assert.strictEqual(exif.ImageDescription, '00000000')
			assert.strictEqual(exif.Make, 'Delair')
			assert.strictEqual(exif.Model, 'UX11-3B')
			assert.strictEqual(exif.XResolution, 300)
			assert.strictEqual(exif.YResolution, 300)
			assert.strictEqual(exif.ResolutionUnit, 2)
			assert.strictEqual(exif.ModifyDate, '2019-03-14T22:45:00')
			assert.strictEqual(exif.YCbCrPositioning, 1)
			assert.strictEqual(exif.ExposureTime, 0.000039)
			assert.strictEqual(exif.FNumber, 2.8)
			assert.strictEqual(exif.ISO, 100)
			assert.strictEqual(exif.SensitivityType, 3)
			assert.strictEqual(exif.ISOSpeed, 100)
			assert.strictEqual(exif.ExifVersion, '0230')
			assert.strictEqual(exif.DateTimeOriginal, '2019-03-14T22:45:00')
			assert.strictEqual(exif.DateTimeDigitized, '2019-03-14T22:45:00')
			assert.strictEqual(exif.FocalLength, 12)
			assert.strictEqual(exif.SubSecTime, '106')
			assert.strictEqual(exif.SubSecTimeOriginal, '106')
			assert.strictEqual(exif.SubSecTimeDigitized, '106')
			assert.strictEqual(exif.ColorSpace, 1)
			assert.strictEqual(exif.PixelXDimension, 5048)
			assert.strictEqual(exif.PixelYDimension, 4228)
			assert.strictEqual(exif.FocalPlaneXResolution, 5988.024)
			assert.strictEqual(exif.FocalPlaneYResolution, 5988.024)
			assert.strictEqual(exif.FocalPlaneResolutionUnit, 'Centimeter')
			assert.strictEqual(exif.BodySerialNumber, '4103356596')
			assert.strictEqual(exif.GPSVersionID, '3.2.0.0')
			assert.strictEqual(exif.GPSLatitudeRef, 'N')
			assert.deepEqual(exif.GPSLatitude, [ 25, 3, 7.806 ])
			assert.strictEqual(exif.GPSLongitudeRef, 'W')
			assert.deepEqual(exif.GPSLongitude, [ 103, 42, 2.104 ])
			assert.strictEqual(exif.GPSAltitudeRef, 0)
			assert.strictEqual(exif.GPSAltitude, 1797.834)
			assert.strictEqual(exif.GPSMapDatum, 'WGS-84')
			assert.strictEqual(exif.latitude, 25.052168333333334)
			assert.strictEqual(exif.longitude, -103.70058444444444)

			// XMP
			assert.exists(exif.xmp)
			assert.strictEqual(exif.xmp['rdf:about'], '')
			assert.strictEqual(exif.xmp['Camera:Roll'], 3.7)
			assert.strictEqual(exif.xmp['Camera:Pitch'], 13.9)
			assert.strictEqual(exif.xmp['Camera:Yaw'], 62.1)
			assert.strictEqual(exif.xmp['Camera:GPSXYAccuracy'], 1.2)
			assert.strictEqual(exif.xmp['Camera:GPSZAccuracy'], 1.7)
			assert.strictEqual(exif.xmp['CRSInfo:VERTCRS'], 'EGM96')
			assert.deepEqual(exif.xmp['Camera:TransformAlpha'], [
				{ value: 1.500000, attributes: {}, description: '1.500000' },
				{ value: 1.500000, attributes: {}, description: '1.500000' },
				{ value: 1.500000, attributes: {}, description: '1.500000' }
			])
			assert.deepEqual(exif.xmp['Camera:TransformBeta'], [
				{ value: -2379.335363, attributes: {}, description: '-2379.335363' },
				{ value: -2379.335363, attributes: {}, description: '-2379.335363' },
				{ value: -2379.335363, attributes: {}, description: '-2379.335363' }
			])
			assert.deepEqual(exif.xmp['Camera:TransformGamma'], [
				{ value: 2.200000, attributes: {}, description: '2.200000' },
				{ value: 2.200000, attributes: {}, description: '2.200000' },
				{ value: 2.200000, attributes: {}, description: '2.200000' }
			])

			// SOF
			assert.strictEqual(exif.sof.ImageHeight, 4228)
			assert.strictEqual(exif.sof.ImageWidth, 5048)
		})

		it('FLIR Tau 2 640 R 19mm', async () => {
			const exif = await parse(buffers['FLIR_Tau_2_640_R_19mm.jpg'], options)
			assert.exists(exif, `exif doesn't exist`)
			assert.strictEqual(exif.Make, 'FLIR Systems')
			assert.strictEqual(exif.Model, 'FLIR Tau 2 640')
			assert.strictEqual(exif.Software, 'AscTec FLIR Converter')
			assert.strictEqual(exif.ModifyDate, '2019-07-26T09:00:39')
			assert.strictEqual(exif.DateTimeOriginal, '2019-07-19T11:21:52')
			assert.strictEqual(exif.GPSLatitudeRef, 'N')
			assert.deepEqual(exif.GPSLatitude, [ 52, 0, 43.0847 ])
			assert.strictEqual(exif.GPSLongitudeRef, 'E')
			assert.deepEqual(exif.GPSLongitude, [ 4, 41, 33.4967 ])
			assert.strictEqual(exif.GPSAltitudeRef, 0)
			assert.strictEqual(exif.GPSAltitude, 29.336)
			assert.strictEqual(exif.GPSTimeStamp, '11:21:52')
			assert.strictEqual(exif.GPSImgDirectionRef, 'T')
			assert.strictEqual(exif.GPSImgDirection, 0)
			assert.strictEqual(exif.GPSDateStamp, '2019:07:19')
			assert.strictEqual(exif.GPSPitch, -90)
			assert.strictEqual(exif.GPSRoll, -11.06)
			assert.strictEqual(exif.timestamp, '2019-07-19T11:21:52')
			assert.strictEqual(exif.latitude, 52.01196797222222)
			assert.strictEqual(exif.longitude, 4.692637972222222)

			// FLIR FFF Segment
			assert.exists(exif.flir)
			assert.strictEqual(exif.flir.creator, 'ATAU_RBFO')
			assert.strictEqual(exif.flir.version, 100)
			assert.strictEqual(exif.flir.RawThermalImageWidth, 640)
			assert.strictEqual(exif.flir.RawThermalImageHeight, 512)
			assert.strictEqual(exif.flir.Emissivity, 1)
			assert.strictEqual(exif.flir.ObjectDistance, 10)
			assert.strictEqual(exif.flir.ReflectedApparentTemperature, 295.1499938964844)
			assert.strictEqual(exif.flir.AtmosphericTemperature, 295.1499938964844)
			assert.strictEqual(exif.flir.IRWindowTemperature, 295.1499938964844)
			assert.strictEqual(exif.flir.IRWindowTransmission, 1)
			assert.strictEqual(exif.flir.RelativeHumidity, 0.5)
			assert.strictEqual(exif.flir.PlanckR1, 375897)
			assert.strictEqual(exif.flir.PlanckB, 1428)
			assert.strictEqual(exif.flir.PlanckF, 1)
			assert.strictEqual(exif.flir.AtmosphericTransAlpha1, 0.006568999961018562)
			assert.strictEqual(exif.flir.AtmosphericTransAlpha2, 0.012620000168681145)
			assert.strictEqual(exif.flir.AtmosphericTransBeta1, -0.00227600010111928)
			assert.strictEqual(exif.flir.AtmosphericTransBeta2, -0.006670000031590462)
			assert.strictEqual(exif.flir.AtmosphericTransX, 1.899999976158142)
			assert.strictEqual(exif.flir.CameraTemperatureRangeMax, 408.1499938964844)
			assert.strictEqual(exif.flir.CameraTemperatureRangeMin, 248.14999389648438)
			assert.strictEqual(exif.flir.UnknownTemperature1, 408.1499938964844)
			assert.strictEqual(exif.flir.UnknownTemperature2, 228.14999389648438)
			assert.strictEqual(exif.flir.UnknownTemperature3, 408.1499938964844)
			assert.strictEqual(exif.flir.UnknownTemperature4, 248.14999389648438)
			assert.strictEqual(exif.flir.UnknownTemperature5, 423.1499938964844)
			assert.strictEqual(exif.flir.UnknownTemperature6, 223.14999389648438)
			assert.strictEqual(exif.flir.CameraModel, 'FLIR Tau 2 640')
			assert.strictEqual(exif.flir.CameraPartNumber, '46640019H-SRNLX')
			assert.strictEqual(exif.flir.CameraSerialNumber, '148722')
			assert.strictEqual(exif.flir.CameraSoftware, '')
			assert.strictEqual(exif.flir.LensModel, 'FOL19')
			assert.strictEqual(exif.flir.LensPartNumber, '*')
			assert.strictEqual(exif.flir.LensSerialNumber, '*')
			assert.strictEqual(exif.flir.FieldOfView, 0)
			assert.strictEqual(exif.flir.FilterModel, '')
			assert.strictEqual(exif.flir.FilterPartNumber, '')
			assert.strictEqual(exif.flir.FilterSerialNumber, '')
			assert.strictEqual(exif.flir.PlanckO, -56)
			assert.strictEqual(exif.flir.PlanckR2, 1)
			assert.strictEqual(exif.flir.RawValueMedian, 4458)
			assert.strictEqual(exif.flir.RawValueRange, 1805)
			assert.strictEqual(exif.flir.FocusStepCount, 0)
			assert.strictEqual(exif.flir.FocusDistance, 0)
			assert.strictEqual(exif.flir.PaletteName, 'Rainbow')
			assert.strictEqual(exif.flir.GPSMapDatum, 'WGS-84')

			// SOF
			assert.strictEqual(exif.sof.ImageHeight, 512)
			assert.strictEqual(exif.sof.ImageWidth, 640)
		})

		it('Sensefly Thermomap 9mm', async () => {
			const exif = await parse(buffers['Sensefly_Thermomap_9mm.tif'], options)
			assert.exists(exif, `exif doesn't exist`)
			assert.strictEqual(exif.ProcessingSoftware, 'eBee')
			assert.strictEqual(exif.ImageWidth, 640)
			assert.strictEqual(exif.ImageHeight, 512)
			assert.strictEqual(exif.BitsPerSample, 16)
			assert.strictEqual(exif.Compression, 5)
			assert.strictEqual(exif.Make, 'senseFly')
			assert.strictEqual(exif.Model, 'thermoMAP')
			assert.strictEqual(exif.StripOffsets, 3012)
			assert.strictEqual(exif.SamplesPerPixel, 1)
			assert.strictEqual(exif.StripByteCounts, 518880)
			assert.strictEqual(exif.DateTimeOriginal, '2015-11-19T11:35:28')
			assert.strictEqual(exif.FocalLength, 9)
			assert.strictEqual(exif.GPSLatitudeRef, 'N')
			assert.deepEqual(exif.GPSLatitude, [ 40.0594223, 0, 0 ])
			assert.strictEqual(exif.GPSLongitudeRef, 'E')
			assert.deepEqual(exif.GPSLongitude, [ 23.402305, 0, 0 ])
			assert.strictEqual(exif.GPSAltitude, 142.365088)
			assert.strictEqual(exif.latitude, 40.0594223)
			assert.strictEqual(exif.longitude, 23.402305)

			// XMP
			assert.exists(exif.xmp)
			assert.strictEqual(exif.xmp['rdf:about'], '')
			assert.strictEqual(exif.xmp['sensefly:GyroRate'], 1.098)
			assert.strictEqual(exif.xmp['sensefly:CamId'], 2)
			assert.strictEqual(exif.xmp['sensefly:Yaw'], 189.428)
			assert.strictEqual(exif.xmp['sensefly:Pitch'], 12.5908)
			assert.strictEqual(exif.xmp['sensefly:Roll'], -3.384)
			assert.strictEqual(exif.xmp['sensefly:GPSXYAccuracy'], 5.367)
			assert.strictEqual(exif.xmp['sensefly:GPSZAccuracy'], 3.978)
			assert.strictEqual(exif.xmp['Camera:NominalCameraDistance'], 9.7)
			assert.strictEqual(exif.xmp['Camera:IsNormalized'], true)
		})

		it('Sensefly S.O.D.A.', async () => {
			const exif = await parse(buffers['Sensefly_SODA.JPG'], options)
			assert.exists(exif, `exif doesn't exist`)
			assert.strictEqual(exif.ProcessingSoftware, 'eMotion 3.X.Xnb')
			assert.strictEqual(exif.Make, 'senseFly')
			assert.strictEqual(exif.Model, 'S.O.D.A.')
			assert.strictEqual(exif.XResolution, 72)
			assert.strictEqual(exif.YResolution, 72)
			assert.strictEqual(exif.ResolutionUnit, 2)
			assert.strictEqual(exif.Software, '1.3.0')
			assert.strictEqual(exif.UniqueCameraModel, 'senseFly S.O.D.A.')
			assert.strictEqual(exif.CameraSerialNumber, 'SI002001AA7I00076')
			assert.strictEqual(exif.ExposureTime, 0.001)
			assert.strictEqual(exif.FNumber, 2.8)
			assert.strictEqual(exif.ExposureProgram, 'Shutter priority')
			assert.strictEqual(exif.ISO, 250)
			assert.strictEqual(exif.DateTimeOriginal, '2019-03-18T11:01:20')
			assert.strictEqual(exif.ApertureValue, 3)
			assert.strictEqual(exif.ExposureBiasValue, 0)
			assert.strictEqual(exif.MaxApertureValue, 2.97)
			assert.strictEqual(exif.SubjectDistance, 4294967.295)
			assert.strictEqual(exif.FocalLength, 10.6)
			assert.strictEqual(exif.SubSecTimeOriginal, '00')
			assert.strictEqual(exif.PixelXDimension, 5472)
			assert.strictEqual(exif.PixelYDimension, 3648)
			assert.strictEqual(exif.FocalPlaneXResolution, 4167)
			assert.strictEqual(exif.FocalPlaneYResolution, 4167)
			assert.strictEqual(exif.FocalPlaneResolutionUnit, 'Centimeter')
			assert.strictEqual(exif.WhiteBalance, 'Manual white balance')
			assert.strictEqual(exif.FocalLengthIn35mmFormat, 28)
			assert.strictEqual(exif.BodySerialNumber, 'SI002001AA7I00076')
			assert.strictEqual(exif.LensModel, '')
			assert.strictEqual(exif.GPSVersionID, '2.3.0.0')
			assert.strictEqual(exif.GPSLatitudeRef, 'N')
			assert.deepEqual(exif.GPSLatitude, [ 46, 35, 52.310528 ])
			assert.strictEqual(exif.GPSLongitudeRef, 'E')
			assert.deepEqual(exif.GPSLongitude, [ 6, 36, 31.664439 ])
			assert.strictEqual(exif.GPSAltitudeRef, 0)
			assert.strictEqual(exif.GPSAltitude, 758.7552)
			assert.strictEqual(exif.GPSTimeStamp, '11:1:20.284')
			assert.strictEqual(exif.GPSStatus, 'A')
			assert.strictEqual(exif.GPSMapDatum, 'WGS-84')
			assert.strictEqual(exif.GPSDateStamp, '2019:03:18')
			assert.strictEqual(exif.timestamp, '2019-03-18T11:01:20')
			assert.strictEqual(exif.latitude, 46.59786403555556)
			assert.strictEqual(exif.longitude, 6.6087956775)

			// XMP
			assert.exists(exif.xmp)
			assert.strictEqual(exif.xmp['rdf:about'], '')
			assert.strictEqual(exif.xmp['sensefly:CamId'], 33)
			assert.strictEqual(exif.xmp['Camera:IMULinearVelocity'], '-2e+10,-2e+10,-2e+10')
			assert.strictEqual(exif.xmp['Camera:Pitch'], 13.811229)
			assert.strictEqual(exif.xmp['Camera:Roll'], -6.932620)
			assert.strictEqual(exif.xmp['Camera:Yaw'], -146.946594)
			assert.strictEqual(exif.xmp['Camera:GPSXYAccuracy'], 0.024764)
			assert.strictEqual(exif.xmp['Camera:GPSZAccuracy'], 0.036845)
			assert.strictEqual(exif.xmp['Camera:IMURollAccuracy'], 5)
			assert.strictEqual(exif.xmp['Camera:IMUPitchAccuracy'], 5)
			assert.strictEqual(exif.xmp['Camera:IMUYawAccuracy'], 10)
			assert.strictEqual(exif.xmp['Camera:RigName'], 'Duet T')
			assert.strictEqual(exif.xmp['Camera:RigCameraIndex'], 1)
			assert.strictEqual(exif.xmp['Platform:Manufacturer'], 'senseFly')
			assert.strictEqual(exif.xmp['Platform:Model'], 'eBee X')
			assert.strictEqual(exif.xmp['Platform:SerialNumber'], 'IX-x1-00057')
			assert.strictEqual(exif.xmp['Platform:SwVersion'], '3.X.Xnb 3254' )

			// SOF
			assert.strictEqual(exif.sof.ImageHeight, 3648)
			assert.strictEqual(exif.sof.ImageWidth, 5472)
		})

		it('Wiris 2nd Gen 640 19mm', async () => {
			const exif = await parse(buffers['Wiris_2nd_Gen_640_19mm.tiff'], options)
			assert.exists(exif, `exif doesn't exist`)
			assert.strictEqual(exif.ImageWidth, 640)
			assert.strictEqual(exif.ImageHeight, 512)
			assert.strictEqual(exif.BitsPerSample, 16)
			assert.strictEqual(exif.Compression, 1)
			assert.strictEqual(exif.PhotometricInterpretation, 1)
			assert.strictEqual(exif.FillOrder, 1)
			assert.strictEqual(exif.Model, 'WIRIS640')
			assert.strictEqual(exif.StripOffsets, 16)
			assert.strictEqual(exif.Orientation, 1)
			assert.strictEqual(exif.SamplesPerPixel, 1)
			assert.strictEqual(exif.RowsPerStrip, 512)
			assert.strictEqual(exif.StripByteCounts, 655360)
			assert.strictEqual(exif.XResolution, 88)
			assert.strictEqual(exif.YResolution, 88)
			assert.strictEqual(exif.PlanarConfiguration, 1)
			assert.strictEqual(exif.ResolutionUnit, 3)
			assert.strictEqual(exif.ModifyDate, '2017-09-16T00:00:00')
			assert.strictEqual(exif.SampleFormat, 1)
			assert.strictEqual(exif.SMinSampleValue, 7296)
			assert.strictEqual(exif.SMaxSampleValue, 7774)
			assert.strictEqual(exif.CameraSerialNumber, '170307')
			assert.strictEqual(exif.DateTimeOriginal, '2017-09-16T15:28:54')
			assert.strictEqual(exif.FocalLength, 19.0089453125)
			assert.strictEqual(exif.GPSVersionID, '2...2...0...0')
			assert.deepEqual(exif.GPSLatitude, [ 49, 39, 2.89 ])
			assert.strictEqual(exif.GPSLatitudeRef, 'N')
			assert.strictEqual(exif.GPSLongitudeRef, 'E')
			assert.deepEqual(exif.GPSLongitude, [ 15, 29, 50.24 ])
			assert.strictEqual(exif.GPSAltitudeRef, 'm')
			assert.strictEqual(exif.GPSAltitude, 504.395)
			assert.strictEqual(exif.GPSTimeStamp, '15:28:54')
			assert.strictEqual(exif.GPSDateStamp, '2017:09:16 15:28:54')
			assert.strictEqual(exif.timestamp, '2017-09-16T15:28:54')
			assert.strictEqual(exif.latitude, 49.65080277777778)
			assert.strictEqual(exif.longitude, 15.497288888888889)
		})

		it('DJI ZH20T', async () => {
			const exif = await parse(buffers['DJI_ZH20T.JPG'], options)
			assert.exists(exif, `exif doesn't exist`)
			assert.strictEqual(exif.ImageDescription, "default")
			assert.strictEqual(exif.Make, "DJI")
			assert.strictEqual(exif.Model, "ZH20T")
			assert.strictEqual(exif.BodySerialNumber, "1W9DH490000016")
			assert.strictEqual(exif.Orientation, 1)
			assert.strictEqual(exif.XResolution, 72)
			assert.strictEqual(exif.YResolution, 72)
			assert.strictEqual(exif.ResolutionUnit, 2) // inches
			assert.strictEqual(exif.Software, "01.00.01.08")
			assert.strictEqual(exif.ModifyDate, "2020-06-23T12:50:47")
			assert.strictEqual(exif.YCbCrPositioning, 2) // co-sited
			assert.strictEqual(exif.ExposureTime, 1/6000)
			assert.strictEqual(exif.FNumber, 2.8)
			assert.strictEqual(exif.ExposureProgram, "Normal program") // ExposureProgram = 2, Program AE
			assert.strictEqual(exif.ISO, 100)
			assert.strictEqual(exif.SensitivityType, 2)
			assert.strictEqual(exif.ExifVersion, "0230")
			assert.strictEqual(exif.DateTimeOriginal, "2020-06-23T12:50:47")
			assert.strictEqual(exif.DateTimeDigitized, "2020-06-23T12:50:47")
			assert.strictEqual(exif.ComponentsConfiguration, "Y, Cb, Cr, -")
			assert.strictEqual(exif.ShutterSpeedValue, 125507/10000)
			assert.strictEqual(exif.ApertureValue, 2.97)
			assert.strictEqual(exif.ExposureBiasValue, 0)
			assert.strictEqual(exif.MaxApertureValue, 2.97)
			assert.strictEqual(exif.MeteringMode, "CenterWeightedAverage")
			assert.strictEqual(exif.LightSource, "Daylight")
			assert.strictEqual(exif.Flash, "Flash did not fire")
			assert.strictEqual(exif.FocalLength, 4.5)
			assert.strictEqual(exif.FlashpixVersion, "0100")
			assert.strictEqual(exif.ColorSpace, 1) // sRGB
			assert.strictEqual(exif.PixelXDimension, 4056)
			assert.strictEqual(exif.PixelYDimension, 3040)
			// Not supported yet by exifr but exiftool returned 8
			// assert.strictEqual(exif.BitsPerSample, 8)
			assert.strictEqual(exif.InteroperabilityIFDPointer, 824)
			assert.strictEqual(exif.SceneType, "Directly photographed")
			assert.strictEqual(exif.ExposureMode, "Auto exposure") // these are 'auto'
			assert.strictEqual(exif.WhiteBalance, "Auto white balance")
			assert.strictEqual(exif.DigitalZoomRatio, 1)
			assert.strictEqual(exif.FocalLengthIn35mmFormat, 24)
			assert.strictEqual(exif.SceneCaptureType, "Standard")
			assert.strictEqual(exif.GainControl, "None")
			assert.strictEqual(exif.Contrast, "Normal")
			assert.strictEqual(exif.Saturation, "Normal")
			assert.strictEqual(exif.Sharpness, "Normal")
			assert.strictEqual(exif.GPSVersionID, "2.3.0.0")
			assert.strictEqual(exif.GPSLatitudeRef, "N")
			assert.deepEqual(exif.GPSLatitude, [32, 6, 37.0392])
			assert.strictEqual(exif.GPSLongitudeRef, "E")
			assert.deepEqual(exif.GPSLongitude, [34, 57, 17.0948])
			assert.strictEqual(exif.GPSAltitudeRef, 0)
			assert.strictEqual(exif.GPSAltitude, 72.444)
			assert.strictEqual(exif.GPSMapDatum, 'WGS-84')
			assert.strictEqual(exif.latitude, 32.11028866666667)
			assert.strictEqual(exif.longitude, 34.95474855555556)

			// XMP
			assert.exists(exif.xmp)
			assert.strictEqual(exif.xmp['rdf:about'], 'DJI Meta Data')
			assert.strictEqual(exif.xmp['xmp:ModifyDate'], '2020-06-23 12:50:47')
			assert.strictEqual(exif.xmp['xmp:CreateDate'], '2020-06-23 12:50:47')
			assert.strictEqual(exif.xmp['tiff:Make'], 'DJI')
			assert.strictEqual(exif.xmp['tiff:Model'], 'ZH20T')
			assert.strictEqual(exif.xmp['dc:format'], 'image/jpg')
			assert.strictEqual(exif.xmp['drone-dji:Version'], 1.1)
			assert.strictEqual(exif.xmp['drone-dji:GpsStatus'], 'Normal')
			assert.strictEqual(exif.xmp['drone-dji:GpsLatitude'], 32.1102887),
			assert.strictEqual(exif.xmp['drone-dji:GpsLongitude'], 34.9547486)
			assert.strictEqual(exif.xmp['drone-dji:AbsoluteAltitude'], 72.444)
			assert.strictEqual(exif.xmp['drone-dji:RelativeAltitude'], 47.090)
			assert.strictEqual(exif.xmp['drone-dji:GimbalRollDegree'], 0.00)
			assert.strictEqual(exif.xmp['drone-dji:GimbalYawDegree'], 119.30)
			assert.strictEqual(exif.xmp['drone-dji:GimbalPitchDegree'], -90.00)
			assert.strictEqual(exif.xmp['drone-dji:FlightRollDegree'], 1.60)
			assert.strictEqual(exif.xmp['drone-dji:FlightYawDegree'], 128.60)
			assert.strictEqual(exif.xmp['drone-dji:FlightPitchDegree'], -5.50)
			assert.strictEqual(exif.xmp['drone-dji:FlightXSpeed'], -3.1)
			assert.strictEqual(exif.xmp['drone-dji:FlightYSpeed'], 3.8)
			assert.strictEqual(exif.xmp['drone-dji:FlightZSpeed'], 0.0)
			assert.strictEqual(exif.xmp['drone-dji:CamReverse'], false)
			assert.strictEqual(exif.xmp['drone-dji:GimbalReverse'], false)
			assert.strictEqual(exif.xmp['drone-dji:SelfData'], '')
			assert.strictEqual(exif.xmp['crs:Version'], '7.0')
			assert.strictEqual(exif.xmp['crs:HasSettings'], false)
			assert.strictEqual(exif.xmp['crs:HasCrop'], false)
			assert.strictEqual(exif.xmp['crs:AlreadyApplied'], false)

			// SOF
			assert.strictEqual(exif.sof.ImageHeight, 3040)
			assert.strictEqual(exif.sof.ImageWidth, 4056)
		})

		it('Phantom 4 RTK', async () => {
			const exif = await parse(buffers['Phantom 4 RTK.jpg'], options)
			assert.exists(exif, `exif doesn't exist`)
			assert.strictEqual(exif.ImageDescription, 'DCIM\\100MEDIA\\DJI_0343.JPG')
			assert.strictEqual(exif.Make, 'DJI')
			assert.strictEqual(exif.Model, 'FC6310')
			assert.strictEqual(exif.PixelXDimension, 5472)
			assert.strictEqual(exif.PixelYDimension, 3648)
			assert.strictEqual(exif.Orientation, 1)
			assert.strictEqual(exif.XResolution, 72)
			assert.strictEqual(exif.YResolution, 72)
			assert.strictEqual(exif.ResolutionUnit, 2)
			assert.strictEqual(exif.Software, 'v01.07.1641')
			assert.strictEqual(exif.ModifyDate, '2019-09-13T10:49:41')
			assert.strictEqual(exif.YCbCrPositioning, 1)
			assert.strictEqual(exif.ExposureTime, 0.002)
			assert.strictEqual(exif.FNumber, 5.6)
			assert.strictEqual(exif.ExposureProgram, 'Normal program')
			assert.strictEqual(exif.ISO, 800)
			assert.strictEqual(exif.ExifVersion, '0230')
			assert.strictEqual(exif.DateTimeOriginal, '2019-09-13T10:49:40')
			assert.strictEqual(exif.DateTimeDigitized, '2019-09-13T10:49:40')
			assert.strictEqual(exif.ComponentsConfiguration, '-, Cr, Cb, Y')
			assert.strictEqual(exif.ShutterSpeedValue, 8.965)
			assert.strictEqual(exif.ApertureValue, 4.97)
			assert.strictEqual(exif.ExposureBiasValue, 0)
			assert.strictEqual(exif.MaxApertureValue, 2.97)
			assert.strictEqual(exif.MeteringMode, 'Average')
			assert.strictEqual(exif.LightSource, 'Daylight')
			assert.strictEqual(exif.Flash, 'No flash function')
			assert.strictEqual(exif.FocalLength, 8.8)
			assert.isUndefined(exif.SubjectArea)
			assert.strictEqual(exif.FlashpixVersion, '0010')
			assert.strictEqual(exif.ColorSpace, 1)
			assert.strictEqual(exif.SceneType, 'Directly photographed')
			assert.strictEqual(exif.GPSVersionID, '2.3.0.0')
			assert.strictEqual(exif.GPSLatitudeRef, 'N')
			assert.deepEqual(exif.GPSLatitude, [ 50, 55, 42.0271 ])
			assert.strictEqual(exif.GPSLongitudeRef, 'E')
			assert.deepEqual(exif.GPSLongitude, [ 4, 45, 12.7276 ])
			assert.strictEqual(exif.GPSAltitudeRef, 1)
			assert.strictEqual(exif.GPSAltitude, 128.486)
			assert.strictEqual(exif.latitude, 50.92834086111111)
			assert.strictEqual(exif.longitude, 4.753535444444444)

			// XMP
			assert.exists(exif.xmp)
			assert.strictEqual(exif.xmp['rdf:about'], 'DJI Meta Data')
			assert.strictEqual(exif.xmp['drone-dji:AbsoluteAltitude'], -128.49)
			assert.strictEqual(exif.xmp['drone-dji:RelativeAltitude'], 36.7)
			assert.strictEqual(exif.xmp['drone-dji:GimbalRollDegree'], 0)
			assert.strictEqual(exif.xmp['drone-dji:GimbalYawDegree'], -68.9)
			assert.strictEqual(exif.xmp['drone-dji:GimbalPitchDegree'], -90)
			assert.strictEqual(exif.xmp['drone-dji:FlightRollDegree'], -1.5)
			assert.strictEqual(exif.xmp['drone-dji:FlightYawDegree'], -69.3)
			assert.strictEqual(exif.xmp['drone-dji:FlightPitchDegree'], -0.3)
			assert.strictEqual(exif.xmp['drone-dji:CamReverse'], false)
			assert.strictEqual(exif.xmp['drone-dji:GimbalReverse'], false)
			assert.strictEqual(exif.xmp['drone-dji:RtkFlag'], 50)

			// SOF
			assert.strictEqual(exif.sof.ImageWidth, 5472)
			assert.strictEqual(exif.sof.ImageHeight, 3648)
		})

		it('WingtraOne Sony DSC-RX1RII', async () => {
			const exif = await parse(buffers['WingtraOne_Sony_DSC_RX1RII.JPG'], options)
			assert.exists(exif, `exif doesn't exist`)
			assert.strictEqual(exif.ImageDescription, '                               ')
			assert.strictEqual(exif.Make, 'SONY')
			assert.strictEqual(exif.Model, 'DSC-RX1RM2')
			assert.strictEqual(exif.Orientation, 1)
			assert.strictEqual(exif.XResolution, 350)
			assert.strictEqual(exif.YResolution, 350)
			assert.strictEqual(exif.ResolutionUnit, 2)
			assert.strictEqual(exif.Software, 'DSC-RX1RM2 v1.00')
			assert.strictEqual(exif.ModifyDate, '2019-03-18T13:15:23')
			assert.strictEqual(exif.YCbCrPositioning, 2)
			assert.ok(exif.PrintIM instanceof Buffer)
			assert.strictEqual(exif.ExposureTime, 0.0005)
			assert.strictEqual(exif.FNumber, 4.5)
			assert.strictEqual(exif.ExposureProgram, 'Manual')
			assert.strictEqual(exif.ISO, 3200)
			assert.strictEqual(exif.SensitivityType, 2)
			assert.strictEqual(exif.RecommendedExposureIndex, 3200)
			assert.strictEqual(exif.ExifVersion, '0230')
			assert.strictEqual(exif.DateTimeOriginal, '2019-03-18T13:15:23')
			assert.strictEqual(exif.DateTimeDigitized, '2019-03-18T13:15:23')
			assert.strictEqual(exif.ComponentsConfiguration, 'Y, Cb, Cr, -')
			assert.strictEqual(exif.CompressedBitsPerPixel, 3)
			assert.strictEqual(exif.BrightnessValue, 5.96640625)
			assert.strictEqual(exif.ExposureBiasValue, 0)
			assert.strictEqual(exif.MaxApertureValue, 2)
			assert.strictEqual(exif.MeteringMode, 'Pattern')
			assert.strictEqual(exif.LightSource, 'Unknown')
			assert.strictEqual(exif.Flash, 'Flash did not fire, compulsory flash mode')
			assert.strictEqual(exif.FocalLength, 35)
			assert.ok(exif.MakerNote instanceof Buffer)
			assert.ok(exif.UserComment instanceof Buffer)
			assert.strictEqual(exif.FlashpixVersion, '0100')
			assert.strictEqual(exif.ColorSpace, 1)
			assert.strictEqual(exif.PixelXDimension, 7952)
			assert.strictEqual(exif.PixelYDimension, 5304)
			assert.strictEqual(exif.InteroperabilityIFDPointer, 34242)
			assert.ok(exif.FileSource instanceof Buffer)
			assert.strictEqual(exif.SceneType, 'Directly photographed')
			assert.strictEqual(exif.CustomRendered, 'Normal process')
			assert.strictEqual(exif.ExposureMode, 'Manual exposure')
			assert.strictEqual(exif.WhiteBalance, 'Auto white balance')
			assert.strictEqual(exif.DigitalZoomRatio, 1)
			assert.strictEqual(exif.FocalLengthIn35mmFormat, 35)
			assert.strictEqual(exif.SceneCaptureType, 'Standard')
			assert.strictEqual(exif.Contrast, 'Normal')
			assert.strictEqual(exif.Saturation, 'Normal')
			assert.strictEqual(exif.Sharpness, 'Normal')
			assert.deepEqual(exif.LensSpecification, [ 35, 35, 2, 2 ])

			// SOF
			assert.strictEqual(exif.sof.ImageHeight, 5304)
			assert.strictEqual(exif.sof.ImageWidth, 7952)
		})

		it('Yuneec E90', async () => {
			const exif = await parse(buffers['YUN_0001.JPG'], options)
			assert.exists(exif, `exif doesn't exist`)
			assert.strictEqual(exif.ImageDescription, 'DCIM\\142E90HD\\YUN_0001.')
			assert.strictEqual(exif.Make, 'Yuneec')
			assert.strictEqual(exif.Model, 'E90')
			assert.strictEqual(exif.Orientation, 1)
			assert.strictEqual(exif.XResolution, 72)
			assert.strictEqual(exif.YResolution, 72)
			assert.strictEqual(exif.ResolutionUnit, 2)
			assert.strictEqual(exif.Software, '1.0.61_E')
			assert.strictEqual(exif.ModifyDate, '2021-08-10T13:26:28')
			assert.strictEqual(exif.YCbCrPositioning, 1)
			assert.strictEqual(exif.ExposureTime, 0.001041)
			assert.strictEqual(exif.FNumber, 2.8)
			assert.strictEqual(exif.ExposureProgram, 'Normal program')
			assert.strictEqual(exif.ISO, 113)
			assert.strictEqual(exif.ExifVersion, '0230')
			assert.strictEqual(exif.DateTimeOriginal, '2021-08-10T13:26:28')
			assert.strictEqual(exif.DateTimeDigitized, '2021-08-10T13:26:28')
			assert.strictEqual(exif.ComponentsConfiguration, '-, Cr, Cb, Y')
			assert.strictEqual(exif.CompressedBitsPerPixel, 6.521920606981635)
			assert.strictEqual(exif.ShutterSpeedValue, 9.906)
			assert.strictEqual(exif.ApertureValue, 2.8)
			assert.strictEqual(exif.ExposureBiasValue, 0)
			assert.strictEqual(exif.MaxApertureValue, 2.8)
			assert.strictEqual(exif.SubjectDistance, 0)
			assert.strictEqual(exif.MeteringMode, 'Average')
			assert.strictEqual(exif.LightSource, 'Unknown')
			assert.strictEqual(exif.Flash, 'No flash function')
			assert.strictEqual(exif.FocalLength, 8.29)
			assert.ok(exif.MakerNote instanceof Buffer)
			assert.strictEqual(exif.FlashpixVersion, '0010')
			assert.strictEqual(exif.ColorSpace, 1)
			assert.strictEqual(exif.PixelXDimension, 5472)
			assert.strictEqual(exif.PixelYDimension, 3648)
			assert.strictEqual(exif.InteroperabilityIFDPointer, 680)
			assert.strictEqual(exif.FocalPlaneXResolution, 416.6666666666667)
			assert.strictEqual(exif.FocalPlaneYResolution, 416.6666666666667)
			assert.strictEqual(exif.FocalPlaneResolutionUnit, 4)
			assert.isNaN(exif.ExposureIndex)
			assert.strictEqual(exif.SensingMethod, 'One-chip color area sensor')
			assert.ok(exif.FileSource instanceof Buffer)
			assert.strictEqual(exif.SceneType, 'Directly photographed')
			assert.strictEqual(exif.CustomRendered, 'Normal process')
			assert.strictEqual(exif.ExposureMode, 'Auto exposure')
			assert.strictEqual(exif.WhiteBalance, 'Auto white balance')
			assert.isNaN(exif.DigitalZoomRatio)
			assert.strictEqual(exif.FocalLengthIn35mmFormat, 23)
			assert.strictEqual(exif.SceneCaptureType, 'Standard')
			assert.strictEqual(exif.GainControl, 'None')
			assert.strictEqual(exif.Contrast, 'Normal')
			assert.strictEqual(exif.Saturation, 'Normal')
			assert.strictEqual(exif.Sharpness, 'Normal')
			assert.ok(exif.DeviceSettingDescription instanceof Buffer)
			assert.strictEqual(exif.SubjectDistanceRange, 'Unknown')
			assert.strictEqual(exif.GPSVersionID, '2.3.0.0')
			assert.strictEqual(exif.GPSLatitudeRef, 'N')
			assert.deepEqual(exif.GPSLatitude, [ 48, 1, 1.51968 ])
			assert.strictEqual(exif.GPSLongitudeRef, 'E')
			assert.deepEqual(exif.GPSLongitude, [ 11, 55, 0.419159 ])
			assert.strictEqual(exif.GPSAltitudeRef, 0)
			assert.strictEqual(exif.GPSAltitude, 537.78)
			assert.strictEqual(exif.latitude, 48.017088799999996)
			assert.strictEqual(exif.longitude, 11.916783099722222)

			// XMP
			assert.exists(exif.xmp)
			assert.strictEqual(exif.xmp['rdf:about'], 'YUNEEC Meta Data')
			assert.strictEqual(exif.xmp['xmp:ModifyDate'], '2021-08-10')
			assert.strictEqual(exif.xmp['xmp:CreateDate'], '2021-08-10')
			assert.strictEqual(exif.xmp['tiff:Make'], 'Yuneec')
			assert.strictEqual(exif.xmp['tiff:Model'], 'E90')
			assert.strictEqual(exif.xmp['dc:format'], 'image/jpg')
			assert.strictEqual(exif.xmp['drone-yuneec:GPSAltitude'], 537.78)
			assert.strictEqual(exif.xmp['drone-yuneec:AboveHomeAltitude'], 34.4)
			assert.strictEqual(exif.xmp['drone-yuneec:DroneYaw'], 96.699997)
			assert.strictEqual(exif.xmp['drone-yuneec:DronePitch'], -3.72)
			assert.strictEqual(exif.xmp['drone-yuneec:DroneRoll'], 1.64)
			assert.strictEqual(exif.xmp['drone-yuneec:GimbalYaw'], 73.230003)
			assert.strictEqual(exif.xmp['drone-yuneec:GimbalPitch'], -89.95999)
			assert.strictEqual(exif.xmp['drone-yuneec:GimbalRoll'], 0)
			assert.strictEqual(exif.xmp['crs:Version'], '7.0')
			assert.strictEqual(exif.xmp['crs:HasSettings'], false)
			assert.strictEqual(exif.xmp['crs:HasCrop'], false)
			assert.strictEqual(exif.xmp['crs:AlreadyApplied'], false)

			// SOF
			assert.strictEqual(exif.sof.ImageHeight, 3648)
			assert.strictEqual(exif.sof.ImageWidth, 5472)
		})

	})

})
