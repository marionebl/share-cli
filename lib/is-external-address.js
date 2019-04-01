// @ts-check

/**
 * Check if an ip adress is external
 * @typedef {{ family: 'IPv4' | 'IPv6', internal: boolean, address: string }} NetworkInterface

 * @param {NetworkInterface} networkInterface
 * @return {Boolean}
 */
module.exports.isExternalAddress = function isExternalAddress(networkInterface) {
	return networkInterface.family === 'IPv4' &&
		networkInterface.internal === false;
}
