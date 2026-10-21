import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createTaskDispatcherTool } from "./src/task-dispatcher-tool.js";

export default definePluginEntry({
  id: "task-dispatcher",
  name: "Task Dispatcher",
  description:
    "Selects a configured OpenClaw agent and delegates tasks through the native subagent runtime.",
  register(api) {
    api.registerTool(() => createTaskDispatcherTool(api), { name: "task_dispatch" });
  },
});
