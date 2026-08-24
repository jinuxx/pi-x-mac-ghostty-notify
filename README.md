# pi-x-mac-ghostty-notify

仅用于 macOS + Ghostty 的 Pi 原生提醒插件。

## 功能

- Pi 对话结束、等待下一次输入时发送提醒
- `ask_user_question` 需要用户回答或选择时发送提醒
- `/notify [内容]` 手动发送测试提醒
- 使用 Ghostty 原生 OSC 9，不依赖 `terminal-notifier` 或 `osascript`

## 让通知停留

OSC 9 的停留时间由 macOS 通知设置控制。打开：

`系统设置 → 通知 → Ghostty → 提醒样式 → 持久`

`临时` 样式会自动消失，插件无法逐条通知强制改成持久样式。

## 临时测试

```bash
pi -e ./extensions/index.ts
```

进入 Pi 后执行：

```text
/notify 点击后返回当前 Ghostty tab
```

## 安装

从 Git 仓库安装：

```bash
pi install git:github.com/<用户名>/pi-x-mac-ghostty-notify
```

安装后重启 Pi，或执行 `/reload`。
