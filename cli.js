#!/usr/bin/env node
// @ts-check
"use strict";

/**
 * share-cli
 * Quickly share files from command line to your local network
 * Author: Mario Nebl <https://github.com/marionebl>
 * License: MIT
 */
const crypto = require("crypto");
const chalk = require("chalk");
const meow = require("meow");
const Ink = require("ink");
const React = require("react");
const html = require("htm").bind(React.createElement);
const Provider = require("unstated").Provider;
const Subscribe = require("unstated").Subscribe;

const getFile = require("./lib/get-file").getFile;
const serveFile = require("./lib/serve-file").serveFile;
const UI = require("./lib/ui").UI;
const State = require("./lib/state").State;

const cli = meow(
	`
	Usage
		$ share [file]

	Options
		-n, --name Forced download name of the file

	Examples
		$ share shared.png
		http://192.168.1.1:1337/unequal-wish

		$ cat shared.png | share --name=shared.png
		http://192.168.1.1:1337/important-downtown
`,
	{
		// @ts-ignore
		alias: {
			n: "name"
		}
	}
);

const stdin = process.stdin;

/**
 * Execute share-cli main procedure
 *
 * @param {string} filePath - non-flag arguments
 * @param {Object<string, any>} args - flag arguments
 * @return {Promise<void | Error>} - shareable address
 */
async function main(filePath, args) {
	// Sanitize input
	if (stdin.isTTY && typeof filePath === "undefined") {
		const error = new Error("Either stdin or [file] have to be given");
		// @ts-ignore
		error.cli = true;
		return error;
	}

	const state = new State();

	const tree = html`
		<${Provider} inject=${[state]}>
			<${Subscribe} to=${[State]}>
				${({state}) => html`<${UI} state=${state}/>`}
			</${Subscribe}>
		</${Provider}>
	`;

	const app = Ink.render(tree);

	const isStdin = stdin.isTTY !== true && typeof filePath === "undefined";

	state.setFilePhase('started', 'Preparing file');

	// Get a file object
	const fileResult = await getFile({
		fileName: args.name,
		filePath,
		isStdin,
		password:
			args.password ||
			encodeURIComponent(crypto.randomBytes(24).toString("hex"))
	});

	if (fileResult instanceof Error) {
		state.setFilePhase('errored', 'Preparing file failed');
		return fileResult;
	}

	state.setFilePhase('done', 'Prepared file');

	const connectionResult = await serveFile(fileResult, {
		tunnel: args.tunnel !== false,
		state
	});

	if (connectionResult instanceof Error) {
		return connectionResult;
	}

	state.subscribe(() => {
		if (state.state.shutdown === true) {
			process.nextTick(() => {
				app.unmount();
				process.exit(0);
			});

			return;
		}

		// TODO: Remodel using phases?
		if (state.state.wait === true && !state.state.waiting) {
			state.setWaiting(true);

			const closeTime = Date.now() + 60 * 1000;

			const timer = setInterval(() => {
				state.trigger();

				if (closeTime - Date.now() <= 0) {
					process.exit(0);
				}
			}, 1000);

			process.stdin.setRawMode(true);

			const onData = data => {
				switch (data.toString()) {
					case '\u0003':
					case '\u0004':
						state.shutdown();
						return;
					case '\u0012':
						clearInterval(timer);
						process.stdin.setRawMode(false);
						process.stdin.off('data', onData);
						state.keep();
						return;
				}
			}

			process.stdin.on('data', onData);
		}
	});

	return;
}

main(cli.input[0], cli.flags)
	.then(result => {
		if (result instanceof Error) {
			// @ts-ignore
			console.error(chalk.red(result.message));
		}
	})
	.catch(error => {
		if (error.cli) {
			if (error.message) {
				// @ts-ignore
				console.error(chalk.red(error.message));
			}
			cli.showHelp(1);
		}

		setTimeout(() => {
			throw error;
		});
	});
