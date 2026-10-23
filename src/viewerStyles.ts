/** Native VS Code surfaces with readable syntax palettes for light and dark themes. */
export const viewerStyles = String.raw`
  :root {
    color-scheme: dark;
    --viewer-bg: var(--vscode-editor-background, #1e1f24);
    --viewer-text: var(--vscode-editor-foreground, #d4d8e0);
    --viewer-muted: var(--vscode-descriptionForeground, #9ca3af);
    --viewer-control: var(--vscode-input-background, #292b32);
    --viewer-border: var(--vscode-panel-border, #363941);
    --viewer-hover: var(--vscode-toolbar-hoverBackground, #ffffff0d);
    --viewer-accent: var(--vscode-textLink-foreground, #88b8f5);
    --viewer-focus: var(--vscode-focusBorder, #88b8f5);
    --viewer-selection: var(--vscode-editor-selectionBackground, #304b70);
    --viewer-error: var(--vscode-errorForeground, #f48771);
    --viewer-key: #9dc7f1;
    --viewer-string: #a5d6b6;
    --viewer-number: #e4bb86;
    --viewer-boolean: #c6b0ec;
    --viewer-null: #9ca3af;
    --viewer-mono: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
    --viewer-ui: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
  }
  body.vscode-light, body.vscode-high-contrast-light {
    color-scheme: light;
    --viewer-bg: var(--vscode-editor-background, #ffffff);
    --viewer-text: var(--vscode-editor-foreground, #283345);
    --viewer-muted: var(--vscode-descriptionForeground, #626c7a);
    --viewer-control: var(--vscode-input-background, #f4f5f7);
    --viewer-border: var(--vscode-panel-border, #e2e5e9);
    --viewer-hover: var(--vscode-toolbar-hoverBackground, #00000008);
    --viewer-accent: var(--vscode-textLink-foreground, #2463a7);
    --viewer-focus: var(--vscode-focusBorder, #2463a7);
    --viewer-selection: var(--vscode-editor-selectionBackground, #d9e9fa);
    --viewer-error: var(--vscode-errorForeground, #b42335);
    --viewer-key: #245d91;
    --viewer-string: #286a49;
    --viewer-number: #925819;
    --viewer-boolean: #7951a5;
    --viewer-null: #626c7a;
  }
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; min-width: 240px; color: var(--viewer-text); background: var(--viewer-bg); font: 13px/1.5 var(--viewer-ui); -webkit-font-smoothing: antialiased; }
  ::selection { background: var(--viewer-selection); }
  button, input { font: inherit; }
  button { cursor: pointer; }
  button, input, summary { -webkit-tap-highlight-color: transparent; }
  button:focus-visible, input:focus-visible, summary:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--viewer-focus); outline-offset: 2px; }
  button:disabled { opacity: .35; cursor: default; }
  [hidden] { display: none !important; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .app-shell { display: flex; flex-direction: column; min-height: 100vh; }
  .viewer-header { position: sticky; top: 0; z-index: 5; background: var(--viewer-bg); border-bottom: 1px solid var(--viewer-border); }
  .toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 20px; padding: 12px 20px 4px; }
  .brand { display: flex; align-items: center; flex: 1; gap: 9px; min-width: 100px; overflow: hidden; }
  .brand-mark { color: var(--viewer-muted); font: 14px var(--viewer-mono); white-space: nowrap; }
  .file-name { overflow: hidden; color: var(--viewer-text); font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  .record-navigation { display: flex; align-items: center; gap: 4px; }
  .icon-button, .go-button, .fold-controls button { display: inline-flex; align-items: center; justify-content: center; min-height: 28px; padding: 3px 8px; border: 1px solid transparent; border-radius: 4px; color: var(--viewer-muted); background: transparent; font-size: 12px; }
  .icon-button { width: 28px; padding: 0; }
  .icon-button:not(:disabled):hover, .go-button:not(:disabled):hover, .fold-controls button:hover { color: var(--viewer-text); background: var(--viewer-hover); }
  .line-control { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
  .line-control label, .line-count { color: var(--viewer-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  #line { width: 60px; height: 28px; padding: 0 6px; border: 1px solid var(--viewer-border); border-radius: 4px; color: var(--viewer-text); background: var(--viewer-control); font: 12px var(--viewer-mono); font-variant-numeric: tabular-nums; appearance: textfield; }
  #line::-webkit-inner-spin-button, #line::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  .go-button { color: var(--viewer-accent); }
  .view-toolbar { display: flex; align-items: center; flex-wrap: wrap; justify-content: space-between; gap: 0 16px; padding: 0 20px; }
  .tabs { display: flex; align-self: stretch; gap: 16px; }
  .tab { min-height: 40px; padding: 8px 1px; border: 0; border-bottom: 2px solid transparent; color: var(--viewer-muted); background: transparent; font-size: 12px; }
  .tab:hover { color: var(--viewer-text); }
  .tab.active { color: var(--viewer-text); border-bottom-color: var(--viewer-accent); }
  .fold-controls { display: flex; gap: 2px; }
  .fold-controls button { font-size: 11px; }
  .viewer-content { flex: 1; min-width: 0; padding: 20px; overflow-wrap: anywhere; }
  .document-surface { min-width: 0; }
  pre { margin: 0; color: var(--viewer-text); white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; tab-size: 2; font: 400 var(--vscode-editor-font-size, 13px)/1.75 var(--viewer-mono); font-variant-ligatures: none; }
  .pretty-json { padding-left: 18px; }
  .pretty-node { position: relative; }
  .fold-toggle { position: absolute; left: -18px; top: 0; width: 16px; height: 1.75em; padding: 0; border: 0; border-radius: 3px; background: transparent; color: var(--viewer-muted); font: inherit; }
  .fold-toggle::before { content: ''; display: inline-block; width: 5px; height: 5px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); }
  .fold-toggle[aria-expanded="true"]::before { transform: translateY(-2px) rotate(45deg); }
  .fold-toggle:hover { color: var(--viewer-accent); background: var(--viewer-hover); }
  .fold-placeholder::before { content: ' … '; color: var(--viewer-muted); }
  .key { color: var(--viewer-key); }
  .string { color: var(--viewer-string); }
  .number { color: var(--viewer-number); }
  .boolean { color: var(--viewer-boolean); }
  .null { color: var(--viewer-null); }
  .tree-surface { font: var(--vscode-editor-font-size, 13px)/1.75 var(--viewer-mono); font-variant-ligatures: none; }
  .tree-node { margin: 0; min-width: 0; }
  .tree-summary { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; position: relative; min-height: 28px; padding: 2px 6px 2px 20px; border-radius: 3px; list-style: none; cursor: pointer; }
  .tree-summary::-webkit-details-marker { display: none; }
  .tree-summary::before { content: ''; position: absolute; left: 5px; top: 11px; width: 5px; height: 5px; border-right: 1.5px solid var(--viewer-muted); border-bottom: 1.5px solid var(--viewer-muted); transform: rotate(-45deg); }
  .tree-node[open] > .tree-summary::before { top: 9px; transform: rotate(45deg); }
  .tree-summary:hover, .tree-row:hover { background: var(--viewer-hover); }
  .tree-kind, .tree-count { color: var(--viewer-muted); font-size: 11px; }
  .tree-count { font-family: var(--viewer-ui); }
  .tree-children { margin-left: 7px; padding-left: 12px; border-left: 1px solid var(--viewer-border); }
  .tree-row { padding: 3px 6px 3px 20px; border-radius: 3px; overflow-wrap: anywhere; }
  .tree-row > .key { margin-right: 8px; }
  .tree-value { white-space: pre-wrap; }
  .toolbar-meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px 16px; padding: 8px 20px; border-top: 1px solid var(--viewer-border); color: var(--viewer-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .state-panel { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 240px; padding: 32px 16px; color: var(--viewer-muted); text-align: center; }
  .state-symbol { margin-bottom: 4px; color: var(--viewer-muted); font: 22px var(--viewer-mono); }
  .state-symbol::before { content: '{}'; }
  .empty-state .state-symbol::before { content: '∅'; }
  .error-state .state-symbol::before { content: '!'; }
  .loading-state .state-symbol::before { content: '…'; }
  .state-title { color: var(--viewer-text); font-size: 13px; font-weight: 600; }
  .state-description { max-width: 520px; margin: 0; font-size: 12px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
  .error-state .state-symbol, .error { color: var(--viewer-error); }
  .error { white-space: pre-wrap; }
  body.vscode-high-contrast, body.vscode-high-contrast-light {
    --viewer-border: var(--vscode-contrastBorder, currentColor);
    --viewer-key: var(--viewer-text);
    --viewer-string: var(--viewer-text);
    --viewer-number: var(--viewer-text);
    --viewer-boolean: var(--viewer-text);
    --viewer-null: var(--viewer-text);
  }
  body.vscode-high-contrast button, body.vscode-high-contrast-light button { border: 1px solid var(--viewer-border); }
  body.vscode-high-contrast .tab.active, body.vscode-high-contrast-light .tab.active { border-bottom: 2px solid var(--viewer-focus); }
  @media (max-width: 480px) {
    .toolbar { padding: 10px 12px 4px; gap: 8px; }
    .brand { flex-basis: 100%; }
    .record-navigation { margin-left: auto; }
    .view-toolbar { padding: 0 12px; gap: 0 8px; }
    .tabs { gap: 12px; }
    .fold-controls button { padding: 3px 5px; }
    .viewer-content { padding: 16px 12px; }
    .toolbar-meta { padding: 8px 12px; }
  }
  @media (forced-colors: active) {
    button, input { border: 1px solid ButtonText; }
    .tab.active { border-bottom: 2px solid Highlight; }
    .tree-summary::before { border-color: CanvasText; }
    .tree-children { border-color: GrayText; }
  }
`;
