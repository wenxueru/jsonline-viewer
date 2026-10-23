import { randomBytes } from "node:crypto";
import { renderJson } from "./jsonRenderer";
import { initializeViewer } from "./viewerClient";
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
<div class="viewer-header">
<header class="toolbar">
  <div class="brand"><span class="brand-mark" aria-hidden="true">{ }</span><span class="file-name" title="${escapedFileName}">${escapedFileName}</span></div>
  <div class="record-navigation" role="group" aria-label="Record navigation">
    <button id="prev" class="icon-button" type="button" aria-label="Previous record" title="Previous record" disabled><svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true"><path d="m10 3-5 5 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <div class="line-control"><label for="line">Record</label><input id="line" aria-label="Record number" type="number" min="1" step="1" value="1" disabled><span id="line-count" class="line-count">/ —</span></div>
    <button id="go" class="go-button" type="button" disabled>Go</button>
    <button id="next" class="icon-button" type="button" aria-label="Next record" title="Next record" disabled><svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true"><path d="m6 3 5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
  </div>
</header>
<div class="view-toolbar">
  <nav class="tabs" role="tablist" aria-label="JSON view">
    <button id="tab-pretty" class="tab active" type="button" role="tab" data-mode="pretty" aria-selected="true" aria-controls="content">Pretty</button>
    <button id="tab-tree" class="tab" type="button" role="tab" data-mode="tree" aria-selected="false" aria-controls="content" tabindex="-1">Tree</button>
    <button id="tab-raw" class="tab" type="button" role="tab" data-mode="raw" aria-selected="false" aria-controls="content" tabindex="-1">Raw</button>
  </nav>
  <div id="fold-controls" class="fold-controls" role="group" aria-label="JSON folding" hidden>
    <button id="expand-all" type="button">Expand all</button>
    <button id="collapse-all" type="button">Collapse all</button>
  </div>
  <span id="view-caption" class="sr-only">Formatted JSON · foldable values</span>
</div>
</div>
<main id="content" class="viewer-content" role="tabpanel" aria-labelledby="tab-pretty" tabindex="0" aria-busy="true"><div class="state-panel loading-state"><span class="state-symbol" aria-hidden="true"></span><strong class="state-title">Building byte-offset index…</strong><p class="state-description">Your records will appear here as soon as indexing finishes.</p></div></main>
<footer id="status" class="toolbar-meta" role="status"><span class="status-position">Indexing…</span></footer>
</div>
<script nonce="${nonce}">(${initializeViewer.toString()})(${renderJson.toString()});</script></body></html>`;
}
