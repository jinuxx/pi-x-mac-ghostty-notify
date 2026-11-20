# Changelog

## 0.2.0

- 提醒内容增加本地时间前缀，如 `[15:42]`
- 后台 subagent 仍在运行时不发“已完成”提醒，等子任务完成、会话真正结束后再提醒
- 覆盖所有阻塞式扩展 UI 询问（`confirm` / `select` / `input` / `editor` / `custom`），不再漏掉授权确认框
- `ask_user_question` 与阻塞式询问去重，同一问题不会发两条提醒

## 0.1.0

- 初始版本：对话结束与 `ask_user_question` 的 Ghostty OSC 9 提醒
- `/notify [内容]` 手动发送测试提醒
