import { randomBytes } from "node:crypto";
import { viewerStyles } from "./viewerStyles";

const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function viewerHtml(fileName = "JSON Lines"): string {
  const escapedFileName = fileName.replace(/[&<>"']/g, character => htmlEntities[character]);
  const nonce = randomBytes(16).toString("hex");
  return String.raw`<!doctype html>
<html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="${nonce}">${viewerStyles}</style></head><body>
<div class="app-shell">
<header class="toolbar">
  <div class="brand"><span class="brand-mark" aria-hidden="true">{ }</span><div class="brand-copy"><strong>JSON Lines</strong><span class="file-name" title="${escapedFileName}">${escapedFileName}</span></div></div>
  <div class="record-navigation" role="group" aria-label="Record navigation">
    <button id="prev" class="icon-button" type="button" aria-label="Previous record" title="Previous record" disabled><svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true"><path d="m10 3-5 5 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <div class="line-control"><label for="line">Record</label><input id="line" aria-label="Record number" type="number" min="1" step="1" value="1" disabled><span id="line-count" class="line-count">/ —</span></div>
    <button id="go" class="go-button" type="button" disabled>Go</button>
    <button id="next" class="icon-button" type="button" aria-label="Next record" title="Next record" disabled><svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true"><path d="m6 3 5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
  </div>
  <div id="status" class="toolbar-meta" role="status"><span class="status-position">Indexing…</span></div>
</header>
<div class="view-toolbar">
  <nav class="tabs" role="tablist" aria-label="JSON view">
    <button id="tab-pretty" class="tab active" type="button" role="tab" data-mode="pretty" aria-selected="true" aria-controls="content">Pretty</button>
    <button id="tab-tree" class="tab" type="button" role="tab" data-mode="tree" aria-selected="false" aria-controls="content" tabindex="-1">Tree</button>
    <button id="tab-raw" class="tab" type="button" role="tab" data-mode="raw" aria-selected="false" aria-controls="content" tabindex="-1">Raw</button>
  </nav>
  <span id="view-caption" class="view-caption">Formatted JSON · readable strings</span>
</div>
<main id="content" class="viewer-content" role="tabpanel" aria-labelledby="tab-pretty" tabindex="0" aria-busy="true"><div class="state-panel loading-state"><span class="state-symbol" aria-hidden="true"></span><strong class="state-title">Building byte-offset index…</strong><p class="state-description">Your records will appear here as soon as indexing finishes.</p></div></main>
</div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const content = document.getElementById('content');
  const lineInput = document.getElementById('line');
  const status = document.getElementById('status');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  const goButton = document.getElementById('go');
  const lineCount = document.getElementById('line-count');
  const viewCaption = document.getElementById('view-caption');
  let current = 0, count = 0, raw = '', parsed, parseError, mode = 'pretty';
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const viewCaptions = {
    pretty: 'Formatted JSON · readable strings',
    tree: 'Explore fields · click to expand',
    raw: 'Original record · source preserved',
  };
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
      row.className = 'tree-row';
      if (name !== undefined) row.append(textElement('span', name + ': ', 'key'));
      const scalarValue = scalar(value);
      scalarValue.classList.add('tree-value');
      row.append(scalarValue);
      return row;
    }
    const isArray = Array.isArray(value);
    const entries = isArray ? value.map((v, i) => [String(i), v]) : Object.entries(value);
    const details = document.createElement('details');
    details.open = root;
    details.className = root ? 'tree-node tree-root' : 'tree-node';
    const kind = isArray ? 'Array' : 'Object';
    const entryLabel = isArray ? 'item' : 'key';
    const countLabel = entries.length + ' ' + entryLabel + (entries.length === 1 ? '' : 's');
    const summary = document.createElement('summary');
    summary.className = 'tree-summary';
    if (name !== undefined) summary.append(textElement('span', name + ': ', 'key'));
    summary.append(textElement('span', kind, 'tree-kind'));
    summary.append(textElement('span', countLabel, 'tree-count'));
    details.append(summary);
    const children = document.createElement('div');
    children.className = 'tree-children';
    // No arbitrary node ceiling: every value is represented and browser-native details provide folding.
    for (const [key, child] of entries) children.append(tree(child, key));
    details.append(children);
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
    pre.className = 'pretty-json';
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
  function statePanel(kind, title, description) {
    const panel = document.createElement('div');
    panel.className = 'state-panel ' + kind + '-state';
    const symbol = textElement('span', '', 'state-symbol');
    symbol.setAttribute('aria-hidden', 'true');
    panel.append(symbol, textElement('strong', title, 'state-title' + (kind === 'error' ? ' error' : '')));
    if (description) panel.append(textElement('p', description, 'state-description'));
    return panel;
  }
  function render() {
    if (current === 0) return;
    content.replaceChildren();
    content.setAttribute('aria-busy', 'false');
    if (parseError && mode !== 'raw') {
      content.append(statePanel('error', parseError, 'Select Raw to inspect the original record.'));
      return;
    }
    const surface = document.createElement('div');
    surface.className = 'document-surface ' + mode + '-surface';
    if (mode === 'tree') surface.append(tree(parsed, undefined, true));
    else if (mode === 'pretty') surface.append(pretty(parsed));
    else {
      const pre = textElement('pre', raw, 'raw-json');
      pre.setAttribute('aria-label', 'Raw JSON');
      surface.append(pre);
    }
    content.append(surface);
  }
  function go() {
    const value = Number(lineInput.value);
    if (current > 0 && Number.isInteger(value) && value >= 1 && value <= count) {
      vscode.postMessage({ type: 'goto', line: value });
    }
  }
  prev.onclick = () => vscode.postMessage({ type: 'move', delta: -1 });
  next.onclick = () => vscode.postMessage({ type: 'move', delta: 1 });
  goButton.onclick = go;
  lineInput.onkeydown = event => { if (event.key === 'Enter') go(); };
  function selectTab(tab, focus = false) {
    mode = tab.dataset.mode;
    tabs.forEach(t => {
      const active = t === tab;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
    });
    content.setAttribute('aria-labelledby', tab.id);
    viewCaption.textContent = viewCaptions[mode];
    if (focus) tab.focus();
    render();
  }
  tabs.forEach((tab, index) => {
    tab.onclick = () => selectTab(tab);
    tab.onkeydown = event => {
      let target;
      switch (event.key) {
        case 'ArrowRight': target = (index + 1) % tabs.length; break;
        case 'ArrowLeft': target = (index + tabs.length - 1) % tabs.length; break;
        case 'Home': target = 0; break;
        case 'End': target = tabs.length - 1; break;
        default: return;
      }
      event.preventDefault();
      selectTab(tabs[target], true);
    };
  });
  function updateStatus(position, detail) {
    status.replaceChildren(
      textElement('span', position, 'status-position'),
      textElement('span', detail, 'status-detail'),
    );
  }
  function clearRecord() {
    current = count = 0;
    lineInput.value = '';
    lineInput.removeAttribute('max');
    prev.disabled = next.disabled = goButton.disabled = lineInput.disabled = true;
    content.setAttribute('aria-busy', 'false');
  }
  window.addEventListener('message', event => {
    const message = event.data;
    if (message.type === 'indexProgress') {
      updateStatus('Indexing…', human(message.bytesRead) + ' / ' + human(message.totalBytes));
      return;
    }
    if (message.type === 'fatal') {
      clearRecord();
      lineCount.textContent = '/ —';
      status.textContent = 'Unable to open file';
      content.replaceChildren(statePanel('error', message.message));
      return;
    }
    if (message.type === 'empty') {
      clearRecord();
      status.textContent = 'Empty file';
      lineCount.textContent = '/ 0';
      content.replaceChildren(statePanel('empty', 'This file has no lines.'));
      return;
    }
    if (message.type !== 'line') return;
    current = message.line;
    count = message.lineCount;
    raw = message.raw;
    lineInput.value = current;
    lineInput.max = count;
    lineInput.disabled = goButton.disabled = false;
    lineCount.textContent = '/ ' + count.toLocaleString();
    prev.disabled = current <= 1;
    next.disabled = current >= count;
    updateStatus(
      'Record ' + current.toLocaleString() + ' of ' + count.toLocaleString(),
      human(message.byteLength) + ' record · ' + human(message.fileSize) + ' file',
    );
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
