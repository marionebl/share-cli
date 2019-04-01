// @ts-check
const portscanner = require('portscanner');

/**
 * Get an open port on localhost
 *
 * @return {Promise<Error | Number>}
 */
module.exports.getOpenPort = function getOpenPort() {
	return new Promise((resolve, reject) => {
		portscanner.findAPortNotInUse(1337, 65535, '127.0.0.1', (error, port) => {
			if (error) {
				return resolve(error);
			}
			resolve(port);
		});
	});
}
