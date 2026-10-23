import type { JsonValue, JsonView, ViewMode, renderJson } from "./jsonRenderer";

type HostMessage =
  | { type: "indexProgress"; bytesRead: number; totalBytes: number }
  | { type: "fatal"; message: string }
  | { type: "empty" }
  | { type: "line"; line: number; lineCount: number; raw: string; byteLength: number; fileSize: number };

declare function acquireVsCodeApi(): {
  postMessage(message: { type: "ready" } | { type: "goto"; line: number } | { type: "move"; delta: number }): void;
};

// Embedded in the webview by viewerHtml; the renderer is its only injected dependency.
export function initializeViewer(render: typeof renderJson): void {
  const vscode = acquireVsCodeApi();
  const content = document.getElementById("content")!;
  const lineInput = document.getElementById("line") as HTMLInputElement;
  const status = document.getElementById("status")!;
  const prev = document.getElementById("prev") as HTMLButtonElement;
  const next = document.getElementById("next") as HTMLButtonElement;
  const goButton = document.getElementById("go") as HTMLButtonElement;
  const lineCount = document.getElementById("line-count")!;
  const viewCaption = document.getElementById("view-caption")!;
  const foldControls = document.getElementById("fold-controls")!;
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab"));
  const captions: Record<ViewMode, string> = {
    pretty: "Formatted JSON · foldable values",
    tree: "Explore fields · click to expand",
    raw: "Highlighted source · original text",
  };
  let record: ReturnType<typeof createRecord> | undefined;
  let mode: ViewMode = "pretty";

  function textElement(tag: string, text: string, className: string): HTMLElement {
    const element = document.createElement(tag);
    element.textContent = text;
    element.className = className;
    return element;
  }

  function human(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KiB";
    return (bytes / 1048576).toFixed(1) + " MiB";
  }

  function statePanel(kind: "error" | "empty", title: string, description?: string): HTMLElement {
    const panel = textElement("div", "", "state-panel " + kind + "-state");
    const symbol = textElement("span", "", "state-symbol");
    symbol.setAttribute("aria-hidden", "true");
    panel.append(symbol, textElement("strong", title, "state-title" + (kind === "error" ? " error" : "")));
    if (description) panel.append(textElement("p", description, "state-description"));
    return panel;
  }

  function createRecord(message: Extract<HostMessage, { type: "line" }>) {
    let value: JsonValue = null;
    let error: string | undefined;
    try {
      value = JSON.parse(message.raw);
    } catch (cause) {
      error = "Invalid JSON on line " + message.line + ": " + (cause as Error).message;
    }
    // Each retained view owns its fold state; replacing the record releases all views.
    const views: Partial<Record<ViewMode, JsonView>> = {};
    return {
      line: message.line,
      lineCount: message.lineCount,
      raw: message.raw,
      view(mode: ViewMode): JsonView {
        if (!views[mode]) {
          if (error && mode !== "raw") {
            views[mode] = {
              element: statePanel("error", error, "Select Raw to inspect the original record."),
              foldable: false,
              setExpanded() {},
            };
          } else {
            views[mode] = render(mode, value, message.raw);
          }
        }
        return views[mode];
      },
    };
  }

  function showView(): void {
    if (!record) return;
    const view = record.view(mode);
    content.replaceChildren(view.element);
    content.setAttribute("aria-busy", "false");
    foldControls.hidden = !view.foldable;
  }

  function go(): void {
    const line = Number(lineInput.value);
    if (record && Number.isInteger(line) && line >= 1 && line <= record.lineCount) {
      vscode.postMessage({ type: "goto", line });
    }
  }
  prev.onclick = () => vscode.postMessage({ type: "move", delta: -1 });
  next.onclick = () => vscode.postMessage({ type: "move", delta: 1 });
  goButton.onclick = go;
  lineInput.onkeydown = event => { if (event.key === "Enter") go(); };
  document.getElementById("expand-all")!.onclick = () => record?.view(mode).setExpanded(true);
  document.getElementById("collapse-all")!.onclick = () => record?.view(mode).setExpanded(false);

  function selectTab(tab: HTMLButtonElement, focus = false): void {
    mode = tab.dataset.mode as ViewMode;
    for (const candidate of tabs) {
      const active = candidate === tab;
      candidate.classList.toggle("active", active);
      candidate.setAttribute("aria-selected", String(active));
      candidate.tabIndex = active ? 0 : -1;
    }
    content.setAttribute("aria-labelledby", tab.id);
    viewCaption.textContent = captions[mode];
    if (focus) tab.focus();
    showView();
  }
  tabs.forEach((tab, index) => {
    tab.onclick = () => selectTab(tab);
    tab.onkeydown = event => {
      let target: number;
      switch (event.key) {
        case "ArrowRight": target = (index + 1) % tabs.length; break;
        case "ArrowLeft": target = (index + tabs.length - 1) % tabs.length; break;
        case "Home": target = 0; break;
        case "End": target = tabs.length - 1; break;
        default: return;
      }
      event.preventDefault();
      selectTab(tabs[target], true);
    };
  });

  function updateStatus(position: string, detail: string): void {
    status.replaceChildren(
      textElement("span", position, "status-position"),
      textElement("span", detail, "status-detail"),
    );
  }

  function clearRecord(): void {
    record = undefined;
    foldControls.hidden = true;
    lineInput.value = "";
    lineInput.removeAttribute("max");
    prev.disabled = next.disabled = goButton.disabled = lineInput.disabled = true;
    content.setAttribute("aria-busy", "false");
  }

  window.addEventListener("message", (event: MessageEvent<HostMessage>) => {
    const message = event.data;
    switch (message.type) {
      case "indexProgress":
        updateStatus("Indexing…", human(message.bytesRead) + " / " + human(message.totalBytes));
        return;
      case "fatal":
        clearRecord();
        lineCount.textContent = "/ —";
        status.textContent = "Unable to open file";
        content.replaceChildren(statePanel("error", message.message));
        return;
      case "empty":
        clearRecord();
        lineCount.textContent = "/ 0";
        status.textContent = "Empty file";
        content.replaceChildren(statePanel("empty", "This file has no lines."));
        return;
      case "line":
        if (record?.line !== message.line || record.raw !== message.raw) record = createRecord(message);
        record.lineCount = message.lineCount;
        lineInput.value = String(message.line);
        lineInput.max = String(message.lineCount);
        lineInput.disabled = goButton.disabled = false;
        lineCount.textContent = "/ " + message.lineCount.toLocaleString();
        prev.disabled = message.line <= 1;
        next.disabled = message.line >= message.lineCount;
        updateStatus(
          "Record " + message.line.toLocaleString() + " of " + message.lineCount.toLocaleString(),
          human(message.byteLength) + " record · " + human(message.fileSize) + " file",
        );
        showView();
    }
  });
  vscode.postMessage({ type: "ready" });
}
