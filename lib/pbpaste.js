// @ts-check
const copyPaste = require('copy-paste');

/**
 * Copy input to clipboard
 * @param  {string} input
 * @return {Promise<string | Error>}
 */
module.exports.copy = function copy(input) {
	return new Promise(resolve => {
		copyPaste.copy(`${input}\r\n`, (error) => {
			if (error) {
				return resolve(error);
			}
			resolve(input);
		});
	});
}
