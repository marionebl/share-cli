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
const crypto = require('crypto');
const EventEmitter = require('events').EventEmitter;

const stat = util.promisify(fs.stat);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const randomBytes = util.promisify(crypto.randomBytes);

const chalk = require('chalk');
const copyPaste = require('copy-paste');
const execa = require('execa');
const fp = require('lodash/fp');
const generate = require('project-name-generator');
const globby = require('globby');
const localtunnel = require('localtunnel');
const meow = require('meow');
const mime = require('mime');
const portscanner = require('portscanner');
const streamToBuffer = require('stream-to-buffer');
const tempy = require("tempy");
const progressStream = require("progress-stream");
const ora = require("ora");
const progressString = require("progress-string");

const toBuffer = util.promisify(streamToBuffer);
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

const stdin = process.stdin;

/**
 * Copy input to clipboard
 * @param  {String} input
 * @return {Promise<String>}
 */
function copy(input) {
	return new Promise((resolve, reject) => {
		copyPaste.copy(`${input}\r\n`, (error) => {
			if (error) {
				console.warn(`Failed adding url to clipboard: ${error.message}`);
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
async function getFile(options) {
	options.spinner.text = "Preparing file";
	const filePath = options.isStdin ? tempy.file() : options.filePath;

	if (options.isStdin) {
		await writeFile(filePath, toBuffer(stdin));
	}

	const recursive = options.isStdin
		? false
		: (await stat(filePath)).isDirectory();

	const zip = `${tempy.file()}.zip`;

	await execa('zip', [
		'-P', options.password,
		recursive ? '-r' : '',
		zip,
		filePath
	].filter(Boolean));

	const size = (await stat(zip)).size;
	const checksum = await getChecksum('sha1', zip);

	options.spinner.succeed("Prepared file");
	return {
		path: zip,
		size,
		checksum,
		password: options.password,
	};
}

function getChecksum(hashName, path) {
	return new Promise((resolve, reject) => {
	  let hash = crypto.createHash(hashName);
	  let stream = fs.createReadStream(path);
	  stream.on('error', err => reject(err));
	  stream.on('data', chunk => hash.update(chunk));
	  stream.on('end', () => resolve(hash.digest('hex')));
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
	options.spinner.text = "Starting server";

	const file = options.file;

	const emitter = new EventEmitter();

	let connection;
	let sent;

	const connect = options.tunnel
		? async () => {
			options.spinner.text = `Starting tunnel`;
			options.spinner.start();

			const c = await tunnel(options.port, {subdomain: options.subdomain});
			options.spinner.succeed(`Started tunnel`);

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

	return new Promise((resolve, reject) => {
		const server = http.createServer((request, response) => {
			const id = url.parse(request.url).path
				.split('/')
				.filter(Boolean)[0];

			if (request.headers['user-agent'].includes('facebookexternalhit')) {
				response.writeHead(404);
				return response.end('Not found');
			}

			// Only HEAD and GET are allowed
			if (['GET', 'HEAD'].indexOf(request.method) === -1) {
				response.writeHead(405);
				return response.end('Method not Allowed.');
			}

			const matches = options.tunnel
				? true
				: id === options.id;

			if (!matches) {
				response.writeHead(404);
				return response.end('Not found');
			}

			response.writeHead(200, {
				'Content-Disposition': `attachment;filename=${file.name || options.id}.zip`,
				'Content-Length': file.size,
				'Content-Type': 'application/zip'
			});

			// Do not send a body for HEAD requests
			if (request.method === 'HEAD') {
				response.setHeader('Connection', 'close');
				return response.end();
			}

			emitter.emit('start');
			const stream = fs.createReadStream(file.path);

			let frame;

			const progress = progressStream({
				length: file.size,
				time: 100
			});

			progress.on('progress', p => {
				frame = p;
				emitter.emit('progress', p);
			});

			stream.on('end', () => {
				sent = true;
				emitter.emit('end')
			});

			stream
				.pipe(progress)
				.pipe(response);
		});

		server.on('error', reject);
		server.listen(options.port, async () => {
			options.spinner.succeed("Started server");

			try {
				connection = await connect();
				resolve(connection);
			} catch (err) {
				reject(err);
			}
		});
	});
}

/**
 * Serve a File object on an open port
 *
 * @param {File} file
 * @return {Promise<String>} - shareable address
 */
async function serveFile(file, flags) {
	const port = await getOpenPort();
	const address = getLocalAddress();
	const id = generate().dashed;
	const subdomain = id.split('-').join('').slice(0, 20);

	const options = {
		address,
		file,
		id,
		port,
		spinner: flags.spinner,
		subdomain,
		tunnel: flags.tunnel,
	};

	const connection = await serve(options);
	await copy(connection.url);

	connection.help = [
		' ',
		`Download details:`,
		` - URL:      ${connection.url}`,
		` - SHA1:     ${file.checksum}`,
		` - Password: ${file.password}`,
		' '
	];

	return connection;
}


function tunnel(port, options) {
	return new Promise((resolve, reject) => {
		localtunnel(port, options, (error, connection) => {
			if (error) {
				return reject(error);
			}
			resolve(connection);
		});
	});
}


/**
 * Execute share-cli main procedure
 *
 * @param {String[]} input - non-flag arguments
 * @param {Object} args - flag arguments
 * @return {Promise<String>} - shareable address
 */
async function main(filePath, args) {
	// Sanitize input
	if (stdin.isTTY && typeof filePath === 'undefined') {
		const error = new Error('Either stdin or [file] have to be given');
		error.cli = true;
		throw error;
	}

	const isStdin = stdin.isTTY !== true && typeof filePath === 'undefined';
	const spinner = ora().start();

	// Get a file object
	const file = await getFile({
		fileName: args.name,
		filePath,
		isStdin,
		password: args.password || encodeURIComponent((await randomBytes(48)).toString("hex")),
		spinner,
	});

	const connection = await serveFile(file, {
		spinner,
		tunnel: args.tunnel !== false
	});

	const progress = progressString({width: 50, total: 100});

	const help = `\n${connection.help.join('\n')}`;

	spinner.text = `Awaiting download${help}`;
	spinner.start();

	connection.on('start', () => {
		spinner.text = `Sending: [${progress(0)}] ${0}% ${help}`;
	});

	connection.on('progress', p => {
		const percentage = Math.round(Math.round(p.percentage * 100) / 100);

		if (percentage < 100) {
			spinner.text = `Sending: [${progress(percentage)}] ${percentage}% ${help}`;
		} else {
			spinner.text = `Waiting for receiver ${help}`;
		}
	});

	connection.on('end', () => {
		spinner.succeed(`Sent. End server with Ctrl+C. ${help}`);
	});
}

main(cli.input[0], cli.flags)
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
