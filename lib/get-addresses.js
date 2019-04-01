// @ts-check
const os = require('os');
const fp = require('lodash/fp');

/**
 * Get the local ip addresses
 * @typedef {{ family: 'IPv4' | 'IPv6', internal: boolean, address: string }} NetworkInterface
 *
 * @return {NetworkInterface[]}
 */
module.exports.getAdresses = function getAdresses() {
	return fp.flatten(fp.values(os.networkInterfaces()));
}
