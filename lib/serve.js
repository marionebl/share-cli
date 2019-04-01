// @ts-check
const fs = require("fs");
const http = require("http");
const url = require("url");
const EventEmitter = require("events").EventEmitter;
const progressStream = require("progress-stream");
const openTunnel = require("./open-tunnel").openTunnel;

/**
 * Serve a File object on address with port on path id
 * @typedef {{ name: string, size: number, path: string }} File
 * @typedef {function} Tunnel
 * @typedef {{ file: File, port: number, address: string, id: string, tunnel: boolean, subdomain: string, state: any }} ServeOptions
 * @typedef {{ once(): void, on(): void, url: string; close(): void, tunnel?: any; }} Connection
 *
 * @param {ServeOptions} options
 * @return {Promise<Connection | Error>} - started server instance
 */
module.exports.serve = function serve(options) {
	const file = options.file;
	const state = options.state;

	state.setServerPhase("started", "Starting server");

	const emitter = new EventEmitter();

	let connection;

	const connect = options.tunnel
		? async () => {
				const c = await openTunnel({
					port: options.port,
					subdomain: options.subdomain
				});

				if (c instanceof Error) {
					return c;
				}

				return {
					once: emitter.once.bind(emitter),
					on: emitter.on.bind(emitter),
					url: c.url,
					close: c.close.bind(c),
					tunnel: c
				};
		  }
		: async () => ({
				once: emitter.once.bind(emitter),
				on: emitter.on.bind(emitter),
				url: `http://${options.address}:${options.port}/${options.id}`,
				close: () => {}
		  });

	return new Promise(resolve => {
		const server = http.createServer((request, response) => {
			const id = url
				.parse(request.url)
				.path.split("/")
				.filter(Boolean)[0];

			if (request.headers["user-agent"].includes("facebookexternalhit")) {
				response.writeHead(404);
				return response.end("Not found");
			}

			// Only HEAD and GET are allowed
			if (["GET", "HEAD"].indexOf(request.method) === -1) {
				response.writeHead(405);
				return response.end("Method not Allowed.");
			}

			const matches = options.tunnel ? true : id === options.id;

			if (!matches) {
				response.writeHead(404);
				return response.end("Not found");
			}

			response.writeHead(200, {
				"Content-Disposition": `attachment;filename=${file.name ||
					options.id}.zip`,
				"Content-Length": file.size,
				"Content-Type": "application/zip"
			});

			// Do not send a body for HEAD requests
			if (request.method === "HEAD") {
				response.setHeader("Connection", "close");
				return response.end();
			}

			state.setDownloadPhase("started", "Downloading");
			const stream = fs.createReadStream(file.path);

			stream.pipe(response);

			request.on("end", () => {
				state.incrementDownloads();
				state.setDownloadPhase("done", "Downloaded");
				state.wait(60 * 1000);
			});
		});

		server.on("error", err => {
			state.setServerPhase("errored", "Starting server failed");
			resolve(err);
		});

		server.listen(options.port, async () => {
			state.setServerPhase("done", "Server started");

			try {
				state.setTunnelPhase("started", "Opening tunnel");
				connection = await connect();
				state.setTunnelPhase("done", "Tunnel opened");

				state.setDownloadPhase("pending", "Awaiting download");
				resolve(connection);
			} catch (err) {
				state.setTunnelPhase("errored");
				resolve(err);
			}
		});
	});
};
