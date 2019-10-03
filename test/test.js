var isBrowser = typeof navigator === 'object'
var isNode = typeof require === 'function' && !isBrowser

if (isBrowser) {
	mocha.setup('bdd')
	setTimeout(() => mocha.run(), 100)
} else {
	var chai = require('chai')
	var path = require('path')
	var fs = require('fs').promises
	var exifr = require('../index.js')
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
			'MicaSense_RedEdge_M.tif',
			'Delair_UX11.jpg',
			'FLIR_Tau_2_640_R_19mm.jpg',
			'Sensefly_Thermomap_9mm.tif',
			'Sensefly_SODA.JPG',
			'Wiris_2nd_Gen_640_19mm.tiff',
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

		const options = { xmp: true, flir: true }

		it('DJI Zenmuse X3', async () => {
			const exif = await parse(buffers['DJI_Zenmuse_X3.JPG'], options)
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.ImageDescription, "DCIM\\100MEDIA\\DJI_0002.JPG")
			assert.equal(exif.Make, "DJI")
			assert.equal(exif.Model, "FC350")
			assert.equal(exif.Orientation, 1)
			assert.equal(exif.XResolution, 72)
			assert.equal(exif.YResolution, 72)
			assert.equal(exif.ResolutionUnit, 2)
			assert.equal(exif.Software, "v02.70.5440")
			assert.equal(exif.ModifyDate, "2017-03-14T14:15:40")
			assert.equal(exif.YCbCrPositioning, 1)
			assert.equal(exif.ExposureTime, 0.001995)
			assert.equal(exif.FNumber, 2.8)
			assert.equal(exif.ExposureProgram, "Shutter priority")
			assert.equal(exif.ISO, 139)
			assert.equal(exif.ExifVersion, "0230")
			assert.equal(exif.DateTimeOriginal, "2017-03-14T14:15:40")
			assert.equal(exif.DateTimeDigitized, "2017-03-14T14:15:40")
			assert.equal(exif.ComponentsConfiguration, "-, Cr, Cb, Y")
			assert.equal(exif.CompressedBitsPerPixel, 3.377127111111111)
			assert.equal(exif.ShutterSpeedValue, 8.968)
			assert.equal(exif.ApertureValue, 2.97)
			assert.equal(exif.ExposureBiasValue, 0)
			assert.equal(exif.MaxApertureValue, 1)
			assert.equal(exif.SubjectDistance, 0)
			assert.equal(exif.MeteringMode, "CenterWeightedAverage")
			assert.equal(exif.LightSource, "Unknown")
			assert.equal(exif.Flash, "No flash function")
			assert.equal(exif.FocalLength, 3.61)
			assert.equal(exif.FlashpixVersion, "0010")
			assert.equal(exif.ColorSpace, 1)
			assert.equal(exif.PixelXDimension, 4000)
			assert.equal(exif.PixelYDimension, 2250)
			assert.equal(exif.InteroperabilityIFDPointer, 656)
			assert.equal(exif.SceneType, "")
			assert.equal(exif.CustomRendered, "Normal process")
			assert.equal(exif.ExposureMode, "Auto exposure")
			assert.equal(exif.WhiteBalance, "Auto white balance")
			assert.equal(exif.FocalLengthIn35mmFormat, 20)
			assert.equal(exif.SceneCaptureType, "Standard")
			assert.equal(exif.GainControl, "None")
			assert.equal(exif.Contrast, "Normal")
			assert.equal(exif.Saturation, "Normal")
			assert.equal(exif.Sharpness, "Normal")
			assert.equal(exif.SubjectDistanceRange, "Unknown")
			assert.equal(exif.GPSVersionID, "0.0.0.0")
			assert.equal(exif.GPSLatitudeRef, "N")
			assert.deepEqual(exif.GPSLatitude, [50, 51, 32.5779])
			assert.equal(exif.GPSLongitudeRef, "E")
			assert.deepEqual(exif.GPSLongitude, [4, 40, 43.3816])
			assert.equal(exif.GPSAltitudeRef, 1)
			assert.equal(exif.GPSAltitude, 116.63)
			assert.equal(exif.latitude, 50.85904941666667)
			assert.equal(exif.longitude, 4.678717111111111)

			// XMP
			assert.exists(exif.xmp)
			assert.equal(exif.xmp['rdf:about'], 'DJI Meta Data')
			assert.equal(exif.xmp['xmp:ModifyDate'], '2017-03-14')
			assert.equal(exif.xmp['xmp:CreateDate'], '2017-03-14')
			assert.equal(exif.xmp['tiff:Make'], 'DJI')
			assert.equal(exif.xmp['tiff:Model'], 'FC350')
			assert.equal(exif.xmp['dc:format'], 'image/jpeg')
			assert.equal(exif.xmp['drone-dji:AbsoluteAltitude'], '-116.63')
			assert.equal(exif.xmp['drone-dji:RelativeAltitude'], '+29.40')
			assert.equal(exif.xmp['drone-dji:GimbalRollDegree'], '+0.00')
			assert.equal(exif.xmp['drone-dji:GimbalYawDegree'], '+46.60')
			assert.equal(exif.xmp['drone-dji:GimbalPitchDegree'], '-90.00')
			assert.equal(exif.xmp['drone-dji:FlightRollDegree'], '-8.70')
			assert.equal(exif.xmp['drone-dji:FlightYawDegree'], '+44.70')
			assert.equal(exif.xmp['drone-dji:FlightPitchDegree'], '+0.20')
			assert.equal(exif.xmp['drone-dji:FlightXSpeed'], '-0.20')
			assert.equal(exif.xmp['drone-dji:FlightYSpeed'], '+0.10')
			assert.equal(exif.xmp['drone-dji:FlightZSpeed'], '+0.00')
			assert.equal(exif.xmp['drone-dji:CamReverse'], '0')
			assert.equal(exif.xmp['drone-dji:GimbalReverse'], '0')
			assert.equal(exif.xmp['crs:Version'], '7.0')
			assert.equal(exif.xmp['crs:HasSettings'], 'False')
			assert.equal(exif.xmp['crs:HasCrop'], 'False')
			assert.equal(exif.xmp['crs:AlreadyApplied'], 'False')
		})


		describe('DJI Zenmuse XT2 640 R 13mm', () => {

			it('RGB', async () => {
				const exif = await parse(buffers['DJI_Zenmuse_XT2_640_R_13mm.jpg'], options)
				assert.exists(exif, `exif doesn't exist`)
				assert.equal(exif.ImageDescription, 'DCIM/102MEDIA/DJI_0002.jpg')
				assert.equal(exif.Make, 'DJI')
				assert.equal(exif.Model, 'XT2')
				assert.equal(exif.PixelXDimension, 4000)
				assert.equal(exif.PixelYDimension, 3000)
				assert.equal(exif.Orientation, 1)
				assert.equal(exif.XResolution, 72)
				assert.equal(exif.YResolution, 72)
				assert.equal(exif.ResolutionUnit, 2)
				assert.equal(exif.Software, 'V06.02.20')
				assert.equal(exif.ModifyDate, '2019-05-24T15:24:01')
				assert.equal(exif.YCbCrPositioning, 1)
				assert.equal(exif.ExposureTime, 0.01)
				assert.equal(exif.FNumber, 1.8)
				assert.equal(exif.ExposureProgram, 'Normal program')
				assert.equal(exif.ISO, 128)
				assert.equal(exif.ExifVersion, '0210')
				assert.equal(exif.DateTimeOriginal, '2019-05-24T15:24:01')
				assert.equal(exif.DateTimeDigitized, '2019-05-24T15:24:01')
				assert.equal(exif.ComponentsConfiguration, 'Y, Cb, Cr, -')
				assert.equal(exif.ShutterSpeedValue, 6.643)
				assert.equal(exif.ApertureValue, 1.7)
				assert.equal(exif.ExposureBiasValue, 0)
				assert.equal(exif.MaxApertureValue, 1.7)
				assert.equal(exif.MeteringMode, 'Spot')
				assert.equal(exif.LightSource, 'Unknown')
				assert.equal(exif.Flash, 'Flash did not fire')
				assert.equal(exif.FocalLength, 8)
				assert.deepEqual(exif.SubjectArea, [ 2000, 1500, 4000, 3000 ])
				assert.equal(exif.FlashpixVersion, '0100')
				assert.equal(exif.ColorSpace, 1)
				assert.equal(exif.PixelXDimension, 4000)
				assert.equal(exif.PixelYDimension, 3000)
				assert.equal(exif.SceneType, 'Directly photographed')
				assert.equal(exif.GPSVersionID, '2.2.0.0')
				assert.equal(exif.GPSLatitudeRef, 'N')
				assert.deepEqual(exif.GPSLatitude, [ 39, 55, 3.4927368 ])
				assert.equal(exif.GPSLongitudeRef, 'W')
				assert.deepEqual(exif.GPSLongitude, [ 2, 49, 22.7140048 ])
				assert.equal(exif.GPSAltitudeRef, 0)
				assert.equal(exif.GPSAltitude, 881.609)
				assert.equal(exif.latitude, 39.91763687133333)
				assert.equal(exif.longitude, -2.822976112444444)

				// XMP
				assert.exists(exif.xmp)
				assert.equal(exif.xmp['rdf:about'], 'DJI Meta Data')
				assert.equal(exif.xmp['drone-dji:AbsoluteAltitude'], '881.609192')
				assert.equal(exif.xmp['drone-dji:RelativeAltitude'], '34.400002')
				assert.equal(exif.xmp['drone-dji:GimbalRollDegree'], '0.000000')
				assert.equal(exif.xmp['drone-dji:GimbalYawDegree'], '89.300003')
				assert.equal(exif.xmp['drone-dji:GimbalPitchDegree'], '-89.900002')
				assert.equal(exif.xmp['drone-dji:FlightRollDegree'], '-6.500000')
				assert.equal(exif.xmp['drone-dji:FlightYawDegree'], '90.000000')
				assert.equal(exif.xmp['drone-dji:FlightPitchDegree'], '-2.400000')
				assert.equal(exif.xmp['drone-dji:CamReverse'], '0')
				assert.equal(exif.xmp['drone-dji:GimbalReverse'], '0')
				assert.equal(exif.xmp['drone-dji:RtkFlag'], '0' )
			})

			it('TRM', async () => {
				const exif = await parse(buffers['DJI_Zenmuse_XT2_640_R_13mm.tiff'], options)
				assert.exists(exif, `exif doesn't exist`)
				assert.equal(exif.ImageWidth, 640)
				assert.equal(exif.ImageHeight, 512)
				assert.equal(exif.BitsPerSample, 16)
				assert.equal(exif.Compression, 1)
				assert.equal(exif.PhotometricInterpretation, 1)
				assert.equal(exif.Make, 'DJI')
				assert.equal(exif.Model, 'XT2')
				assert.equal(exif.StripOffsets, 8)
				assert.equal(exif.SamplesPerPixel, 1)
				assert.equal(exif.RowsPerStrip, 512)
				assert.equal(exif.StripByteCounts, 655360)
				assert.equal(exif.XResolution, 1)
				assert.equal(exif.YResolution, 1)
				assert.equal(exif.PlanarConfiguration, 1)
				assert.equal(exif.ResolutionUnit, 1)
				assert.deepEqual(exif.PageNumber, [ 0, 1 ])
				assert.equal(exif.Software, 'V06.02.20')
				assert.equal(exif.SampleFormat, 1)
				assert.equal(exif.CameraSerialNumber, '297394')
				assert.equal(exif.FNumber, 1.25)
				assert.equal(exif.DateTimeOriginal, '2019-05-24T15:24:01')
				assert.equal(exif.FocalLength, 13)
				assert.equal(exif.ImageNumber, 0)
				assert.equal(exif.SubSecTimeOriginal, '52')
				assert.equal(exif.FocalPlaneXResolution, 3.84)
				assert.equal(exif.FocalPlaneYResolution, 3.072)
				assert.equal(exif.FocalPlaneResolutionUnit, 4)
				assert.equal(exif.SensingMethod, 15)
				assert.equal(exif.GPSLatitudeRef, 'N')
				assert.deepEqual(exif.GPSLatitude, [ 39, 55, 3.493 ])
				assert.equal(exif.GPSLongitudeRef, 'W')
				assert.deepEqual(exif.GPSLongitude, [ 2, 49, 22.714 ])
				assert.equal(exif.GPSAltitudeRef, 0)
				assert.equal(exif.GPSAltitude, 881.609)
				assert.equal(exif.GPSMapDatum, 'WGS-84')
				assert.equal(exif.latitude, 39.91763694444444)
				assert.equal(exif.longitude, -2.8229761111111107)

				// XMP
				assert.exists(exif.xmp)
				assert.equal(exif.xmp['rdf:about'], 'DJI Meta Data')
				assert.equal(exif.xmp['drone-dji:AbsoluteAltitude'], '881.609192')
				assert.equal(exif.xmp['drone-dji:RelativeAltitude'], '34.400002')
				assert.equal(exif.xmp['drone-dji:GimbalRollDegree'], '0.000000')
				assert.equal(exif.xmp['drone-dji:GimbalYawDegree'], '89.300003')
				assert.equal(exif.xmp['drone-dji:GimbalPitchDegree'], '-89.900002')
				assert.equal(exif.xmp['drone-dji:FlightRollDegree'], '-6.500000')
				assert.equal(exif.xmp['drone-dji:FlightYawDegree'], '90.000000')
				assert.equal(exif.xmp['drone-dji:FlightPitchDegree'], '-2.400000')
				assert.equal(exif.xmp['drone-dji:CamReverse'], '0')
				assert.equal(exif.xmp['drone-dji:GimbalReverse'], '0')
				assert.equal(exif.xmp['drone-dji:RtkFlag'], '0')
				assert.equal(exif.xmp['FLIR:TlinearGain'], '0.04')
				assert.deepEqual(exif.xmp['FLIR:BandName'], [
					{ value: 'LWIR', attributes: {}, description: 'LWIR' }
				])
				assert.deepEqual(exif.xmp['FLIR:CentralWavelength'], [
					{ value: '10000', attributes: {}, description: '10000' }
				])
				assert.deepEqual(exif.xmp['FLIR:WavelengthFWHM'], [
					{ value: '4500', attributes: {}, description: '4500' }
				])
			})

		})

		describe('FLIR DUO PRO 640 R 13mm', () => {

			it('RGB', async () => {
				const exif = await parse(buffers['FLIR_DUO_PRO_640_R_13mm.JPG'], options)
				assert.exists(exif, `exif doesn't exist`)
				assert.equal(exif.Make, 'FLIR')
				assert.equal(exif.Model, 'Duo Pro R')
				assert.equal(exif.XResolution, 72)
				assert.equal(exif.YResolution, 72)
				assert.equal(exif.ResolutionUnit, 2)
				assert.equal(exif.Software, 'V01.02.05')
				assert.equal(exif.YCbCrPositioning, 1)
				assert.equal(exif.FNumber, 1.8)
				assert.equal(exif.FocalLength, 8)
				assert.equal(exif.FocalPlaneXResolution, 10.88)
				assert.equal(exif.FocalPlaneYResolution, 8.704)
				assert.equal(exif.FocalPlaneResolutionUnit, 4)
				assert.equal(exif.ExifVersion, '0210')
				assert.equal(exif.ComponentsConfiguration, 'Y, Cb, Cr, -')
				assert.deepEqual(exif.SubjectArea, [ 2000, 1500, 4000, 3000 ])
				assert.equal(exif.FlashpixVersion, '0100')
				assert.equal(exif.ColorSpace, 1)
				assert.equal(exif.PixelXDimension, 4000)
				assert.equal(exif.PixelYDimension, 3000)
				assert.equal(exif.GPSVersionID, '3.2.0.0')
				assert.equal(exif.GPSLatitudeRef, 'S')
				assert.deepEqual(exif.GPSLatitude, [ 0, 0, 0 ])
				assert.equal(exif.GPSLongitudeRef, 'W')
				assert.deepEqual(exif.GPSLongitude, [ 0, 0, 0 ])
				assert.equal(exif.GPSAltitudeRef, 0)
				assert.equal(exif.GPSAltitude, 0)
				assert.equal(exif.GPSTimeStamp, '12:1:23')
				assert.equal(exif.GPSSpeedRef, 'K')
				assert.equal(exif.GPSSpeed, 0)
				assert.equal(exif.GPSTrackRef, 'T')
				assert.equal(exif.GPSTrack, 0)
				assert.equal(exif.latitude, 0)
				assert.equal(exif.longitude, 0)

				// XMP
				// TODO: Fix XMP
				// assert.exists(exif.xmp)
			})

			it('TRM', async () => {
				const exif = await parse(buffers['FLIR_DUO_PRO_640_R_13mm.TIFF'], options)
				assert.exists(exif, `exif doesn't exist`)
				assert.equal(exif.ImageWidth, 640)
				assert.equal(exif.ImageHeight, 512)
				assert.equal(exif.BitsPerSample, 16)
				assert.equal(exif.Compression, 1)
				assert.equal(exif.PhotometricInterpretation, 1)
				assert.equal(exif.Make, 'FLIR')
				assert.equal(exif.Model, 'Duo Pro R')
				assert.equal(exif.StripOffsets, 8)
				assert.equal(exif.SamplesPerPixel, 1)
				assert.equal(exif.RowsPerStrip, 512)
				assert.equal(exif.StripByteCounts, 655360)
				assert.equal(exif.XResolution, 1)
				assert.equal(exif.YResolution, 1)
				assert.equal(exif.PlanarConfiguration, 1)
				assert.equal(exif.ResolutionUnit, 1)
				assert.deepEqual(exif.PageNumber, [ 0, 1 ])
				assert.equal(exif.Software, 'V01.02.05')
				assert.equal(exif.SampleFormat, 1)
				assert.equal(exif.CameraSerialNumber, '298067')
				assert.equal(exif.FNumber, 1.25)
				assert.equal(exif.DateTimeOriginal, '2019-06-14T12:01:23')
				assert.equal(exif.FocalLength, 13)
				assert.equal(exif.ImageNumber, 0)
				assert.equal(exif.SubSecTimeOriginal, '51')
				assert.equal(exif.FocalPlaneXResolution, 10.88)
				assert.equal(exif.FocalPlaneYResolution, 8.7)
				assert.equal(exif.FocalPlaneResolutionUnit, 4)
				assert.equal(exif.SensingMethod, 15)
				assert.equal(exif.GPSVersionID, '3.2.0.0')
				assert.equal(exif.GPSLatitudeRef, 'S')
				assert.deepEqual(exif.GPSLatitude, [ 0, 0, 0 ])
				assert.equal(exif.GPSLongitudeRef, 'W')
				assert.deepEqual(exif.GPSLongitude, [ 0, 0, 0 ])
				assert.equal(exif.GPSAltitudeRef, 0)
				assert.equal(exif.GPSAltitude, 0)
				assert.equal(exif.GPSMapDatum, 'WGS-84')
				assert.equal(exif.latitude, 0)
				assert.equal(exif.longitude, 0)

				// XMP
				// TODO: Fix XMP
				// assert.exists(exif.xmp)
			})

		})

		it('MicaSense RedEdge M', async () => {
			const exif = await parse(buffers['MicaSense_RedEdge_M.tif'], options)
			assert.exists(exif, `exif doesn't exist`)
			// TODO: Unknown tags
			assert.equal(exif.SubfileType, 0)
			assert.equal(exif.ImageWidth, 1280)
			assert.equal(exif.ImageHeight, 960)
			assert.equal(exif.BitsPerSample, 16)
			assert.equal(exif.Compression, 1)
			assert.equal(exif.PhotometricInterpretation, 1)
			assert.equal(exif.Make, 'MicaSense')
			assert.equal(exif.Model, 'RedEdge-M')
			assert.deepEqual(exif.StripOffsets, [ 8, 256008, 512008, 768008, 1024008, 1280008, 1536008, 1792008, 2048008, 2304008 ])
			assert.equal(exif.Orientation, 1)
			assert.equal(exif.SamplesPerPixel, 1)
			assert.equal(exif.RowsPerStrip, 100)
			assert.deepEqual(exif.StripByteCounts, [ 256000, 256000, 256000, 256000, 256000, 256000, 256000, 256000, 256000, 153600 ])
			assert.equal(exif.PlanarConfiguration, 1)
			assert.equal(exif.Software, 'v3.3.0')
			assert.equal(exif.ModifyDate, '2018-09-02T12:21:05')
			assert.deepEqual(exif.BlackLevelRepeatDim, [ 2, 2 ])
			assert.deepEqual(exif.BlackLevel, [ 4800, 4800, 4800, 4800 ])
			assert.equal(exif.ExposureTime, 0.00108)
			assert.equal(exif.FNumber, 2.8)
			assert.equal(exif.ExposureProgram, 'Normal program')
			assert.equal(exif.ISOSpeed, 200)
			assert.equal(exif.ExifVersion, '0230')
			assert.equal(exif.DateTimeOriginal, '2018-09-02T12:21:05')
			assert.equal(exif.DateTimeDigitized, '2018-09-02T12:21:05')
			assert.equal(exif.MeteringMode, 'Average')
			assert.equal(exif.FocalLength, 5.5)
			assert.equal(exif.SubSecTime, '-394485')
			assert.equal(exif.FocalPlaneXResolution, 266.666667)
			assert.equal(exif.FocalPlaneYResolution, 266.666667)
			assert.equal(exif.FocalPlaneResolutionUnit, 4)
			assert.equal(exif.BodySerialNumber, 'RM01-1817125-SC')
			assert.equal(exif.GPSVersionID, '2.2.0.0')
			assert.equal(exif.GPSLatitudeRef, 'N')
			assert.deepEqual(exif.GPSLatitude, [ 50, 44, 36.80376 ])
			assert.equal(exif.GPSLongitudeRef, 'E')
			assert.deepEqual(exif.GPSLongitude, [ 4, 55, 41.41272 ])
			assert.equal(exif.GPSAltitudeRef, 0)
			assert.equal(exif.GPSAltitude, 155.125)
			assert.equal(exif.GPSDOP, 1)
			assert.equal(exif.latitude, 50.7435566)
			assert.equal(exif.longitude, 4.9281702)

			// XMP
			assert.exists(exif.xmp)
			assert.equal(exif.xmp['rdf:about'], 'Pix4D Camera Information')
			assert.equal(exif.xmp['MicaSense:BootTimestamp'], '388')
			assert.deepEqual(exif.xmp['MicaSense:RadiometricCalibration'], [
				{ value: '0.00025158791998971484', attributes: {}, description: '0.00025158791998971484' },
				{ value: '7.5512765893711309e-08', attributes: {}, description: '7.5512765893711309e-08' },
				{ value: '5.1259784808667235e-06', attributes: {}, description: '5.1259784808667235e-06' }
			])
			assert.equal(exif.xmp['MicaSense:FlightId'], 'G1R5fuqhYObiVDDUoPY0')
			assert.equal(exif.xmp['MicaSense:CaptureId'], 'G01ph6LOYyFMzjpFQtbV')
			assert.equal(exif.xmp['MicaSense:TriggerMethod'], '4')
			assert.equal(exif.xmp['MicaSense:PressureAlt'], '69.928153991699219')
			assert.deepEqual(exif.xmp['MicaSense:DarkRowValue'], [
				{ value: '5296', attributes: {}, description: '5296' },
				{ value: '5297', attributes: {}, description: '5297' },
				{ value: '5103', attributes: {}, description: '5103' },
				{ value: '5121', attributes: {}, description: '5121' }
			])
			assert.equal(exif.xmp['Camera:BandName'], 'Red')
			assert.equal(exif.xmp['Camera:CentralWavelength'], '668')
			assert.equal(exif.xmp['Camera:WavelengthFWHM'], '10')
			assert.deepEqual(exif.xmp['Camera:VignettingCenter'], [
				{ value: '612.48288362060873', attributes: {}, description: '612.48288362060873' },
				{ value: '479.92852377966585', attributes: {}, description: '479.92852377966585' }
			])
			assert.deepEqual(exif.xmp['Camera:VignettingPolynomial'], [
				{ value: '-0.00012364905090800595', attributes: {}, description: '-0.00012364905090800595' },
				{ value: '1.5285817101337687e-06', attributes: {}, description: '1.5285817101337687e-06' },
				{ value: '-1.248939732320383e-08', attributes: {}, description: '-1.248939732320383e-08' },
				{ value: '3.615681445589148e-11', attributes: {}, description: '3.615681445589148e-11' },
				{ value: '-4.6263897219279838e-14', attributes: {}, description: '-4.6263897219279838e-14' },
				{ value: '2.1225983889505411e-17', attributes: {}, description: '2.1225983889505411e-17' }
			])
			assert.equal(exif.xmp['Camera:ModelType'], 'perspective')
			assert.equal(exif.xmp['Camera:PrincipalPoint'], '2.28596,1.80131')
			assert.equal(exif.xmp['Camera:PerspectiveFocalLength'], '5.4200334330371822')
			assert.equal(exif.xmp['Camera:PerspectiveFocalLengthUnits'], 'mm')
			assert.deepEqual(exif.xmp['Camera:PerspectiveDistortion'], [
				{ value: '-0.10090111395504248', attributes: {}, description: '-0.10090111395504248' },
				{ value: '0.14382399474370602', attributes: {}, description: '0.14382399474370602' },
				{ value: '-0.026905090009498728', attributes: {}, description: '-0.026905090009498728' },
				{ value: '-0.00018872727641257986', attributes: {}, description: '-0.00018872727641257986' },
				{ value: '0.00052417834650675681', attributes: {}, description: '0.00052417834650675681' }
			])
			assert.equal(exif.xmp['Camera:BandSensitivity'], '0.15135489626960455')
			assert.equal(exif.xmp['Camera:RigCameraIndex'], '2')
			assert.equal(exif.xmp['Camera:IrradianceExposureTime'], '0.10100000351667404')
			assert.equal(exif.xmp['Camera:IrradianceGain'], '16')
			assert.equal(exif.xmp['Camera:Irradiance'], '0.84336173534393311')
			assert.equal(exif.xmp['Camera:IrradianceYaw'], '85.346926915151712')
			assert.equal(exif.xmp['Camera:IrradiancePitch'], '-8.7011030729229155')
			assert.equal(exif.xmp['Camera:IrradianceRoll'], '-2.9012786841546623')
			assert.equal(exif.xmp['DLS:Serial'], 'DL06-1820013-SC')
			assert.equal(exif.xmp['DLS:SwVersion'], 'v1.0.1')
			assert.equal(exif.xmp['DLS:SensorId'], '2')
			assert.equal(exif.xmp['DLS:CenterWavelength'], '668')
			assert.equal(exif.xmp['DLS:Bandwidth'], '10')
			assert.equal(exif.xmp['DLS:TimeStamp'], '393084')
			assert.equal(exif.xmp['DLS:Exposure'], '0.10100000351667404')
			assert.equal(exif.xmp['DLS:Gain'], '16')
			assert.equal(exif.xmp['DLS:SpectralIrradiance'], '0.84336173534393311')
			assert.equal(exif.xmp['DLS:RawMeasurement'], '731')
			assert.equal(exif.xmp['DLS:OffMeasurement'], '2878')
			assert.equal(exif.xmp['DLS:Yaw'], '1.4895848811283643')
			assert.equal(exif.xmp['DLS:Pitch'], '-0.15186289717790113')
			assert.equal(exif.xmp['DLS:Roll'], '-0.050636865556427491' )
		})

		it('Delair UX11', async () => {
			const exif = await parse(buffers['Delair_UX11.jpg'], options)
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.ProcessingSoftware, 'Delair After Flight 46780')
			assert.equal(exif.ImageDescription, '00000000')
			assert.equal(exif.Make, 'Delair')
			assert.equal(exif.Model, 'UX11-3B')
			assert.equal(exif.XResolution, 300)
			assert.equal(exif.YResolution, 300)
			assert.equal(exif.ResolutionUnit, 2)
			assert.equal(exif.ModifyDate, '2019-03-14T22:45:00')
			assert.equal(exif.YCbCrPositioning, 1)
			assert.equal(exif.ExposureTime, 0.000039)
			assert.equal(exif.FNumber, 2.8)
			assert.equal(exif.ISO, 100)
			assert.equal(exif.SensitivityType, 3)
			assert.equal(exif.ISOSpeed, 100)
			assert.equal(exif.ExifVersion, '0230')
			assert.equal(exif.DateTimeOriginal, '2019-03-14T22:45:00')
			assert.equal(exif.DateTimeDigitized, '2019-03-14T22:45:00')
			assert.equal(exif.FocalLength, 12)
			assert.equal(exif.SubSecTime, '106')
			assert.equal(exif.SubSecTimeOriginal, '106')
			assert.equal(exif.SubSecTimeDigitized, '106')
			assert.equal(exif.ColorSpace, 1)
			assert.equal(exif.PixelXDimension, 5048)
			assert.equal(exif.PixelYDimension, 4228)
			assert.equal(exif.FocalPlaneXResolution, 5988.024)
			assert.equal(exif.FocalPlaneYResolution, 5988.024)
			assert.equal(exif.FocalPlaneResolutionUnit, 'Centimeter')
			assert.equal(exif.BodySerialNumber, '4103356596')
			assert.equal(exif.GPSVersionID, '3.2.0.0')
			assert.equal(exif.GPSLatitudeRef, 'N')
			assert.deepEqual(exif.GPSLatitude, [ 25, 3, 7.806 ])
			assert.equal(exif.GPSLongitudeRef, 'W')
			assert.deepEqual(exif.GPSLongitude, [ 103, 42, 2.104 ])
			assert.equal(exif.GPSAltitudeRef, 0)
			assert.equal(exif.GPSAltitude, 1797.834)
			assert.equal(exif.GPSMapDatum, 'WGS-84')
			assert.equal(exif.latitude, 25.052168333333334)
			assert.equal(exif.longitude, -103.70058444444444)

			// XMP
			assert.exists(exif.xmp)
			assert.equal(exif.xmp['rdf:about'], '')
			assert.equal(exif.xmp['Camera:Roll'], '3.7')
			assert.equal(exif.xmp['Camera:Pitch'], '13.9')
			assert.equal(exif.xmp['Camera:Yaw'], '62.1')
			assert.equal(exif.xmp['Camera:GPSXYAccuracy'], '1.2')
			assert.equal(exif.xmp['Camera:GPSZAccuracy'], '1.7')
			assert.equal(exif.xmp['CRSInfo:VERTCRS'], 'EGM96')
			assert.deepEqual(exif.xmp['Camera:TransformAlpha'], [
				{ value: '1.500000', attributes: {}, description: '1.500000' },
				{ value: '1.500000', attributes: {}, description: '1.500000' },
				{ value: '1.500000', attributes: {}, description: '1.500000' }
			])
			assert.deepEqual(exif.xmp['Camera:TransformBeta'], [
				{ value: '-2379.335363', attributes: {}, description: '-2379.335363' },
				{ value: '-2379.335363', attributes: {}, description: '-2379.335363' },
				{ value: '-2379.335363', attributes: {}, description: '-2379.335363' }
			])
			assert.deepEqual(exif.xmp['Camera:TransformGamma'], [
				{ value: '2.200000', attributes: {}, description: '2.200000' },
				{ value: '2.200000', attributes: {}, description: '2.200000' },
				{ value: '2.200000', attributes: {}, description: '2.200000' }
			])
		})

		it('FLIR Tau 2 640 R 19mm', async () => {
			const exif = await parse(buffers['FLIR_Tau_2_640_R_19mm.jpg'], options)
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.Make, 'FLIR Systems')
			assert.equal(exif.Model, 'FLIR Tau 2 640')
			assert.equal(exif.Software, 'AscTec FLIR Converter')
			assert.equal(exif.ModifyDate, '2019-07-26T09:00:39')
			assert.equal(exif.DateTimeOriginal, '2019-07-19T11:21:52')
			assert.equal(exif.GPSLatitudeRef, 'N')
			assert.deepEqual(exif.GPSLatitude, [ 52, 0, 43.0847 ])
			assert.equal(exif.GPSLongitudeRef, 'E')
			assert.deepEqual(exif.GPSLongitude, [ 4, 41, 33.4967 ])
			assert.equal(exif.GPSAltitudeRef, 0)
			assert.equal(exif.GPSAltitude, 29.336)
			assert.equal(exif.GPSTimeStamp, '11:21:52')
			assert.equal(exif.GPSImgDirectionRef, 'T')
			assert.equal(exif.GPSImgDirection, 0)
			assert.equal(exif.GPSDateStamp, '2019:07:19')
			assert.equal(exif.GPSPitch, -90)
			assert.equal(exif.GPSRoll, -11.06)
			assert.equal(exif.timestamp, '2019-07-19T11:21:52')
			assert.equal(exif.latitude, 52.01196797222222)
			assert.equal(exif.longitude, 4.692637972222222)

			// FLIR FFF Segment
			assert.exists(exif.flir)
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
			assert.equal(exif.flir.PlanckR1, 375897)
			assert.equal(exif.flir.PlanckB, 1428)
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
			assert.equal(exif.flir.PlanckO, -56)
			assert.equal(exif.flir.PlanckR2, 1)
			assert.equal(exif.flir.RawValueMedian, 4458)
			assert.equal(exif.flir.RawValueRange, 1805)
			assert.equal(exif.flir.FocusStepCount, 0)
			assert.equal(exif.flir.FocusDistance, 0)
			assert.equal(exif.flir.PaletteName, 'Rainbow')
			assert.equal(exif.flir.GPSMapDatum, 'WGS-84')
		})

		it('Sensefly Thermomap 9mm', async () => {
			const exif = await parse(buffers['Sensefly_Thermomap_9mm.tif'], options)
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.ProcessingSoftware, 'eBee')
			assert.equal(exif.ImageWidth, 640)
			assert.equal(exif.ImageHeight, 512)
			assert.equal(exif.BitsPerSample, 16)
			assert.equal(exif.Compression, 5)
			assert.equal(exif.Make, 'senseFly')
			assert.equal(exif.Model, 'thermoMAP')
			assert.equal(exif.StripOffsets, 3012)
			assert.equal(exif.SamplesPerPixel, 1)
			assert.equal(exif.StripByteCounts, 518880)
			assert.equal(exif.DateTimeOriginal, '2015-11-19T11:35:28')
			assert.equal(exif.FocalLength, 9)
			assert.equal(exif.GPSLatitudeRef, 'N')
			assert.deepEqual(exif.GPSLatitude, [ 40.0594223, 0, 0 ])
			assert.equal(exif.GPSLongitudeRef, 'E')
			assert.deepEqual(exif.GPSLongitude, [ 23.402305, 0, 0 ])
			assert.equal(exif.GPSAltitude, 142.365088)
			assert.equal(exif.latitude, 40.0594223)
			assert.equal(exif.longitude, 23.402305)

			// XMP
			assert.exists(exif.xmp)
			assert.equal(exif.xmp['rdf:about'], '')
			assert.equal(exif.xmp['sensefly:GyroRate'], '1.098')
			assert.equal(exif.xmp['sensefly:CamId'], '2')
			assert.equal(exif.xmp['sensefly:Yaw'], '189.428')
			assert.equal(exif.xmp['sensefly:Pitch'], '12.5908')
			assert.equal(exif.xmp['sensefly:Roll'], '-3.384')
			assert.equal(exif.xmp['sensefly:GPSXYAccuracy'], '5.367')
			assert.equal(exif.xmp['sensefly:GPSZAccuracy'], '3.978')
			assert.equal(exif.xmp['Camera:NominalCameraDistance'], '9.7')
			assert.equal(exif.xmp['Camera:IsNormalized'], '1' )
		})

		it('Sensefly S.O.D.A.', async () => {
			const exif = await parse(buffers['Sensefly_SODA.JPG'], options)
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.ProcessingSoftware, 'eMotion 3.X.Xnb')
			assert.equal(exif.Make, 'senseFly')
			assert.equal(exif.Model, 'S.O.D.A.')
			assert.equal(exif.XResolution, 72)
			assert.equal(exif.YResolution, 72)
			assert.equal(exif.ResolutionUnit, 2)
			assert.equal(exif.Software, '1.3.0')
			assert.equal(exif.UniqueCameraModel, 'senseFly S.O.D.A.')
			assert.equal(exif.CameraSerialNumber, 'SI002001AA7I00076')
			assert.equal(exif.ExposureTime, 0.001)
			assert.equal(exif.FNumber, 2.8)
			assert.equal(exif.ExposureProgram, 'Shutter priority')
			assert.equal(exif.ISO, 250)
			assert.equal(exif.DateTimeOriginal, '2019-03-18T11:01:20')
			assert.equal(exif.ApertureValue, 3)
			assert.equal(exif.ExposureBiasValue, 0)
			assert.equal(exif.MaxApertureValue, 2.97)
			assert.equal(exif.SubjectDistance, 4294967.295)
			assert.equal(exif.FocalLength, 10.6)
			assert.equal(exif.SubSecTimeOriginal, '00')
			assert.equal(exif.PixelXDimension, 5472)
			assert.equal(exif.PixelYDimension, 3648)
			assert.equal(exif.FocalPlaneXResolution, 4167)
			assert.equal(exif.FocalPlaneYResolution, 4167)
			assert.equal(exif.FocalPlaneResolutionUnit, 'Centimeter')
			assert.equal(exif.WhiteBalance, 'Manual white balance')
			assert.equal(exif.FocalLengthIn35mmFormat, 28)
			assert.equal(exif.BodySerialNumber, 'SI002001AA7I00076')
			assert.equal(exif.LensModel, '')
			assert.equal(exif.GPSVersionID, '2.3.0.0')
			assert.equal(exif.GPSLatitudeRef, 'N')
			assert.deepEqual(exif.GPSLatitude, [ 46, 35, 52.310528 ])
			assert.equal(exif.GPSLongitudeRef, 'E')
			assert.deepEqual(exif.GPSLongitude, [ 6, 36, 31.664439 ])
			assert.equal(exif.GPSAltitudeRef, 0)
			assert.equal(exif.GPSAltitude, 758.7552)
			assert.equal(exif.GPSTimeStamp, '11:1:20.284')
			assert.equal(exif.GPSStatus, 'A')
			assert.equal(exif.GPSMapDatum, 'WGS-84')
			assert.equal(exif.GPSDateStamp, '2019:03:18')
			assert.equal(exif.timestamp, '2019-03-18T11:01:20')
			assert.equal(exif.latitude, 46.59786403555556)
			assert.equal(exif.longitude, 6.6087956775)

			// XMP
            assert.exists(exif.xmp)
            assert.equal(exif.xmp['rdf:about'], '')
            assert.equal(exif.xmp['sensefly:CamId'], '33')
            assert.equal(exif.xmp['Camera:IMULinearVelocity'], '-2e+10,-2e+10,-2e+10')
            assert.equal(exif.xmp['Camera:Pitch'], '13.811229')
            assert.equal(exif.xmp['Camera:Roll'], '-6.932620')
            assert.equal(exif.xmp['Camera:Yaw'], '-146.946594')
            assert.equal(exif.xmp['Camera:GPSXYAccuracy'], '0.024764')
            assert.equal(exif.xmp['Camera:GPSZAccuracy'], '0.036845')
            assert.equal(exif.xmp['Camera:IMURollAccuracy'], '5')
            assert.equal(exif.xmp['Camera:IMUPitchAccuracy'], '5')
            assert.equal(exif.xmp['Camera:IMUYawAccuracy'], '10')
            assert.equal(exif.xmp['Camera:RigName'], 'Duet T')
            assert.equal(exif.xmp['Camera:RigCameraIndex'], '1')
            assert.equal(exif.xmp['Platform:Manufacturer'], 'senseFly')
            assert.equal(exif.xmp['Platform:Model'], 'eBee X')
            assert.equal(exif.xmp['Platform:SerialNumber'], 'IX-x1-00057')
            assert.equal(exif.xmp['Platform:SwVersion'], '3.X.Xnb 3254' )
		})

		it('Wiris 2nd Gen 640 19mm', async () => {
			const exif = await parse(buffers['Wiris_2nd_Gen_640_19mm.tiff'], options)
			assert.exists(exif, `exif doesn't exist`)
			assert.equal(exif.ImageWidth, 640)
			assert.equal(exif.ImageHeight, 512)
			assert.equal(exif.BitsPerSample, 16)
			assert.equal(exif.Compression, 1)
			assert.equal(exif.PhotometricInterpretation, 1)
			assert.equal(exif.FillOrder, 1)
			assert.equal(exif.Model, 'WIRIS640')
			assert.equal(exif.StripOffsets, 16)
			assert.equal(exif.Orientation, 1)
			assert.equal(exif.SamplesPerPixel, 1)
			assert.equal(exif.RowsPerStrip, 512)
			assert.equal(exif.StripByteCounts, 655360)
			assert.equal(exif.XResolution, 88)
			assert.equal(exif.YResolution, 88)
			assert.equal(exif.PlanarConfiguration, 1)
			assert.equal(exif.ResolutionUnit, 3)
			assert.equal(exif.ModifyDate, '2017-09-16T00:00:00')
			assert.equal(exif.SampleFormat, 1)
			assert.equal(exif.SMinSampleValue, 7296)
			assert.equal(exif.SMaxSampleValue, 7774)
			assert.equal(exif.CameraSerialNumber, '170307')
			assert.equal(exif.DateTimeOriginal, '2017-09-16T15:28:54')
			assert.equal(exif.FocalLength, 19.0089453125)
			assert.equal(exif.GPSVersionID, '2...2...0...0')
			assert.deepEqual(exif.GPSLatitude, [ 49, 39, 2.89 ])
			assert.equal(exif.GPSLatitudeRef, 'N')
			assert.equal(exif.GPSLongitudeRef, 'E')
			assert.deepEqual(exif.GPSLongitude, [ 15, 29, 50.24 ])
			assert.equal(exif.GPSAltitudeRef, 'm')
			assert.equal(exif.GPSAltitude, 504.395)
			assert.equal(exif.GPSTimeStamp, '15:28:54')
			assert.equal(exif.GPSDateStamp, '2017:09:16 15:28:54')
			assert.equal(exif.timestamp, '2017-09-16T15:28:54')
			assert.equal(exif.latitude, 49.65080277777778)
			assert.equal(exif.longitude, 15.497288888888889)
		})

	})

})
