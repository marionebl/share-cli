// @ts-check
const fs = require("fs");
const util = require("util");
const execa = require("execa");
const streamToBuffer = require("stream-to-buffer");
const tempy = require("tempy");
const Path = require("path");

const stat = util.promisify(fs.stat);
const writeFile = util.promisify(fs.writeFile);
const toBuffer = util.promisify(streamToBuffer);

const getChecksum = require("./get-checksum").getChecksum;

/**
 * Get a file object
 * @typedef {{ isStdin: boolean, password: string, filePath: string, fileName: string }} GetFileOptions
 * @typedef {{path: string, size: number, checksum: string, password: string, name: string}} File
 *
 * @param {GetFileOptions} options
 *
 * @return {Promise<File | Error>}
 */
module.exports.getFile = async function getFile(options) {
	try {
		const filePath = options.isStdin ? tempy.file() : options.filePath;

		if (options.isStdin) {
			// @ts-ignore
			await writeFile(filePath, toBuffer(stdin));
		}

		const recursive = options.isStdin
			? false
			: (await stat(filePath)).isDirectory();

		const zip = `${tempy.file()}.zip`;

		await execa(
			"zip",
			["-P", options.password, recursive ? "-r" : "", zip, filePath].filter(
				Boolean
			)
		);

		const size = (await stat(zip)).size;
		const checksum = await getChecksum("sha1", zip);

		return {
			path: zip,
			size,
			checksum,
			password: options.password,
			name: Path.basename(zip)
		};
	} catch (err) {
		return err;
	}
};
