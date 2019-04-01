// @ts-check
const tunnel = require("./tunnel").tunnel;

/**
 * Open a tunnel to localtunnel.me
 *
 * @param {{ subdomain: string; port: number }} options
 * @return {Promise<Error | any>}
 */
module.exports.openTunnel = async function openTunnel(options, tries = 5) {
	return tunnel(options.port, { subdomain: options.subdomain })
		.then(connection => {
			return new Promise(resolve => {
				connection.on('url', () => resolve(connection));
				connection.on('error', error => resolve(error));
			})
		})
		.then(result => {
			if (result instanceof Error && tries > 0) {
				return openTunnel(options, --tries);
			}

			return result;
		});
}
