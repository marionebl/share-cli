// @ts-check
const generate = require("project-name-generator");
const getOpenPort = require("./get-open-port").getOpenPort;
const getLocalAddress = require("./get-local-address").getLocalAddress;
const copy = require("./pbpaste").copy;
const serve = require("./serve").serve;

/**
 * Serve a File object on an open port
 * @typedef {{ url: string, on(event: string, cb: function): void, close(): void }} Connection
 *
 * @param {{ checksum: string, password: string, size: number, name: string, path: string }} file
 * @param {{ tunnel: any, state: any }} flags
 * @return {Promise<Connection | Error>}
 */
module.exports.serveFile = async function serveFile(file, flags) {
	const { state } = flags;

	state.setServerPhase('started', 'Starting server');

	const portResult = await getOpenPort();

	if (portResult instanceof Error) {
		state.setServerPhase('errored', 'Starting server failed, failed allocating free port');
		return portResult;
	}

	const address = getLocalAddress();
	const id = generate().dashed;
	const subdomain = id
		.split("-")
		.join("")
		.slice(0, 20);

	const options = {
		address,
		file,
		id,
		port: portResult,
		subdomain,
		state,
		tunnel: flags.tunnel
	};

	const connectionResult = await serve(options);

	if (connectionResult instanceof Error) {
		return connectionResult;
	}

	state.setCopyPhase('started', 'Copying to clipboard');
	const copyResult = await copy(connectionResult.url);

	if (copyResult instanceof Error) {
		state.setCopyPhase('errored', 'Copying to clipboard failed');
	}

	state.setCopyPhase('done', 'Copied to clipboard');

	state.setDetails({
		url: connectionResult.url,
		checksum: file.checksum,
		password: file.password
	});

	// @ts-ignore
	return connectionResult;
};
