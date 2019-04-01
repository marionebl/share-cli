// @ts-check
const Container = require("unstated").Container;

/**
 * @typedef {'pending'|'started'|'errored'|'done'} StatePhase
 */
module.exports.State = class State extends Container {
	constructor() {
		super();

		this.state = {
			file: {
				label: "Prepare",
				phase: "pending"
			},
			server: {
				label: "Server",
				phase: "pending"
			},
			tunnel: {
				label: "Tunnel",
				phase: "pending"
			},
			clipboard: {
				label: "Copy",
				phase: "pending"
			},
			downloads: 0,
			download: {
				label: "Download",
				phase: "pending"
			},
			details: undefined,
			closeTime: undefined,
			shutdown: false
		};
	}

	/**
	 *
	 * @param {StatePhase} phase
	 * @param {string} [label]
	 */
	setFilePhase(phase, label) {
		this.setState(state => ({
			...state,
			file: { ...state.file, phase, label: label || state.file.label }
		}));
	}

	/**
	 *
	 * @param {StatePhase} phase
	 * @param {string} [label]
	 */
	setServerPhase(phase, label) {
		this.setState(state => ({
			...state,
			server: { ...state.server, phase, label: label || state.server.label }
		}));
	}

	/**
	 *
	 * @param {StatePhase} phase
	 * @param {string} [label]
	 */
	setTunnelPhase(phase, label) {
		this.setState(state => ({
			...state,
			tunnel: { ...state.tunnel, phase, label: label || state.tunnel.label }
		}));
	}

	/**
	 *
	 * @param {StatePhase} phase
	 * @param {string} [label]
	 */
	setCopyPhase(phase, label) {
		this.setState(state => ({
			...state,
			clipboard: { ...state.clipboard, phase, label: label || state.clipboard.label }
		}));
	}

	/**
	 *
	 * @param {StatePhase} phase
	 * @param {string} [label]
	 */
	setDownloadPhase(phase, label) {
		this.setState(state => ({
			...state,
			download: { ...state.download, phase, label: label || state.download.label }
		}));
	}

	/**
	 *
	 * @param {{ checksum: string; password: string; url: string }} details
	 */
	setDetails(details) {
		this.setState(state => ({ ...state, details }));
	}

	incrementDownloads() {
		this.setState(state => ({ ...state, downloads: state.downloads + 1 }));
	}

	wait(offset) {
		this.setState(state => ({ ...state, closeTime: Date.now() + offset, wait: true }));
	}

	shutdown() {
		this.setState(state => ({ ...state, shutdown: true, wait: false, waiting: false }));
	}

	keep() {
		this.setState(state => ({ ...state, shutdown: false, wait: false, waiting: false }));
	}

	trigger() {
		this.setState(state => ({ ...state, now: Date.now() }));
	}

	setWaiting(waiting) {
		this.setState(state => ({ ...state, waiting }));
	}
};
