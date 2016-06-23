#!/usr/bin/env node
'use strict';

/**
 * share-cli
 * Quickly share files from command line to your local network
 * Author: Mario Nebl <https://github.com/marionebl>
 * License: MIT
 */
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const url = require('url');
const util = require('util');

const copyPaste = require('copy-paste');
const chalk = require('chalk');
const fp = require('lodash/fp');
const meow = require('meow');
const mime = require('mime');
const portscanner = require('portscanner');
const generate = require('project-name-generator');

const log = util.debuglog('share-cli');

const cli = meow(`
	Usage
		$ share [file]

	Options
		-n, --name Forced download name of the file

	Examples
		$ share shared.png
		http://192.168.1.1:1337/unequal-wish

		$ cat shared.png | share --name=shared.png
		http://192.168.1.1:1337/important-downtown
`, {
	alias: {
		n: 'name'
	}
});

let __timer = null;
const stdin = process.stdin;

// Kill process after 5 minutes of inactivity
function resetTimer() {
	log('Reseting activitiy timer');
	killTimer();
	setTimer();
}

function setTimer() {
	log('Setting activitiy timer, timing out after 5 minutes');
	__timer = setTimeout(() => {
		log('Timeout without after 5 minutes without activitiy, killing process');
		process.exit(0);
	}, 300000);
}

function killTimer() {
	if (__timer) {
		clearTimeout(__timer);
	}
}

/**
 * Copy input to clipboard
 * @param  {String} input
 * @return {Promise<String>}
 */
function copy(input) {
	return new Promise((resolve, reject) => {
		copyPaste.copy(`${input}\r\n`, (error) => {
			if (error) {
				return reject(error);
			}
			resolve(input);
		});
	});
}

/**
 * Check if an ip adress is external
 *
 * @return {Boolean}
 */
function isExternalAddress(networkInterface) {
	return networkInterface.family === 'IPv4' &&
		networkInterface.internal === false;
}

/**
 * Get the local ip addresses
 *
 * @return {Object[]}
 */
function getAdresses() {
	return fp.flatten(fp.values(os.networkInterfaces()));
}

/**
 * Get the local ip address
 *
 * @return {String}
 */
function getLocalAddress() {
	const found = fp.find(isExternalAddress)(getAdresses());
	return found ? found.address : 'localhost';
}

/**
 * Get an open port on localhost
 *
 * @return {Promise<Number>}
 */
function getOpenPort() {
	return new Promise((resolve, reject) => {
		portscanner.findAPortNotInUse(1337, 65535, '127.0.0.1', (error, port) => {
			if (error) {
				return reject(error);
			}
			resolve(port);
		});
	});
}

/**
 * Get a file object
 *
 * @param {Object} options
 * @param {Boolean} options.isStdin - If the input is given via stdin
 * @param {String} [options.filePath] - Absolute path of file to read
 * @param {String} [options.fileName] - Basename of file to read, defaults to path.basename(option.filePath)
 *
 * @return {Promise<File>}
 */
function getFile(options) {
	return new Promise((resolve, reject) => {
		const stream = options.isStdin ?
			stdin : fs.createReadStream(options.filePath);

		const name = options.isStdin ?
			options.fileName : path.basename(options.filePath);

		if (options.isStdin) {
			return resolve({
				stream,
				name,
				size: null,
				ino: null,
				mtime: null
			});
		}

		fs.stat(options.filePath, (error, stat) => {
			if (error) {
				return reject(error);
			}
			resolve({
				stream,
				name,
				size: stat.size,
				ino: stat.ino,
				mtime: Date.parse(stat.mtime)
			});
		});
	});
}

/**
 * Serve a File object on address with port on path id
 *
 * @param {Object} options
 * @param {File} options.file
 * @param {Number} options.port
 * @param {String} options.address
 * @param {String} options.id
 * @return {Promise<Object>} - started server instance
 */
function serve(options) {
	return new Promise((resolve, reject) => {
		const file = options.file;

		const server = http.createServer((request, response) => {
			const id = url.parse(request.url).path
				.split('/')
				.filter(Boolean)[0];

			// Only HEAD and GET are allowed
			if (['GET', 'HEAD'].indexOf(request.method) === -1) {
				response.writeHead(405);
				return response.end('Method not Allowed.');
			}

			if (id !== options.id) {
				response.writeHead(404);
				return response.end('Not found');
			}

			resetTimer();
			const downloadName = file.name || options.id;
			response.setHeader('Content-Type', mime.lookup(downloadName));

			if (file.size) {
				response.setHeader('Content-Length', file.size);
			}

			// Do not send a body for HEAD requests
			if (request.method === 'HEAD') {
				response.setHeader('Connection', 'close');
				return response.end();
			}

			response.setHeader('Content-Disposition', `attachment; filename=${downloadName}`);

			file.stream.on('data', () => {
				resetTimer();
			});

			file.stream.pipe(response)
				.on('finish', () => {
					log('Download completed, killing process');
					// Kill the process when download completed
					process.exit(0);
				});
		});

		server.on('error', reject);

		server.listen(options.port, () => {
			resolve(server);
		});
	});
}

/**
 * Serve a File object on an open port
 *
 * @param {File} file
 * @return {Promise<String>} - shareable address
 */
function serveFile(file) {
	return getOpenPort()
		.then(port => {
			const address = getLocalAddress();
			const id = generate().dashed;
			const options = {
				address,
				port,
				id,
				file
			};

			return serve(options)
				.then(() => `http://${options.address}:${options.port}/${options.id}`)
				.then(url => copy(`${url}`));
		});
}

/**
 * Execute share-cli main procedure
 *
 * @param {String[]} input - non-flag arguments
 * @param {Object} args - flag arguments
 * @return {Promise<String>} - shareable address
 */
function main(filePath, args) {
	return new Promise((resolve, reject) => {
		// Start the inactivity timer
		setTimer();

		// Sanitize input
		if (stdin.isTTY && typeof filePath === 'undefined') {
			const error = new Error('Either stdin or [file] have to be given');
			error.cli = true;
			return reject(error);
		}

		const isStdin = stdin.isTTY !== true && typeof filePath === 'undefined';

		// Get a file object
		const gettingFile = getFile({
			isStdin,
			filePath,
			fileName: args.name
		});

		gettingFile
			.then(serveFile)
			.then(resolve)
			.catch(reject);
	});
}

main(cli.input[0], cli.flags)
	.then(output => {
		if (output) {
			console.log(output);
		}
	})
	.catch(error => {
		if (error.cli) {
			if (error.message) {
				console.error(chalk.red(error.message));
			}
			cli.showHelp(1);
		}

		setTimeout(() => {
			throw error;
		});
	});

/**
 * @typedef {Object} File
 * @property {Stream} File.stream - Readstream of the file
 * @property {String} File.name - Basename of the file
 */
