import { basename } from "node:path";
import * as vscode from "vscode";
import { IndexedLineFile } from "./lineFile";
import { viewerHtml } from "./viewerHtml";

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
      const sourceEditor = editor?.document.uri.toString() === uri.toString() ? editor : undefined;
      await ViewerPanel.create(
        uri,
        sourceEditor ? sourceEditor.selection.active.line + 1 : 1,
        vscode.ViewColumn.Beside,
        sourceEditor?.document,
      );
    }),
    vscode.commands.registerCommand("largeJsonlViewer.previewJson", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !isJsonLinesFile(editor.document.uri) || editor.document.uri.scheme !== "file") return;
      await nativePreview.open(editor.document.uri, editor.selection.active.line + 1, editor.document);
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
    private sourceDocument?: vscode.TextDocument,
  ) {}

  static async create(
    uri: vscode.Uri,
    initialLine = 1,
    column: vscode.ViewColumn = vscode.ViewColumn.Active,
    sourceDocument?: vscode.TextDocument,
  ): Promise<void> {
    const key = uri.toString();
    const existing = ViewerPanel.openPanels.get(key);
    if (existing) {
      if (sourceDocument) existing.sourceDocument = sourceDocument;
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
    const viewer = new ViewerPanel(panel, initialLine, sourceDocument);
    ViewerPanel.openPanels.set(key, viewer);
    panel.webview.html = viewerHtml(basename(uri.fsPath));
    viewer.disposables.push(
      panel.webview.onDidReceiveMessage((message: ClientMessage) => void viewer.receive(message)),
      vscode.window.onDidChangeTextEditorSelection((event) => {
        if (event.textEditor.document.uri.toString() !== key) return;
        viewer.sourceDocument = event.textEditor.document;
        void viewer.goToLine(event.selections[0].active.line + 1);
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() !== key) return;
        viewer.sourceDocument = event.document;
        void viewer.goToLine(viewer.currentLine);
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        if (viewer.sourceDocument === document) viewer.sourceDocument = undefined;
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
      viewer.reportError(error);
    }
  }

  private get lineCount(): number {
    return this.sourceDocument ? documentJsonlLineCount(this.sourceDocument) : this.indexed?.lineCount ?? 0;
  }

  private async receive(message: ClientMessage): Promise<void> {
    if (message.type === "ready") {
      if (this.indexed) await this.goToLine(this.currentLine);
      return;
    }
    if (!this.indexed || this.lineCount === 0) return;
    const target = message.type === "move" ? this.currentLine + message.delta : message.line;
    await this.goToLine(target);
  }

  private async goToLine(line: number): Promise<void> {
    this.currentLine = Math.max(1, Math.trunc(line));
    if (!this.indexed) return;
    await this.showLine(Math.min(this.lineCount, this.currentLine));
  }

  private async showLine(line: number): Promise<void> {
    if (!this.indexed) return;
    if (line === 0) {
      void this.panel.webview.postMessage({ type: "empty", lineCount: 0, fileSize: this.indexed.size });
      return;
    }
    try {
      const raw = this.sourceDocument?.lineAt(line - 1).text ?? await this.indexed.readLine(line);
      this.currentLine = line;
      void this.panel.webview.postMessage({
        type: "line",
        line,
        lineCount: this.lineCount,
        fileSize: this.indexed.size,
        byteLength: Buffer.byteLength(raw),
        raw,
      });
    } catch (error) {
      this.reportError(error);
    }
  }

  private reportError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    void this.panel.webview.postMessage({ type: "fatal", message });
  }
}
