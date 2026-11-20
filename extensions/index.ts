import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";

const ASK_USER_TOOL = "ask_user_question";
const MAX_MESSAGE_LENGTH = 180;
const PROMPT_KIND_LABELS: Record<string, string> = {
	select: "选择",
	confirm: "确认",
	input: "输入",
	editor: "编辑",
	custom: "操作",
};
const SUBAGENT_RPC_REQUEST_EVENT = "subagents:rpc:v1:request";
const SUBAGENT_RPC_REPLY_PREFIX = "subagents:rpc:v1:reply:";
const SUBAGENT_PING_TIMEOUT_MS = 500;
const SUBAGENT_STATUS_TIMEOUT_MS = 1_500;

function isGhosttyMac(): boolean {
	return (
		process.platform === "darwin" &&
		(process.env.TERM_PROGRAM === "ghostty" || process.env.TERM?.includes("ghostty") === true || Boolean(process.env.GHOSTTY_RESOURCES_DIR))
	);
}

function clean(value: string): string {
	return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(value: string): string {
	if (value.length <= MAX_MESSAGE_LENGTH) return value;
	return `${value.slice(0, MAX_MESSAGE_LENGTH - 1).trimEnd()}…`;
}

function timeLabel(date = new Date()): string {
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function sendOsc9(message: string): void {
	const sequence = `\u001b]9;${truncate(clean(message))}\u001b\\`;
	try {
		appendFileSync("/dev/tty", sequence);
		return;
	} catch {}

	if (process.stdout.isTTY) process.stdout.write(sequence);
}

function notify(message: string): void {
	if (isGhosttyMac()) sendOsc9(message);
}

function questionSummary(input: unknown): string {
	if (!input || typeof input !== "object") return "Pi 正在等待你的输入";

	const questions = (input as { questions?: unknown }).questions;
	if (!Array.isArray(questions) || questions.length === 0) return "Pi 正在等待你的输入";
	if (questions.length > 1) return `${questions.length} 个问题需要回答`;

	const question = questions[0];
	if (question && typeof question === "object" && typeof (question as { question?: unknown }).question === "string") {
		return clean((question as { question: string }).question);
	}
	return "Pi 正在等待你的输入";
}

function record(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	return value as Record<string, unknown>;
}

function subagentRpc(pi: ExtensionAPI, method: string, timeoutMs: number): Promise<Record<string, unknown> | undefined> {
	const requestId = randomUUID();
	return new Promise((resolve) => {
		let unsubscribe = (): void => {};
		const finish = (data: Record<string, unknown> | undefined): void => {
			clearTimeout(timer);
			unsubscribe();
			resolve(data);
		};
		const timer = setTimeout(() => finish(undefined), timeoutMs);
		unsubscribe = pi.events.on(`${SUBAGENT_RPC_REPLY_PREFIX}${requestId}`, (reply) => {
			const answer = record(reply);
			finish(answer?.success === true ? record(answer.data) : undefined);
		});
		pi.events.emit(SUBAGENT_RPC_REQUEST_EVENT, { version: 1, requestId, method, params: {} });
	});
}

function promptSummary(kind: string, title: string | undefined): string {
	const label = PROMPT_KIND_LABELS[kind] ?? "操作";
	const heading = title ? clean(title) : "";
	return heading ? `Pi 需要你${label}：${heading}` : `Pi 需要你${label}`;
}

export default function ghosttyNotify(pi: ExtensionAPI): void {
	let subagentsProbed = false;
	let subagentsReady = false;
	let askUserPending = 0;

	const hasSubagents = async (): Promise<boolean> => {
		if (subagentsProbed) return subagentsReady;
		subagentsProbed = true;
		const data = await subagentRpc(pi, "ping", SUBAGENT_PING_TIMEOUT_MS);
		const methods = data?.methods;
		subagentsReady = Array.isArray(methods) && methods.includes("status");
		return subagentsReady;
	};

	const backgroundWorkActive = async (): Promise<boolean> => {
		if (!(await hasSubagents())) return false;
		const data = await subagentRpc(pi, "status", SUBAGENT_STATUS_TIMEOUT_MS);
		if (!data) return false;
		const fleet = record(data.fleet);
		const totalActive = fleet?.totalActive;
		return typeof totalActive === "number" && totalActive > 0;
	};

	pi.on("agent_settled", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		if (await backgroundWorkActive()) return;
		notify(`[${timeLabel()}] ✅ Pi 已完成，等待你的输入`);
	});

	pi.on("tool_call", (event, ctx) => {
		if (!ctx.hasUI || event.toolName !== ASK_USER_TOOL) return;
		askUserPending += 1;
		notify(`[${timeLabel()}] ❓ Pi 需要输入：${questionSummary(event.input)}`);
	});

	pi.on("tool_result", (event) => {
		if (event.toolName !== ASK_USER_TOOL) return;
		askUserPending = Math.max(0, askUserPending - 1);
	});

	pi.on("ui_prompt_start", (event, ctx) => {
		if (!ctx.hasUI || askUserPending > 0) return;
		notify(`[${timeLabel()}] ⏸ ${promptSummary(event.kind, event.title)}`);
	});

	pi.on("ui_prompt_end", () => {
		askUserPending = 0;
	});

	pi.registerCommand("notify", {
		description: "发送 Ghostty 原生 OSC 9 测试提醒",
		handler: async (args, ctx) => {
			if (!isGhosttyMac()) {
				ctx.ui.notify("此插件仅支持 macOS Ghostty", "warning");
				return;
			}
			notify(args.trim() || "Pi 通知测试");
		},
	});
}
