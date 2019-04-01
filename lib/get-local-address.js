// @ts-check
const fp = require("lodash/fp");
const getAdresses = require("./get-addresses").getAdresses;
const isExternalAddress = require("./is-external-address").isExternalAddress;

/**
 * Get the local ip address
 *
 * @return {String}
 */
module.exports.getLocalAddress = function getLocalAddress() {
	const found = fp.find(isExternalAddress)(getAdresses());
	return found ? found.address : "localhost";
};
