import { randomBytes } from "node:crypto";
import { basename } from "node:path";
import * as vscode from "vscode";
import { IndexedLineFile } from "./lineFile";

type ClientMessage =
  | { type: "ready" }
  | { type: "move"; delta: number }
  | { type: "goto"; line: number };

export function activate(context: vscode.ExtensionContext): void {
  const nativePreview = new NativePreviewProvider();
  context.subscriptions.push(
    nativePreview,
    vscode.workspace.registerTextDocumentContentProvider(NativePreviewProvider.scheme, nativePreview),
    vscode.commands.registerCommand("largeJsonlViewer.open", async (resource?: vscode.Uri) => {
      const uri = resource ?? (await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { "JSON Lines": ["jsonl", "ndjson"], "All Files": ["*"] },
        title: "Open a JSONL or NDJSON file",
      }))?.[0];
      if (!uri) return;
      if (uri.scheme !== "file") {
        void vscode.window.showErrorMessage("JSONLine Viewer currently supports local and remote filesystem paths only.");
        return;
      }
      await ViewerPanel.create(uri);
    }),
    vscode.commands.registerCommand("largeJsonlViewer.preview", async (resource?: vscode.Uri) => {
      const editor = vscode.window.activeTextEditor;
      const uri = resource ?? editor?.document.uri;
      if (!uri || !isJsonLinesFile(uri)) {
        void vscode.window.showErrorMessage("Open a .jsonl or .ndjson file before starting JSONLine Preview.");
        return;
      }
      if (uri.scheme !== "file") {
        void vscode.window.showErrorMessage("JSONLine Viewer currently supports local and remote filesystem paths only.");
        return;
      }
      const initialLine = editor?.document.uri.toString() === uri.toString()
        ? editor.selection.active.line + 1
        : 1;
      const sourceDocument = editor?.document.uri.toString() === uri.toString()
        ? editor.document
        : undefined;
      await nativePreview.open(uri, initialLine, sourceDocument);
    }),
    vscode.commands.registerCommand("largeJsonlViewer.previewPrevious", () => nativePreview.move(-1)),
    vscode.commands.registerCommand("largeJsonlViewer.previewNext", () => nativePreview.move(1)),
    vscode.commands.registerCommand("largeJsonlViewer.previewGoToLine", () => nativePreview.goToLine()),
  );
}

function isJsonLinesFile(uri: vscode.Uri): boolean {
  const path = uri.path.toLowerCase();
  return path.endsWith(".jsonl") || path.endsWith(".ndjson");
}

interface NativePreviewSession {
  readonly source: vscode.Uri;
  readonly preview: vscode.Uri;
  indexed?: IndexedLineFile;
  sourceDocument?: vscode.TextDocument;
  lineCount: number;
  line: number;
  content: string;
  version: number;
}

function documentJsonlLineCount(document: vscode.TextDocument): number {
  return document.lineCount > 1 && document.lineAt(document.lineCount - 1).text === ""
    ? document.lineCount - 1
    : document.lineCount;
}

/** Presents one JSONL record as a native, read-only VS Code JSON document. */
class NativePreviewProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  static readonly scheme = "jsonline-preview";

  private readonly changed = new vscode.EventEmitter<vscode.Uri>();
  private readonly sessions = new Map<string, NativePreviewSession>();
  private readonly status: vscode.StatusBarItem;
  private readonly disposables: vscode.Disposable[];

  readonly onDidChange = this.changed.event;

  constructor() {
    this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.status.command = "largeJsonlViewer.previewGoToLine";
    this.disposables = [
      this.changed,
      this.status,
      vscode.window.onDidChangeActiveTextEditor(() => this.refreshStatus()),
      vscode.window.onDidChangeTextEditorSelection((event) => {
        const session = this.sessions.get(event.textEditor.document.uri.toString());
        if (!session) return;
        session.sourceDocument = event.textEditor.document;
        session.lineCount = documentJsonlLineCount(event.textEditor.document);
        const line = event.selections[0].active.line + 1;
        void this.update(session, line, event.textEditor.document.lineAt(line - 1).text);
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        const session = this.sessions.get(event.document.uri.toString());
        if (!session) return;
        session.sourceDocument = event.document;
        session.lineCount = documentJsonlLineCount(event.document);
        const line = Math.max(1, Math.min(session.line, session.lineCount));
        void this.update(
          session,
          line,
          session.lineCount > 0 ? event.document.lineAt(line - 1).text : undefined,
        );
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        if (document.uri.scheme !== NativePreviewProvider.scheme) {
          const sourceSession = this.sessions.get(document.uri.toString());
          if (sourceSession?.sourceDocument === document) sourceSession.sourceDocument = undefined;
          return;
        }
        const session = this.sessionForPreview(document.uri);
        if (!session) return;
        this.sessions.delete(session.source.toString());
      }),
    ];
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.sessionForPreview(uri)?.content ?? "null\n";
  }

  async open(source: vscode.Uri, line: number, sourceDocument?: vscode.TextDocument): Promise<void> {
    const sourceKey = source.toString();
    let session = this.sessions.get(sourceKey);
    if (!session) {
      const preview = vscode.Uri.from({
        scheme: NativePreviewProvider.scheme,
        path: `/${basename(source.fsPath)}.preview.json`,
        query: Buffer.from(sourceKey).toString("base64url"),
      });
      session = {
        source,
        preview,
        sourceDocument,
        lineCount: sourceDocument ? documentJsonlLineCount(sourceDocument) : 0,
        line: 1,
        content: "null\n",
        version: 0,
      };
      this.sessions.set(sourceKey, session);
    } else if (sourceDocument) {
      session.sourceDocument = sourceDocument;
      session.lineCount = documentJsonlLineCount(sourceDocument);
    }

    await this.update(
      session,
      line,
      sourceDocument && line <= sourceDocument.lineCount
        ? sourceDocument.lineAt(line - 1).text
        : undefined,
    );
    const document = await vscode.workspace.openTextDocument(session.preview);
    await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false,
      preserveFocus: false,
    });
    this.refreshStatus();
  }

  async move(delta: number): Promise<void> {
    const session = this.activeSession();
    if (!session) return;
    await this.update(session, session.line + delta);
  }

  async goToLine(): Promise<void> {
    const session = this.activeSession();
    if (!session) return;
    const value = await vscode.window.showInputBox({
      prompt: `Go to JSONL row (1-${session.lineCount})`,
      value: String(session.line),
      validateInput: (input) => {
        const line = Number(input);
        return Number.isInteger(line) && line >= 1 && line <= session.lineCount
          ? undefined
          : `Enter a whole number from 1 to ${session.lineCount}.`;
      },
    });
    if (value !== undefined) await this.update(session, Number(value));
  }

  dispose(): void {
    for (const disposable of this.disposables) disposable.dispose();
    this.sessions.clear();
  }

  private async update(session: NativePreviewSession, requestedLine: number, raw?: string): Promise<void> {
    if (!session.sourceDocument && !session.indexed) {
      session.indexed = await IndexedLineFile.open(session.source.fsPath);
      session.lineCount = session.indexed.lineCount;
    }
    if (session.lineCount === 0) {
      session.content = "null\n";
      this.changed.fire(session.preview);
      return;
    }
    const line = raw === undefined
      ? Math.max(1, Math.min(session.lineCount, Math.trunc(requestedLine)))
      : Math.max(1, Math.trunc(requestedLine));
    if (line === session.line && raw === undefined && session.version > 0) return;
    const version = ++session.version;
    const source = raw
      ?? session.sourceDocument?.lineAt(line - 1).text
      ?? await session.indexed!.readLine(line);
    if (version !== session.version) return;
    session.line = line;
    try {
      session.content = `${JSON.stringify(JSON.parse(source), null, 2)}\n`;
    } catch {
      // Keeping the original row lets VS Code's JSON diagnostics point at the parse problem.
      session.content = `${source}\n`;
    }
    this.changed.fire(session.preview);
    this.refreshStatus();
  }

  private activeSession(): NativePreviewSession | undefined {
    const uri = vscode.window.activeTextEditor?.document.uri;
    return uri ? this.sessionForPreview(uri) : undefined;
  }

  private sessionForPreview(uri: vscode.Uri): NativePreviewSession | undefined {
    if (uri.scheme !== NativePreviewProvider.scheme) return undefined;
    const key = uri.toString();
    return [...this.sessions.values()].find((session) => session.preview.toString() === key);
  }

  private refreshStatus(): void {
    const session = this.activeSession();
    if (!session) {
      this.status.hide();
      return;
    }
    this.status.text = `$(json) JSONL ${session.line}/${session.lineCount}`;
    this.status.tooltip = "Current JSONL row — click to go to another row";
    this.status.show();
  }
}

class ViewerPanel {
  private static readonly openPanels = new Map<string, ViewerPanel>();

  private indexed?: IndexedLineFile;
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private currentLine: number,
  ) {}

  static async create(
    uri: vscode.Uri,
    initialLine = 1,
    column: vscode.ViewColumn = vscode.ViewColumn.Active,
  ): Promise<void> {
    const key = uri.toString();
    const existing = ViewerPanel.openPanels.get(key);
    if (existing) {
      existing.panel.reveal(column);
      await existing.goToLine(initialLine);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "largeJsonlViewer",
      `Preview: ${basename(uri.fsPath)}`,
      column,
      { enableScripts: true, retainContextWhenHidden: false },
    );
    const viewer = new ViewerPanel(panel, initialLine);
    ViewerPanel.openPanels.set(key, viewer);
    panel.webview.html = viewer.html();
    viewer.disposables.push(
      panel.webview.onDidReceiveMessage((message: ClientMessage) => void viewer.receive(message)),
      vscode.window.onDidChangeTextEditorSelection((event) => {
        if (event.textEditor.document.uri.toString() === key) {
          void viewer.goToLine(event.selections[0].active.line + 1);
        }
      }),
      panel.onDidDispose(() => {
        ViewerPanel.openPanels.delete(key);
        for (const disposable of viewer.disposables) disposable.dispose();
      }),
    );

    try {
      viewer.indexed = await IndexedLineFile.open(uri.fsPath, ({ bytesRead, totalBytes }) => {
        void panel.webview.postMessage({ type: "indexProgress", bytesRead, totalBytes });
      });
      await viewer.goToLine(viewer.currentLine);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void panel.webview.postMessage({ type: "fatal", message });
    }
  }

  private async receive(message: ClientMessage): Promise<void> {
    if (message.type === "ready") {
      if (this.indexed) await this.showLine(this.currentLine);
      return;
    }
    if (!this.indexed || this.indexed.lineCount === 0) return;
    const target = message.type === "move" ? this.currentLine + message.delta : message.line;
    await this.goToLine(target);
  }

  private async goToLine(line: number): Promise<void> {
    this.currentLine = Math.max(1, Math.trunc(line));
    if (!this.indexed) return;
    if (this.indexed.lineCount === 0) {
      await this.showLine(0);
      return;
    }
    await this.showLine(Math.min(this.indexed.lineCount, this.currentLine));
  }

  private async showLine(line: number): Promise<void> {
    if (!this.indexed) return;
    if (line === 0) {
      void this.panel.webview.postMessage({ type: "empty", lineCount: 0, fileSize: this.indexed.size });
      return;
    }
    try {
      const raw = await this.indexed.readLine(line);
      this.currentLine = line;
      void this.panel.webview.postMessage({
        type: "line",
        line,
        lineCount: this.indexed.lineCount,
        fileSize: this.indexed.size,
        byteLength: Buffer.byteLength(raw),
        raw,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void this.panel.webview.postMessage({ type: "fatal", message });
    }
  }

  private html(): string {
    const nonce = randomBytes(16).toString("hex");
    return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="${nonce}">
  :root { color-scheme: light dark; }
  body { margin: 0; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); font: 13px var(--vscode-font-family); }
  header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-editor-background); }
  button, input { color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); padding: 4px 8px; }
  button { cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  button:disabled { opacity: .45; cursor: default; }
  input { width: 90px; }
  #status { margin-left: auto; opacity: .8; }
  nav { padding: 8px 12px 0; }
  .tab { background: transparent; color: var(--vscode-foreground); border: 0; border-bottom: 2px solid transparent; }
  .tab.active { border-bottom-color: var(--vscode-focusBorder); }
  main { padding: 10px 14px 40px; overflow-wrap: anywhere; }
  pre { white-space: pre-wrap; word-break: break-word; font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }
  details { margin-left: 14px; }
  summary { cursor: pointer; line-height: 1.55; }
  .key { color: var(--vscode-symbolIcon-propertyForeground, #9cdcfe); }
  .string { color: var(--vscode-debugTokenExpression-string, #ce9178); }
  .number { color: var(--vscode-debugTokenExpression-number, #b5cea8); }
  .boolean { color: var(--vscode-debugTokenExpression-boolean, #569cd6); }
  .null { opacity: .65; font-style: italic; }
  .error { color: var(--vscode-errorForeground); white-space: pre-wrap; }
</style></head><body>
<header><button id="prev">Previous</button><button id="next">Next</button><label>Line <input id="line" type="number" min="1" step="1"></label><button id="go">Go</button><span id="status">Indexing…</span></header>
<nav><button class="tab active" data-mode="tree">Tree</button><button class="tab" data-mode="pretty">Pretty</button><button class="tab" data-mode="raw">Raw</button></nav>
<main id="content">Building byte-offset index…</main>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const content = document.getElementById('content');
  const lineInput = document.getElementById('line');
  const status = document.getElementById('status');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  let current = 0, count = 0, raw = '', parsed, parseError, mode = 'tree';
  const human = n => n < 1024 ? n + ' B' : n < 1048576 ? (n/1024).toFixed(1) + ' KiB' : (n/1048576).toFixed(1) + ' MiB';
  function scalar(value) {
    const span = document.createElement('span');
    span.className = value === null ? 'null' : typeof value;
    span.textContent = value === null ? 'null' : typeof value === 'string' ? JSON.stringify(value) : String(value);
    return span;
  }
  function tree(value, name, root = false) {
    if (value === null || typeof value !== 'object') {
      const row = document.createElement('div');
      if (name !== undefined) { const key = document.createElement('span'); key.className = 'key'; key.textContent = name + ': '; row.append(key); }
      row.append(scalar(value)); return row;
    }
    const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value);
    const details = document.createElement('details'); details.open = root;
    const summary = document.createElement('summary');
    const label = name === undefined ? '' : name + ': ';
    summary.textContent = label + (Array.isArray(value) ? 'Array' : 'Object') + ' (' + entries.length + ')';
    details.append(summary);
    // No arbitrary node ceiling: every value is represented and browser-native details provide folding.
    for (const [key, child] of entries) details.append(tree(child, key));
    return details;
  }
  function render() {
    content.replaceChildren();
    if (parseError && mode !== 'raw') { const e = document.createElement('div'); e.className = 'error'; e.textContent = parseError; content.append(e); return; }
    if (mode === 'tree') content.append(tree(parsed, undefined, true));
    else { const pre = document.createElement('pre'); pre.textContent = mode === 'pretty' ? JSON.stringify(parsed, null, 2) : raw; content.append(pre); }
  }
  function go() { const value = Number(lineInput.value); if (Number.isInteger(value)) vscode.postMessage({ type: 'goto', line: value }); }
  prev.onclick = () => vscode.postMessage({ type: 'move', delta: -1 });
  next.onclick = () => vscode.postMessage({ type: 'move', delta: 1 });
  document.getElementById('go').onclick = go;
  lineInput.onkeydown = event => { if (event.key === 'Enter') go(); };
  for (const tab of document.querySelectorAll('.tab')) tab.onclick = () => {
    mode = tab.dataset.mode; document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab)); render();
  };
  window.addEventListener('message', event => {
    const message = event.data;
    if (message.type === 'indexProgress') { status.textContent = 'Indexing ' + human(message.bytesRead) + ' / ' + human(message.totalBytes); return; }
    if (message.type === 'fatal') { content.textContent = ''; const e = document.createElement('div'); e.className = 'error'; e.textContent = message.message; content.append(e); return; }
    if (message.type === 'empty') { status.textContent = 'Empty file'; prev.disabled = next.disabled = true; content.textContent = 'This file has no lines.'; return; }
    if (message.type !== 'line') return;
    current = message.line; count = message.lineCount; raw = message.raw; lineInput.value = current; lineInput.max = count;
    prev.disabled = current <= 1; next.disabled = current >= count;
    status.textContent = current.toLocaleString() + ' / ' + count.toLocaleString() + ' · line ' + human(message.byteLength) + ' · file ' + human(message.fileSize);
    try { parsed = JSON.parse(raw); parseError = undefined; } catch (error) { parsed = undefined; parseError = 'Invalid JSON on line ' + current + ': ' + error.message; }
    render();
  });
  vscode.postMessage({ type: 'ready' });
</script></body></html>`;
  }
}
