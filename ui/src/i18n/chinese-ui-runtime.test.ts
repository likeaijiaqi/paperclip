// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { installChineseUiRuntime, translateUiText, translateUiTitle } from "./chinese-ui-runtime";

describe("Chinese UI runtime", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("translates common visible UI copy and count patterns", () => {
    expect(translateUiText("Dashboard")).toBe("仪表盘");
    expect(translateUiText("New Issue")).toBe("新建任务");
    expect(translateUiText("Inbox")).toBe("收件箱");
    expect(translateUiText("Routines")).toBe("例程");
    expect(translateUiText("Instructions")).toBe("指令");
    expect(translateUiText("Configuration")).toBe("配置");
    expect(translateUiText("Run Heartbeat")).toBe("运行心跳");
    expect(translateUiText("Resume agent")).toBe("恢复代理");
    expect(translateUiText("Leave agent")).toBe("离开代理");
    expect(translateUiText("Latest Run")).toBe("最近运行");
    expect(translateUiText("View details →")).toBe("查看详情 →");
    expect(translateUiText("Run Activity")).toBe("运行活动");
    expect(translateUiText("Issues by Priority")).toBe("按优先级统计任务");
    expect(translateUiText("Issues by Status")).toBe("按状态统计任务");
    expect(translateUiText("Success Rate")).toBe("成功率");
    expect(translateUiText("See All →")).toBe("查看全部 →");
    expect(translateUiText("paused")).toBe("已暂停");
    expect(translateUiText("blocked")).toBe("已阻塞");
    expect(translateUiText("Blocked")).toBe("已阻塞");
    expect(translateUiText("Automation")).toBe("自动化");
    expect(translateUiText("May 28, 2026")).toBe("2026 年 5 月 28 日");
    expect(translateUiText("Skip to Main Content")).toBe("跳到主要内容");
    expect(translateUiText("Command Palette")).toBe("命令面板");
    expect(translateUiText("Search for a command to run...")).toBe("搜索要运行的命令...");
    expect(translateUiText("New issue")).toBe("新建任务");
    expect(translateUiText("Issue title")).toBe("任务标题");
    expect(translateUiText("For")).toBe("用于");
    expect(translateUiText("Assignee")).toBe("负责人");
    expect(translateUiText("Project")).toBe("项目");
    expect(translateUiText("Add description...")).toBe("添加描述...");
    expect(translateUiText("Todo")).toBe("待办");
    expect(translateUiText("Priority")).toBe("优先级");
    expect(translateUiText("Upload")).toBe("上传");
    expect(translateUiText("Standard")).toBe("标准");
    expect(translateUiText("Discard Draft")).toBe("丢弃草稿");
    expect(translateUiText("Create Issue")).toBe("创建任务");
    expect(translateUiText("Select a company to view issues.")).toBe("请选择公司以查看任务。");
    expect(translateUiText("Cancelled due to agent pause")).toBe("因代理暂停而取消");
    expect(translateUiText("3 selected")).toBe("已选择 3 项");
    expect(translateUiText("6m ago")).toBe("6 分钟前");
    expect(translateUiTitle("Issues • Paperclip")).toBe("任务 • Paperclip");
  });

  it("translates added DOM text and common accessible attributes", async () => {
    const root = document.createElement("main");
    root.innerHTML = `
      <button title="Open search" aria-label="Open search">New Issue</button>
      <input placeholder="Search issues..." />
    `;
    document.body.appendChild(root);

    const runtime = installChineseUiRuntime(root);
    await Promise.resolve();

    expect(root.textContent).toContain("新建任务");
    expect(root.querySelector("button")?.getAttribute("title")).toBe("打开搜索");
    expect(root.querySelector("button")?.getAttribute("aria-label")).toBe("打开搜索");
    expect(root.querySelector("input")?.getAttribute("placeholder")).toBe("搜索任务...");

    runtime.disconnect();
  });

  it("skips code, editable, and form value content", async () => {
    const root = document.createElement("main");
    root.innerHTML = `
      <pre><code>New Issue</code></pre>
      <div contenteditable="true">Dashboard</div>
      <textarea>Search issues...</textarea>
    `;
    document.body.appendChild(root);

    const runtime = installChineseUiRuntime(root);
    await Promise.resolve();

    expect(root.querySelector("code")?.textContent).toBe("New Issue");
    expect(root.querySelector("[contenteditable]")?.textContent).toBe("Dashboard");
    expect(root.querySelector("textarea")?.textContent).toBe("Search issues...");

    runtime.disconnect();
  });
});
