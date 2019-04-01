// @ts-check
const React = require("react");
const Ink = require("ink");
const symbols = require("log-symbols");

const html = require("htm").bind(React.createElement);

// @ts-ignore
const Spinner = require("ink-spinner").default;

/**
 * @typedef {'pending' | 'started' | 'errored' | 'done'} Phase
 * @typedef {{ phase: Phase, label: string }} StepState
 * @typedef {{ wait: boolean, shutdown: boolean, closeTime: number, downloads: number, download: StepState, clipboard: StepState, file: StepState, server: StepState, tunnel: StepState; details: { checksum: string; url: string; password: string } }} UiState
 * @typedef {{ state: UiState }} UiProps
 *
 * @param {UiProps} props
 */
module.exports.UI = function UI(props) {
	const { clipboard, file, server, tunnel, download, details, downloads, closeTime, wait } = props.state;

	return html`
		<div>
			<${Step} state="${file.phase}">${file.label}</${Step}>
			<${Step} state="${server.phase}">${server.label}</${Step}>
			<${Step} state="${tunnel.phase}">${tunnel.label}</${Step}>
			<${Step} state="${clipboard.phase}">${clipboard.label}</${Step}>
			<${Step} state="${download.phase}">${
				(['done', 'errored', 'started'].includes(download.phase) && downloads > 0)
					? `Downloads: ${downloads}`
					: download.label}
			</${Step}>

			<${Ink.Box} paddingTop=${1}/>

			${(props.state.details && !props.state.wait && !props.state.shutdown) &&
				html`
				<div>
					<${Ink.Box}>Download details:</${Ink.Box}>
					<${Ink.Box}>- URL:      ${details.url}</${Ink.Box}>
					<${Ink.Box}>- SHA1:     ${details.checksum}</${Ink.Box}>
					<${Ink.Box}>- Password: ${details.password}</${Ink.Box}>
				</div>
				`
			}

			${(props.state.wait && !props.state.shutdown) &&
				html`
				<div>
					<${Ink.Box}>Closing in ${Math.max(Math.round((closeTime - Date.now()) / 1000), 0)}s</${Ink.Box}>
					<${Ink.Box}>Ctrl+C to close now</${Ink.Box}>
					<${Ink.Box}>Ctrl+R to allow more downloads</${Ink.Box}>
				</div>
				`
			}

			${(props.state.shutdown) &&
				html`Closing share-cli`
			}
		</div>
	`;
};

/**
 * @param {{ state: 'pending' | 'started' | 'errored' | 'done', children: React.ReactChildren }} props
 */
function Step(props) {
	return html`
		<${Ink.Box}>
			<${Ink.Box} flexShrink=${0} flexGrow=${0}>
				<${PhaseSymbol} state="${props.state}"/>${" "}
			</${Ink.Box}>
			<${Ink.Box}>
				${
					props.state === "pending"
						? html`<${Ink.Color} keyword="grey">${props.children}</${Ink.Color}>`
						: props.children
				}
			</${Ink.Box}>
		</${Ink.Box}>
	`;
}

/**
 * @param {{ state: 'pending' | 'started' | 'errored' | 'done' }} props
 */
function PhaseSymbol(props) {
	switch (props.state) {
		case "pending":
			return ' ';
		case "started":
			return html`<${Spinner} type="dots"/>`;
		case "errored":
			return html`<${Ink.Color} keyword="red">${symbols.error}</${Ink.Color}>`;
		case "done":
			return html`<${Ink.Color} keyword="green">${symbols.success}</${
				Ink.Color
			}>`;
	}
}
