// @ts-check
const fs = require("fs");
const crypto = require('crypto');

/**
 * @param {string} hashName
 * @param {string} path
 *
 * @return {Promise<string>}
 */
module.exports.getChecksum = function getChecksum(hashName, path) {
	return new Promise((resolve, reject) => {
		let hash = crypto.createHash(hashName);
		let stream = fs.createReadStream(path);
		stream.on("error", err => reject(err));
		stream.on("data", chunk => hash.update(chunk));
		stream.on("end", () => resolve(hash.digest("hex")));
	});
};
