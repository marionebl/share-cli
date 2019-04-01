// @ts-check
const localtunnel = require('localtunnel');

/**
 * @param {number} port
 * @param {any} options
 * @return {Promise<any>}
 */
module.exports.tunnel = function tunnel(port, options) {
	return new Promise((resolve, reject) => {
		localtunnel(port, options, (error, connection) => {
			if (error) {
				return reject(error);
			}
			resolve(connection);
		});
	});
}
