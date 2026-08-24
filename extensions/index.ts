import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { appendFileSync } from "node:fs";

const ASK_USER_TOOL = "ask_user_question";
const MAX_MESSAGE_LENGTH = 180;

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

export default function ghosttyNotify(pi: ExtensionAPI): void {
	pi.on("agent_settled", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		notify("✅ Pi 已完成，等待你的输入");
	});

	pi.on("tool_call", (event, ctx) => {
		if (!ctx.hasUI || event.toolName !== ASK_USER_TOOL) return;
		notify(`❓ Pi 需要输入：${questionSummary(event.input)}`);
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
