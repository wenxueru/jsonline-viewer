import { randomBytes } from "node:crypto";

export function viewerHtml(): string {
  const nonce = randomBytes(16).toString("hex");
  return String.raw`<!doctype html>
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
  pre { white-space: pre-wrap; word-break: break-word; font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); line-height: 1.6; tab-size: 2; }
  details { margin-left: 14px; }
  summary { cursor: pointer; line-height: 1.55; }
  .key { color: var(--vscode-symbolIcon-propertyForeground, #9cdcfe); }
  .string { color: var(--vscode-debugTokenExpression-string, #ce9178); }
  .number { color: var(--vscode-debugTokenExpression-number, #b5cea8); }
  .boolean, .null { color: var(--vscode-debugTokenExpression-boolean, #569cd6); }
  .error { color: var(--vscode-errorForeground); white-space: pre-wrap; }
</style></head><body>
<header><button id="prev">Previous</button><button id="next">Next</button><label>Line <input id="line" type="number" min="1" step="1"></label><button id="go">Go</button><span id="status">Indexing…</span></header>
<nav><button class="tab" data-mode="tree">Tree</button><button class="tab active" data-mode="pretty">Pretty</button><button class="tab" data-mode="raw">Raw</button></nav>
<main id="content">Building byte-offset index…</main>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const content = document.getElementById('content');
  const lineInput = document.getElementById('line');
  const status = document.getElementById('status');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  let current = 0, count = 0, raw = '', parsed, parseError, mode = 'pretty';
  const tabs = document.querySelectorAll('.tab');
  const displayWhitespace = { '\\n': '\n', '\\r': '\r', '\\t': '\t' };
  function human(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KiB';
    return (bytes / 1048576).toFixed(1) + ' MiB';
  }
  function textElement(tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function scalar(value) {
    const className = value === null ? 'null' : typeof value;
    const text = typeof value === 'string' ? JSON.stringify(value) : String(value);
    return textElement('span', text, className);
  }
  function tree(value, name, root = false) {
    if (value === null || typeof value !== 'object') {
      const row = document.createElement('div');
      if (name !== undefined) row.append(textElement('span', name + ': ', 'key'));
      row.append(scalar(value));
      return row;
    }
    const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value);
    const details = document.createElement('details');
    details.open = root;
    const label = name === undefined ? '' : name + ': ';
    const kind = Array.isArray(value) ? 'Array' : 'Object';
    details.append(textElement('summary', label + kind + ' (' + entries.length + ')'));
    // No arbitrary node ceiling: every value is represented and browser-native details provide folding.
    for (const [key, child] of entries) details.append(tree(child, key));
    return details;
  }
  function tokenClass(text) {
    if (text[0] === '"') return text.endsWith(':') ? 'key' : 'string';
    if (text === 'null') return 'null';
    if (text === 'true' || text === 'false') return 'boolean';
    return 'number';
  }
  function pretty(value) {
    const pre = document.createElement('pre');
    pre.setAttribute('aria-label', 'Pretty JSON');
    const formatted = JSON.stringify(value, null, 2);
    const tokens = /"(?:\\.|[^"\\])*"(?:\s*:)?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b/g;
    let offset = 0;
    for (const match of formatted.matchAll(tokens)) {
      pre.append(document.createTextNode(formatted.slice(offset, match.index)));
      const text = match[0];
      const className = tokenClass(text);
      // Decode only display whitespace; escaped backslashes and quotes stay literal.
      const display = className === 'string'
        ? text.replace(/\\(?:u[0-9a-fA-F]{4}|.)/g, escape => displayWhitespace[escape] ?? escape)
        : text;
      pre.append(textElement('span', display, className));
      offset = match.index + text.length;
    }
    pre.append(document.createTextNode(formatted.slice(offset)));
    return pre;
  }
  function render() {
    if (current === 0) return;
    content.replaceChildren();
    if (parseError && mode !== 'raw') {
      content.append(textElement('div', parseError, 'error'));
      return;
    }
    if (mode === 'tree') content.append(tree(parsed, undefined, true));
    else if (mode === 'pretty') content.append(pretty(parsed));
    else content.append(textElement('pre', raw));
  }
  function go() {
    const value = Number(lineInput.value);
    if (Number.isInteger(value)) vscode.postMessage({ type: 'goto', line: value });
  }
  prev.onclick = () => vscode.postMessage({ type: 'move', delta: -1 });
  next.onclick = () => vscode.postMessage({ type: 'move', delta: 1 });
  document.getElementById('go').onclick = go;
  lineInput.onkeydown = event => { if (event.key === 'Enter') go(); };
  for (const tab of tabs) tab.onclick = () => {
    mode = tab.dataset.mode;
    tabs.forEach(t => t.classList.toggle('active', t === tab));
    render();
  };
  window.addEventListener('message', event => {
    const message = event.data;
    if (message.type === 'indexProgress') {
      status.textContent = 'Indexing ' + human(message.bytesRead) + ' / ' + human(message.totalBytes);
      return;
    }
    if (message.type === 'fatal') {
      current = 0;
      content.replaceChildren(textElement('div', message.message, 'error'));
      return;
    }
    if (message.type === 'empty') {
      current = 0;
      status.textContent = 'Empty file';
      prev.disabled = next.disabled = true;
      content.textContent = 'This file has no lines.';
      return;
    }
    if (message.type !== 'line') return;
    current = message.line;
    count = message.lineCount;
    raw = message.raw;
    lineInput.value = current;
    lineInput.max = count;
    prev.disabled = current <= 1;
    next.disabled = current >= count;
    status.textContent = current.toLocaleString() + ' / ' + count.toLocaleString() + ' · line ' + human(message.byteLength) + ' · file ' + human(message.fileSize);
    try {
      parsed = JSON.parse(raw);
      parseError = undefined;
    } catch (error) {
      parsed = undefined;
      parseError = 'Invalid JSON on line ' + current + ': ' + error.message;
    }
    render();
  });
  vscode.postMessage({ type: 'ready' });
</script></body></html>`;
}
