import Reader from './reader.mjs'
import * as tags from './tags.mjs'
import {
	getUint8,
	getUint16,
	getUint32,
	getInt8,
	getInt16,
	getInt32,
    getFloat32,
	getFloat64,
	slice,
	toString
} from './buff-util.mjs'

const SIZE_LOOKUP = {
	1: 1, // BYTE      - 8-bit unsigned integer
	2: 1, // ASCII     - 8-bit bytes w/ last byte null
	3: 2, // SHORT     - 16-bit unsigned integer
	4: 4, // LONG      - 32-bit unsigned integer
	5: 8, // RATIONAL  - 64-bit unsigned fraction
	6: 1, // SBYTE     - 8-bit signed integer
	7: 1, // UNDEFINED - 8-bit untyped data
	8: 2, // SSHORT    - 16-bit signed integer
	9: 4, // SLONG     - 32-bit signed integer
	10: 8, // SRATIONAL - 64-bit signed fraction (Two 32-bit signed integers)
	11: 4, // FLOAT,    - 32-bit IEEE floating point
	12: 8, // DOUBLE    - 64-bit IEEE floating point
	// https://sno.phy.queensu.ca/~phil/exiftool/standards.html
	13: 4 // IFD (sometimes used instead of 4 LONG)
}

// TODO: disable/enable tags dictionary
// TODO: public tags dictionary. user can define what he needs and uses 

const THUMB_OFFSET = 'ThumbnailOffset'
const THUMB_LENGTH = 'ThumbnailLength'
const IFD_EXIF     = 'ExifIFDPointer'
const IFD_INTEROP  = 'InteroperabilityIFDPointer'
const IFD_GPS      = 'GPSInfoIFDPointer'

// First argument can be Node's Buffer or Web's DataView instance.
// Takes chunk of file and tries to find EXIF (it usually starts inside the chunk, but is much larger).
// Returns location {start, size, end} of the EXIF in the file not the input chunk itself.

function findAppSegment(buffer, appN, condition, callback, offset = 0) {
	let length = (buffer.length || buffer.byteLength) - 10
	let nMarkerByte = 0xE0 | appN
	for (; offset < length; offset++) {
		if (getUint8(buffer, offset) === 0xFF
		 && getUint8(buffer, offset + 1) === nMarkerByte
		 && condition(buffer, offset)) {
		 	if (callback) return callback(buffer, offset)
			let start = offset
			let size = getUint16(buffer, offset + 2)
			let end = start + size
			return {start, size, end}
		}
	}
}



export function findTiff(buffer) {
	// tiff files start with tiff segment without the app segment header
	var marker = getUint16(buffer, 0)
	if (marker === 0x4949 || marker === 0x4D4D) return {start: 0}
	// otherwise find the segment header.
	return findAppSegment(buffer, 1, isExifSegment, getExifSize)
}

function isExifSegment(buffer, offset) {
	return getUint32(buffer, offset + 4) === 0x45786966 // 'Exif'
		&& getUint16(buffer, offset + 8) === 0x0000     // followed by '\0'
}

function getExifSize(buffer, offset) {
	var start = offset + 10
	var size = getUint16(buffer, offset + 2)
	var end = start + size
	return {start, size, end}
}



function findFlirFFF(buffer) {
	return findAppSegment(buffer, 1, isFlirFFFSegment, getFlirFFFSize);
}

function isFlirFFFSegment(buffer, offset) {
	return getUint32(buffer, offset + 4) === 0x464C4952 // 'FLIR'
	// After FLIR, there always seems to be 00 01 00 0A, but I'm not sure so I'm not checking that yet
	// 	&& getUint32(buffer, osset + 8) === 0x0001000A
	// If this is followed by 'FFF\0' (46 46 46 00 in hex), this is an FFF segment
		&& getUint32(buffer, offset + 12) === 0x46464600 // 'FFF\0'
}

function getFlirFFFSize(buffer, offset) {
    // TODO: Implement size!
	var start = offset + 12
	var size = getUint16(buffer, offset + 2)
	var end = start + size
	return {start, size, end}
}



function findXmp(buffer) {
	return findAppSegment(buffer, 1, isXmpSegment, getXmpSize)
}

function isXmpSegment(buffer, offset) {
	return getUint32(buffer, offset + 4) === 0x68747470 // 'http'
}

function getXmpSize(buffer, offset) {
	var start = offset + 4
	var size = getUint16(buffer, offset + 2)
	var end = start + size
	return {start, size, end}
}


/*
// NOTE: This only works with single segment ICC data.
// TODO: Implement multi-segment parsing.
// Not implemented for now
function findIcc(buffer) {
	//return findAppSegment(buffer, 2, isIccSegment, getIccSize)
}

function isIccSegment(buffer, offset) {
	// TODO
}

function getIccSize(buffer, offset) {
	// TODO
}
*/


// NOTE: This only works with single segment IPTC data.
// TODO: Implement multi-segment parsing.
//function findIptc(buffer, offset = 0) {
//	return findAppSegment(buffer, 13, isIptcSegment, getIptcSize)
//}

// NOTE: reverted back to searching by the 38 42 49... bytes, because ID string could change (Photoshop 2.5, Photoshop 3)
function findIptc(buffer, offset) {
	var length = (buffer.length || buffer.byteLength) - 10
	for (var offset = 0; offset < length; offset++) {
		if (isIptcSegmentHead(buffer, offset)) {
			// Get the length of the name header (which is padded to an even number of bytes)
			var nameHeaderLength = getUint8(buffer, offset + 7)
			if (nameHeaderLength % 2 !== 0)
				nameHeaderLength += 1
			// Check for pre photoshop 6 format
			if (nameHeaderLength === 0)
				nameHeaderLength = 4
			var start = offset + 8 + nameHeaderLength
			var size = getUint16(buffer, offset + 6 + nameHeaderLength)
			var end = start + size
			return {start, size, end}
		}
	}
}

function isIptcSegmentHead(buffer, offset) {
	return getUint8(buffer, offset)     === 0x38
		&& getUint8(buffer, offset + 1) === 0x42
		&& getUint8(buffer, offset + 2) === 0x49
		&& getUint8(buffer, offset + 3) === 0x4D
		&& getUint8(buffer, offset + 4) === 0x04
		&& getUint8(buffer, offset + 5) === 0x04
}



// https://en.wikipedia.org/wiki/JPEG_File_Interchange_Format
// https://sno.phy.queensu.ca/~phil/exiftool/TagNames/JPEG.html
// http://dev.exiv2.org/projects/exiv2/wiki/The_Metadata_in_JPEG_files
// JPG contains SOI, APP1, [APP2, ... APPn], DQT, DHT, and more segments
// APPn contain metadata about the image in various formats. There can be multiple APPn segments,
// even multiple segments of the same type.
// APP1 contains the basic and most important EXIF data.
// APP2 contains ICC
// APP13 contains IPTC
// the main APP1 (the one with EXIF) is often followed by another APP1 with XMP data (in XML format).
// Structure of APPn (APP1, APP2, APP13, etc...):
// - First two bytes are the marker FF En (e.g. FF E1 for APP1)
// - 3rd & 4th bytes are length of the APPn segment
// - Followed by a few bytes of segment itentification - describing what type of content is there.
// Structure of TIFF (APP1-EXIF):
// - FF 01 - marker
// - xx xx - Size
// - 45 78 69 66 00 00 / ASCII string 'Exif\0\0'
// - TIFF HEADER
// - 0th IFD + value
// - 1th IFD + value
// - may contain additional GPS, Interop, SubExif blocks (pointed to from IFD0)
export class ExifParser extends Reader {

	async read(arg) {
		let [buffer, tiffPosition] = await super.read(arg) || []
		this.buffer = buffer
		this.tiffPosition = tiffPosition
	}

	async parse() {
		// return undefined if file has no exif
		if (this.tiffPosition === undefined) return

		if (typeof this.tiffPosition === 'object') {
			this.tiffOffset = this.tiffPosition.start
			// jpg wraps tiff into app1 segment.
			this.app1Offset = this.tiffOffset - 6
			if (this.app1Offset <= 0) this.app1Offset = undefined
		}

		if (this.options.tiff) await this.parseTiff() // The basic EXIF tags (image, exif, gps)
		if (this.options.xmp)  this.parseXmpSegment()  // Additional XML data (in XML)
		if (this.options.icc)  this.parseIccSegment()  // Image profile
		if (this.options.iptc) this.parseIptcSegment() // Captions and copyrights
		if (this.options.flir) this.parseFlirFFFSegment() // Additional data included by FLIR cameras

		// close FS file handle just in case it's still open
		if (this.reader) this.reader.destroy()

		let {image, exif, gps, interop, thumbnail, iptc} = this
		if (this.options.mergeOutput)
			var output = Object.assign({}, image, exif, gps, interop, thumbnail, iptc)
		else
			var output = {image, exif, gps, interop, thumbnail, iptc}
		if (this.xmp) output.xmp = this.xmp
        if (this.flir) output.flir = this.flir
		// Return undefined rather than empty object if there's no data.
		for (let key in output)
			if (output[key] === undefined)
				delete output[key]
		if (Object.keys(output).length === 0) return
		return output
	}

	// THUMBNAIL buffer of TIFF of APP1 segment
	async extractThumbnail() {
		// return undefined if file has no exif
		if (this.tiffPosition === undefined) return
		if (!this.tiffParsed) await this.parseTiff()
		if (!this.thumbnailParsed) await this.parseThumbnailBlock(true)
		if (this.thumbnail === undefined) return 
		// TODO: replace 'ThumbnailOffset' & 'ThumbnailLength' by raw keys (when tag dict is not included)
		let offset = this.thumbnail[THUMB_OFFSET] + this.tiffOffset
		let length = this.thumbnail[THUMB_LENGTH]
		let arrayBuffer = this.buffer.buffer
		let slice = arrayBuffer.slice(offset, offset + length)
		if (typeof Buffer !== 'undefined')
			return Buffer.from(slice)
		else
			return slice
	}

	// .tif files do no have any APPn segments. and usually start right with TIFF header
	// .jpg files can have multiple APPn segments. They always have APP1 whic is a wrapper for TIFF.
	// APP1 includes TIFF formatted values, grouped into IFD blocks (IFD0, Exif, Interop, GPS, IFD1)

	// APP1 HEADER:
	// - FF E1 - segment marker
	// - 2Bytes - segment length
	// - 45 78 69 66 00 00 - string 'Exif\0\0'
	// APP1 CONTENT:
	// - TIFF HEADER (2b byte order, 2b tiff id, 4b offset of ifd1)
	// - IFD0
	// - Exif IFD
	// - Interop IFD
	// - GPS IFD
	// - IFD1

	// We support both jpg and tiff so we're not looking for app1 segment but directly for tiff
	// because app1 in jpg is only container for tiff.
	async parseTiff() {
		if (this.tiffParsed) return
		this.tiffParsed = true
		// Cancel if the file doesn't contain the segment or if it's damaged.
		// This is not really TIFF segment. rather TIFF wrapped inside APP1 segment.
		if (!this.ensureSegmentPosition('tiff', findTiff, false)) return
		this.parseTiffHeader()
		await this.parseIfd0Block()                                  // APP1 - IFD0
		if (this.options.exif)      await this.parseExifBlock()      // APP1 - EXIF IFD
		if (this.options.gps)       await this.parseGpsBlock()       // APP1 - GPS IFD
		if (this.options.interop)   await this.parseInteropBlock()   // APP1 - Interop IFD
		if (this.options.thumbnail) await this.parseThumbnailBlock() // APP1 - IFD1
	}

	parseTiffHeader() {
		// Detect endian 11th byte of TIFF (1st after header)
		var byteOrder = getUint16(this.buffer, this.tiffOffset)
		if (byteOrder === 0x4949)
			this.le = true // little endian
		else if (byteOrder === 0x4D4D)
			this.le = false // big endian
		else
			throw new Error('Invalid EXIF data: expected byte order marker (0x4949 or 0x4D4D).')

		// Bytes 8 & 9 are expected to be 00 2A.
		if (getUint16(this.buffer, this.tiffOffset + 2, this.le) !== 0x002A)
			throw new Error('Invalid EXIF data: expected 0x002A.')

		this.ifd0Offset = getUint32(this.buffer, this.tiffOffset + 4, this.le)
	}

	async parseIfd0Block() {
		// Read the IFD0 segment with basic info about the image
		// (width, height, maker, model and pointers to another segments)
		if (this.ifd0Offset < 8)
			throw new Error('Invalid EXIF data: IFD0 offset should be less than 8')
		var ifd0 = await this.parseTiffTags(this.tiffOffset + this.ifd0Offset, tags.exif)
		this.image = ifd0
		//console.log('this.image', this.image)

		// Cancel if the ifd0 is empty (imaged created from scratch in photoshop).
		if (Object.keys(ifd0).length === 0) return

		this.exifOffset    = ifd0[IFD_EXIF]
		this.interopOffset = ifd0[IFD_INTEROP]
		this.gpsOffset     = ifd0[IFD_GPS]

		// IFD0 segment also contains offset pointers to another segments deeper within the EXIF.
		// User doesn't need to see this. But we're sanitizing it only if options.postProcess is enabled.
		if (this.options.postProcess) {
			delete this.image[IFD_EXIF]
			delete this.image[IFD_INTEROP]
			delete this.image[IFD_GPS]
		}
	}

	// EXIF block of TIFF of APP1 segment
	// 0x8769
	async parseExifBlock() {
		if (this.exifOffset === undefined) return
		this.exif = await this.parseTiffTags(this.tiffOffset + this.exifOffset, tags.exif)
	}

	// GPS block of TIFF of APP1 segment
	// 0x8825
	async parseGpsBlock() {
		if (this.gpsOffset === undefined) return
		let gps = this.gps = await this.parseTiffTags(this.tiffOffset + this.gpsOffset, tags.gps)
		// Add custom timestamp property as a mixture of GPSDateStamp and GPSTimeStamp
		if (this.options.postProcess) {
			if (gps.GPSDateStamp && gps.GPSTimeStamp)
				gps.timestamp = reviveDate(gps.GPSDateStamp + ' ' + gps.GPSTimeStamp)
			if (gps && gps.GPSLatitude) {
				gps.latitude  = ConvertDMSToDD(...gps.GPSLatitude, gps.GPSLatitudeRef)
				gps.longitude = ConvertDMSToDD(...gps.GPSLongitude, gps.GPSLongitudeRef)
			}
		}
	}

	// INTEROP block of TIFF of APP1 segment
	// 0xA005
	async parseInteropBlock() {
		if (!this.options.interop) return
		this.interopOffset = this.interopOffset || (this.exif && this.exif[IFD_INTEROP])
		if (this.interopOffset === undefined) return
		this.interop = await this.parseTiffTags(this.tiffOffset + this.interopOffset, tags.exif)
	}

	// THUMBNAIL block of TIFF of APP1 segment
	// returns boolean "does the file contain thumbnail"
	async parseThumbnailBlock(force = false) {
		if (this.thumbnailParsed) return true
		if (force === false && this.options.mergeOutput) return false
		let ifd0Entries = getUint16(this.buffer, this.tiffOffset + this.ifd0Offset, this.le)
		let temp = this.tiffOffset + this.ifd0Offset + 2 + (ifd0Entries * 12)
		this.ifd1Offset = getUint32(this.buffer, temp, this.le)
		// IFD1 offset is number of bytes from start of TIFF header where thumbnail info is.
		if (this.ifd1Offset === 0) return false
		this.thumbnail = await this.parseTiffTags(this.tiffOffset + this.ifd1Offset, tags.exif)
		this.thumbnailParsed = true
		return true
	}

	async parseTiffTags(offset, tagNames) {
		// TODO: re-read file if portion of the exif is outside of read chunk
		// (test/001.tif has tiff segment at the beggining plus at the end)
		if (offset > this.buffer.byteLength) {
			if (this.mode === 'chunked') {
				var chunk = await this.reader.readChunk({
					start: offset,
					size: 10000,
				})
				offset = 0
			} else {
				throw new Error(`segment offset ${offset} is out of chunk size ${this.buffer.byteLength}`)
			}
		} else {
			var chunk = this.buffer
		}
		var entriesCount = getUint16(chunk, offset, this.le)
		//return
		offset += 2
		var res = {}
		for (var i = 0; i < entriesCount; i++) {
			var tag = getUint16(chunk, offset, this.le)
			var key = tagNames[tag] || tag
			var val = this.parseTiffTag(chunk, offset)
			//console.log(`${i} / ${entriesCount} |`, offset, '|', tag, key, val)
			if (this.options.postProcess)
				val = translateValue(key, val)
			res[key] = val
			offset += 12
		}
		return res
	}

	parseTiffTag(chunk, offset) {
		var type = getUint16(chunk, offset + 2, this.le)
		var valuesCount = getUint32(chunk, offset + 4, this.le)
		var valueByteSize = SIZE_LOOKUP[type]
		if (valueByteSize * valuesCount <= 4)
			var valueOffset = offset + 8
		else
			var valueOffset = this.tiffOffset + getUint32(chunk, offset + 8, this.le)

		if (valueOffset > chunk.buffer.byteLength)
			throw new Error(`tiff value offset ${valueOffset} is out of chunk size ${chunk.buffer.byteLength}`)

		// ascii strings, array of 8bits/1byte values.
		if (type === 2) {
			var end = valueOffset + valuesCount
			var string = toString(chunk, valueOffset, end)
			if (string.endsWith('\0')) // remove null terminator
				return string.slice(0, -1)
			return string
		}

		// undefined/buffers of 8bit/1byte values.
		if (type === 7)
			return slice(chunk, valueOffset, valueOffset + valuesCount)

		// Now that special cases are solved, we can return the normal uint/int value(s).
		if (valuesCount === 1) {
			// Return single value.
			return this.parseTiffTagValue(chunk, valueOffset, type)
		} else {
			// Return array of values.
			var res = []
			for (var i = 0; i < valuesCount; i++) {
				res.push(this.parseTiffTagValue(chunk, valueOffset, type))
				valueOffset += valueByteSize
			}
			return res
		}
	}

	parseTiffTagValue(chunk, offset, type) {
		switch (type) {
			case 1:  return getUint8(chunk, offset)
			case 3:  return getUint16(chunk, offset, this.le)
			case 4:  return getUint32(chunk, offset, this.le)
			case 5:  return getUint32(chunk, offset, this.le) / getUint32(chunk, offset + 4, this.le)
			case 6:  return getInt8(chunk, offset)
			case 8:  return getInt16(chunk, offset, this.le)
			case 9:  return getInt32(chunk, offset, this.le)
			case 10: return getInt32(chunk, offset, this.le) / getInt32(chunk, offset + 4, this.le)
			case 11: return getFloat32(chunk, offset, this.le)
			case 12: return getFloat64(chunk, offset, this.le)
			case 13: return getUint32(chunk, offset, this.le)
			default: throw new Error(`Invalid tiff type ${type}`)
		}
	}

	// FLIR file header (ref 3)
	// 0x00 - 00 - string[4] file format ID = "FFF\0"
	// 0x04 - 04 - string[16] file creator: seen "\0","MTX IR\0","CAMCTRL\0"
	// 0x14 - 20 - int32u file format version = 100
	// 0x18 - 24 - int32u offset to record directory
	// 0x1c - 28 - int32u number of entries in record directory
	// 0x20 - 32 - int32u next free index ID = 2
	// 0x24 - 36 - int16u swap pattern = 0 (?)
	// 0x28 - 40 - int16u[7] spares
	// 0x34 - 52 - int32u[2] reserved
	// 0x3c - 60 - int32u checksum
	parseFlirFFFSegment() {
		// Cancel if the file doesn't contain the segment or if it's damaged.
		if (!this.ensureSegmentPosition('flir', findFlirFFF)) return

		let le = this.le
		let flir = {}

		const creator = toString(this.buffer, this.flirOffset + 4, this.flirOffset + 4 + 16, true)
		flir.creator = creator

		let version = getUint32(this.buffer, this.flirOffset + 20, le)
		// The version should lie in the 100's. If it doesn't we're reading with the wrong byte order.
		if (version < 100 || version >= 200) {
			le = !le
			version = getUint32(this.buffer, this.flirOffset + 20, le)
		}
		flir.version = version

		this.parseFlirFFFDirectory(flir, le)
		this.flir = flir
	}

    parseFlirFFFDirectory(flir, le) {
		let directoryOffset = getUint32(this.buffer, this.flirOffset + 24, le)
		directoryOffset += this.flirOffset

		const numberOfEntries = getUint32(this.buffer, this.flirOffset + 28, le)

		// Parse table
		// Every record is 32 bytes
		for (let i = 0; i < numberOfEntries; i += 1) {
			const recordOffset = directoryOffset + i * 32
			this.parseFlirFFFRecord(flir, recordOffset, le)
		}
	}

	// FLIR record entry (ref 3):
	// 0x00 - 00 - int16u record type
	// 0x02 - 02 - int16u record subtype: RawData 1=BE, 2=LE, 3=PNG; 1 for other record types
	// 0x04 - 04 - int32u record version: seen 0x64,0x66,0x67,0x68,0x6f,0x104
	// 0x08 - 08 - int32u index id = 1
	// 0x0c - 12 - int32u record offset from start of FLIR data
	// 0x10 - 16 - int32u record length
	// 0x14 - 20 - int32u parent = 0 (?)
	// 0x18 - 24 - int32u object number = 0 (?)
	// 0x1c - 28 - int32u checksum: 0 for no checksum
	parseFlirFFFRecord(flir, recordOffset, le) {
		const recordType = getUint16(this.buffer, recordOffset, le)
		const recordSubType = getUint16(this.buffer, recordOffset + 2, le)

        let recordLE = le
		if (recordType === 1) {
			if (recordSubType < 1 || recordSubType > 2) {
				return
			}
			recordLE = (recordSubType === 2)
		}

		let recordContentOffset = getUint32(this.buffer, recordOffset + 12, le)
		recordContentOffset += this.flirOffset

		this.parseFlirFFFRecordTags(flir, recordType, recordContentOffset, recordLE)
	}

	parseFlirFFFRecordTags(flir, recordType, recordContentOffset, le) {
	    if (!(recordType in tags.flir)) {
			return
		}

		const recordTagsInfo = tags.flir[recordType];

	    // TODO: What the fuck?!!
		if (recordType !== 1) {
			recordContentOffset += 120
		}

		// All records always use their first 2 bytes to check the LE again
		// If it's not equal to 2, we're using the wrong order.
		const byteOrder = getUint16(this.buffer, recordContentOffset, le)
		if (byteOrder !== 2) {
			le = !le
		}

		Object.entries(recordTagsInfo.tags).forEach(([relativeTagOffset, tagInfo]) => {
			relativeTagOffset = parseInt(relativeTagOffset)

			const tagOffset = recordContentOffset + relativeTagOffset
			const tagName = tagInfo.name
			const tagType = tagInfo.type;

			let value = null;
			if (tagType === 'uint8') {
				value = getUint8(this.buffer, tagOffset, le)
			} else if (tagType === 'uint16') {
				value = getUint16(this.buffer, tagOffset, le)
			} else if (tagType === 'uint32') {
				value = getUint32(this.buffer, tagOffset, le)
			} else if (tagType === 'int8') {
				value = getInt8(this.buffer, tagOffset, le)
			} else if (tagType === 'int16') {
				value = getInt16(this.buffer, tagOffset, le)
			} else if (tagType === 'int32') {
				value = getInt32(this.buffer, tagOffset, le)
			} else if (tagType === 'float32') {
				value = getFloat32(this.buffer, tagOffset, le)
			} else if (tagType === 'string') {
				const stringLength = tagInfo.length
				value = toString(this.buffer, tagOffset, tagOffset + stringLength, true)
			}

			flir[tagName] = value
		})
	}


	parseXmpSegment() {
		if (this.ensureSegmentPosition('xmp', findXmp)) {
		    // If there is an XMP segment, we can read it directly.
			this.xmp = toString(this.buffer, this.xmpOffset, this.xmpOffset + this.xmpEnd, false)
		} else if ((this.image || {}).ApplicationNotes || (this.exif || {}).ApplicationNotes) {
			// If the file doesn't contain the segment or if it's damaged, the XMP might be in ApplicationNotes.
			this.xmp = String.fromCharCode.apply(String, (this.image || {}).ApplicationNotes || (this.exif || {}).ApplicationNotes)
			delete this.image.ApplicationNotes
			delete this.exif.ApplicationNotes
		} else {
			return
		}

		// Trims the mess around.
		if (this.options.postProcess) {
			let start = this.xmp.indexOf('<x:xmpmeta')
			let end = this.xmp.indexOf('x:xmpmeta>') + 10
			this.xmp = this.xmp.slice(start, end)
			// offer user to supply custom xml parser
			if (this.options.xmpParser) this.xmp = this.options.xmpParser(this.xmp)
		}
	}


	// Not currently implemented.
	parseIccSegment() {
	}

	// NOTE: This only works with single segment IPTC data.
	// TODO: Implement multi-segment parsing.
	parseIptcSegment() {
		// Cancel if the file doesn't contain the segment or if it's damaged.
		if (!this.ensureSegmentPosition('iptc', findIptc)) return

		// Parse each value in the buffer into key:value pair.
		this.iptc = {}
		var offset = this.iptcOffset
		for (var offset = 0; offset < this.iptcEnd; offset++) {
			if (getUint8(this.buffer, offset) === 0x1C && getUint8(this.buffer, offset + 1) === 0x02) {
				let size = getInt16(this.buffer, offset + 3)
				let tag = getUint8(this.buffer, offset + 2)
				let key = tags.iptc[tag] || tag
				let val = toString(this.buffer, offset + 5, offset + 5 + size)
				this.iptc[key] = setValueOrArrayOfValues(val, this.iptc[key])
			}
		}
	}

	ensureSegmentPosition(name, finder, requireEnd = true) {
		var OFFSET = name + 'Offset'
		var END = name + 'End'
		if (this[OFFSET] === undefined || (requireEnd && this[END] === undefined)) {
			let position = finder(this.buffer/*, this.baseOffset*/)
			if (position === undefined) return false
			this[OFFSET] = position.start
			this[END]    = position.end
		}
		// Cancel if the file doesn't contain the segment or if it's damaged.
		if (this[OFFSET] === undefined || (requireEnd && this[END] === undefined)) return false
		// Otherwise we're good to go
		return true
	}

}


// Converts date string to Date instances, replaces enums with string descriptions
// and fixes values that are incorrectly treated as buffers.
function translateValue(key, val) {
	if (val === undefined || val === null)
		return undefined
	if (tags.dates.includes(key))
		return reviveDate(val)
	if (key === 'SceneType')
		return Array.from(val).map(v => tags.valueString.SceneType[v]).join(', ')
	if (key === 'ComponentsConfiguration')
		return Array.from(val).map(v => tags.valueString.Components[v]).join(', ')
	if (tags.valueString[key] !== undefined)
		return tags.valueString[key][val] || val
	if (key === 'FlashpixVersion' || key === 'ExifVersion')
		return toString(val)
	if (key === 'GPSVersionID')
		return Array.from(val).join('.')
	if (key === 'GPSTimeStamp')
		return Array.from(val).join(':')
	return val
}

function reviveDate(string) {
	if (typeof string !== 'string' || string.length == 0)
		return null
	string = string.trim()
	var [dateString, timeString] = string.split(' ')
	var [year, month, day] = dateString.split(/[:\.]/).map(Number)
    if (day > 1900) [year, day] = [day, year]
	var date = new Date(Date.UTC(year, month - 1, day))
	if (timeString) {
		var [hours, minutes, seconds] = timeString.split(':').map(Number)
		date.setUTCHours(hours)
		date.setUTCMinutes(minutes)
		date.setUTCSeconds(seconds)
	}
	const isoString = date.toISOString()
	// Drop everything starting from the ., removing the milliseconds and the timezone
	return isoString.substring(0, isoString.indexOf('.'))
}

function setValueOrArrayOfValues(newValue, existingValue) {
	if (existingValue !== undefined) {
		if (existingValue instanceof Array) {
			existingValue.push(newValue)
			return existingValue
		} else {
			return [existingValue, newValue]
		}
	} else {
		return newValue
	}
}

function ConvertDMSToDD(degrees, minutes, seconds, direction) {
	var dd = degrees + (minutes / 60) + (seconds / (60*60))
	// Don't do anything for N or E
	if (direction == 'S' || direction == 'W')
		dd *= -1
	return dd
}
