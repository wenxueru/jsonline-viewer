/** Self-contained webview palette: JSON stays readable even with a transparent editor theme. */
export const viewerStyles = String.raw`
  :root {
    color-scheme: dark;
    --viewer-bg: transparent;
    --viewer-toolbar: rgba(17, 24, 32, .82);
    --viewer-surface: rgba(23, 31, 41, .68);
    --viewer-raised: #202c3a;
    --viewer-hover: #263446;
    --viewer-border: #2b3949;
    --viewer-rule: #243141;
    --viewer-text: #d7e1ed;
    --viewer-muted: #94a5b9;
    --viewer-faint: #7e90a7;
    --viewer-accent: #9dc6f4;
    --viewer-accent-bg: #293e56;
    --viewer-focus: #94c5ff;
    --viewer-key: #a9ccf1;
    --viewer-string: #a5d8c0;
    --viewer-number: #e7c08b;
    --viewer-boolean: #c4b1ed;
    --viewer-null: #91a1b6;
    --viewer-error: #f0acac;
    --viewer-selection: #36516e;
    --viewer-mono: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
    --viewer-ui: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
  }
  body.vscode-light {
    color-scheme: light;
    --viewer-bg: transparent;
    --viewer-toolbar: rgba(241, 244, 248, .82);
    --viewer-surface: rgba(255, 255, 255, .72);
    --viewer-raised: #edf1f6;
    --viewer-hover: #e3eaf3;
    --viewer-border: #d3dce8;
    --viewer-rule: #e2e8f0;
    --viewer-text: #27364a;
    --viewer-muted: #5c6e84;
    --viewer-faint: #687b92;
    --viewer-accent: #285c94;
    --viewer-accent-bg: #e0ebf8;
    --viewer-focus: #2568aa;
    --viewer-key: #315f98;
    --viewer-string: #237052;
    --viewer-number: #926018;
    --viewer-boolean: #7850a3;
    --viewer-null: #68788d;
    --viewer-error: #b33f4b;
    --viewer-selection: #d3e5fa;
  }
  *, *::before, *::after { box-sizing: border-box; }
  html { min-height: 100%; background: transparent !important; }
  body {
    margin: 0;
    min-width: 240px;
    min-height: 100vh;
    color: var(--viewer-text);
    background: var(--viewer-bg) !important;
    font: 13px/1.5 var(--viewer-ui);
    -webkit-font-smoothing: antialiased;
  }
  ::selection { color: var(--viewer-text); background: var(--viewer-selection); }
  button, input { font: inherit; }
  button { -webkit-appearance: none; appearance: none; cursor: pointer; transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease; }
  button, input, summary { -webkit-tap-highlight-color: transparent; }
  button:focus-visible, input:focus-visible, summary:focus-visible, [tabindex]:focus-visible {
    outline: 2px solid var(--viewer-focus);
    outline-offset: 3px;
  }
  button:disabled { opacity: .36; cursor: default; }
  .app-shell { min-height: 100vh; background: var(--viewer-bg) !important; }
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px 24px;
    min-height: 76px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--viewer-border);
    background: var(--viewer-toolbar) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  .brand { display: flex; align-items: center; gap: 11px; min-width: 150px; }
  .brand-mark {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 35px;
    width: 35px;
    height: 35px;
    border: 1px solid var(--viewer-border);
    border-radius: 10px;
    background: var(--viewer-raised);
    color: var(--viewer-accent);
    font: 600 17px/1 var(--viewer-mono);
    letter-spacing: -2px;
    padding-right: 2px;
  }
  .brand-copy { display: flex; flex-direction: column; min-width: 0; gap: 1px; }
  .brand-copy strong { color: var(--viewer-text); font-size: 13px; font-weight: 650; letter-spacing: .1px; }
  .file-name { max-width: 220px; overflow: hidden; color: var(--viewer-muted); text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
  .record-navigation { display: flex; align-items: center; gap: 6px; }
  .icon-button, .go-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    min-width: 32px;
    padding: 0 10px;
    border: 1px solid var(--viewer-border);
    border-radius: 7px;
    color: var(--viewer-text);
    background: var(--viewer-surface);
    line-height: 1;
  }
  .icon-button svg { width: 15px; height: 15px; }
  .icon-button:not(:disabled):hover { background: var(--viewer-hover); border-color: var(--viewer-faint); }
  .line-control {
    display: flex;
    align-items: center;
    gap: 9px;
    height: 32px;
    margin-left: 6px;
    padding-left: 10px;
    border-left: 1px solid var(--viewer-border);
    color: var(--viewer-muted);
    font-size: 12px;
    white-space: nowrap;
  }
  #line {
    width: 76px;
    height: 32px;
    padding: 0 9px;
    border: 1px solid var(--viewer-border);
    border-radius: 7px;
    color: var(--viewer-text);
    background: var(--viewer-surface);
    font: 12px/1 var(--viewer-mono);
    font-variant-numeric: tabular-nums;
    appearance: textfield;
    -moz-appearance: textfield;
  }
  #line::-webkit-inner-spin-button, #line::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  #line:hover { border-color: var(--viewer-faint); }
  .go-button { border-color: transparent; color: var(--viewer-accent); background: var(--viewer-accent-bg); font-size: 12px; font-weight: 600; }
  .go-button:not(:disabled):hover { border-color: var(--viewer-accent); }
  .toolbar-meta { margin-left: auto; color: var(--viewer-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  #status { display: inline-flex; flex-direction: column; align-items: flex-end; gap: 1px; }
  .line-count { color: var(--viewer-faint); font-size: 11px; font-variant-numeric: tabular-nums; }
  .status-position { color: var(--viewer-text); font-weight: 600; }
  .status-detail { color: var(--viewer-muted); }
  .view-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 24px; background: var(--viewer-bg) !important; }
  .tabs { display: inline-flex; flex: 0 0 auto; gap: 3px; padding: 3px; border: 1px solid var(--viewer-border); border-radius: 9px; background: var(--viewer-surface); }
  .tab { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 28px; padding: 4px 14px; border: 1px solid transparent; border-radius: 6px; color: var(--viewer-muted); background: transparent; font-size: 12px; font-weight: 550; }
  .tab:hover { color: var(--viewer-text); background: var(--viewer-raised); }
  .tab.active { color: var(--viewer-accent); background: var(--viewer-accent-bg); }
  .view-caption { color: var(--viewer-faint); font-size: 11px; text-align: right; }
  .viewer-content { padding: 0 24px 28px; overflow-wrap: anywhere; }
  .document-surface { min-height: 220px; padding: 22px 24px 28px; border: 1px solid var(--viewer-border); border-radius: 11px; background: var(--viewer-surface) !important; }
  pre {
    margin: 0;
    color: var(--viewer-muted);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    tab-size: 2;
    font-family: var(--viewer-mono);
    font-size: var(--vscode-editor-font-size, 13px);
    font-weight: 400;
    line-height: 1.8;
    font-variant-ligatures: none;
  }
  .raw-json { color: var(--viewer-text); }
  .key { color: var(--viewer-key); }
  .string { color: var(--viewer-string); }
  .number { color: var(--viewer-number); }
  .boolean { color: var(--viewer-boolean); }
  .null { color: var(--viewer-null); font-style: italic; }
  .tree-surface, .tree-root { color: var(--viewer-text); font: var(--vscode-editor-font-size, 13px)/1.85 var(--viewer-mono); font-variant-ligatures: none; }
  .tree-node { margin: 0; min-width: 0; }
  .tree-summary { display: flex; align-items: baseline; flex-wrap: wrap; gap: 7px; position: relative; min-height: 30px; padding: 2px 8px 2px 22px; border-radius: 5px; list-style: none; cursor: pointer; }
  .tree-summary::-webkit-details-marker { display: none; }
  .tree-summary::before { content: ''; position: absolute; left: 7px; top: 12px; width: 5px; height: 5px; border-right: 1.5px solid var(--viewer-muted); border-bottom: 1.5px solid var(--viewer-muted); transform: rotate(-45deg); }
  .tree-node[open] > .tree-summary::before { top: 10px; transform: rotate(45deg); }
  .tree-summary:hover { background: var(--viewer-raised); }
  .tree-kind { color: var(--viewer-muted); font-size: .9em; }
  .tree-count { display: inline-block; align-self: center; padding: 0 6px; border: 1px solid var(--viewer-border); border-radius: 5px; color: var(--viewer-faint); font: 10px/17px var(--viewer-ui); font-variant-numeric: tabular-nums; }
  .tree-children { margin: 0 0 3px 9px; padding: 0 0 0 13px; border-left: 1px solid var(--viewer-rule); }
  .tree-row { padding: 3px 8px 3px 22px; border-radius: 5px; overflow-wrap: anywhere; }
  .tree-row:hover { background: var(--viewer-raised); }
  .tree-row > .key { margin-right: 8px; }
  .tree-value { white-space: pre-wrap; }
  .state-panel { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 280px; padding: 40px 24px; border: 1px solid var(--viewer-border); border-radius: 11px; color: var(--viewer-muted); background: var(--viewer-surface); text-align: center; }
  .state-symbol { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin-bottom: 7px; border: 1px solid var(--viewer-border); border-radius: 12px; color: var(--viewer-accent); background: var(--viewer-raised); font: 20px/1 var(--viewer-mono); }
  .state-symbol::before { content: '{}'; }
  .empty-state .state-symbol::before { content: '∅'; font-size: 25px; }
  .error-state .state-symbol::before { content: '!'; font-size: 23px; font-weight: 600; }
  .loading-state .state-symbol::before { content: ''; width: 18px; height: 18px; border: 2px solid var(--viewer-border); border-top-color: var(--viewer-accent); border-radius: 50%; }
  .state-title { margin: 0; color: var(--viewer-text); font-size: 14px; font-weight: 600; }
  .state-description { max-width: 540px; margin: 0; color: var(--viewer-muted); font-size: 12px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
  .error-state .state-symbol, .error-state .state-title, .error { color: var(--viewer-error); }
  .error { white-space: pre-wrap; }
  .error-state .state-description { font-family: var(--viewer-mono); }
  body.vscode-high-contrast, body.vscode-high-contrast-light {
    --viewer-bg: var(--vscode-editor-background, #000000);
    --viewer-toolbar: var(--vscode-editor-background, #000000);
    --viewer-surface: var(--vscode-editor-background, #000000);
    --viewer-raised: var(--vscode-input-background, #151515);
    --viewer-hover: var(--vscode-list-hoverBackground, #242424);
    --viewer-text: var(--vscode-editor-foreground, #ffffff);
    --viewer-muted: var(--vscode-editor-foreground, #ffffff);
    --viewer-faint: var(--vscode-descriptionForeground, #d0d0d0);
    --viewer-border: var(--vscode-contrastBorder, #ffffff);
    --viewer-rule: var(--vscode-contrastBorder, #ffffff);
    --viewer-accent: var(--vscode-textLink-foreground, #75beff);
    --viewer-accent-bg: var(--vscode-button-background, #094771);
    --viewer-focus: var(--vscode-focusBorder, #f38518);
    --viewer-key: var(--vscode-editor-foreground, #ffffff);
    --viewer-string: var(--vscode-editor-foreground, #ffffff);
    --viewer-number: var(--vscode-editor-foreground, #ffffff);
    --viewer-boolean: var(--vscode-editor-foreground, #ffffff);
    --viewer-null: var(--vscode-editor-foreground, #ffffff);
    --viewer-error: var(--vscode-errorForeground, #ff9a9a);
    --viewer-selection: var(--vscode-editor-selectionBackground, #264f78);
  }
  body.vscode-high-contrast-light { color-scheme: light; }
  body.vscode-high-contrast .tab.active, body.vscode-high-contrast .go-button,
  body.vscode-high-contrast-light .tab.active, body.vscode-high-contrast-light .go-button { color: var(--vscode-button-foreground, #ffffff); }
  body.vscode-high-contrast .tab.active, body.vscode-high-contrast-light .tab.active { border-color: var(--viewer-focus); }
  @media (max-width: 760px) {
    .toolbar { gap: 12px 18px; padding: 14px 18px; }
    .brand { min-width: 128px; }
    .toolbar-meta { width: 100%; margin-left: 0; padding-top: 1px; }
    #status { align-items: flex-start; }
    .view-toolbar { padding: 14px 18px; }
    .viewer-content { padding: 0 18px 22px; }
    .document-surface { padding: 18px; }
  }
  @media (max-width: 420px) {
    .toolbar { gap: 12px; padding: 14px 12px; }
    .brand { width: 100%; }
    .brand-copy { flex-direction: row; align-items: baseline; gap: 10px; }
    .file-name { max-width: 180px; }
    .record-navigation { width: 100%; gap: 4px; }
    .line-control { flex: 1; min-width: 0; gap: 6px; margin-left: 2px; padding-left: 6px; }
    .line-count { flex: 0 1 auto; max-width: 72px; overflow: hidden; text-overflow: ellipsis; }
    #line { flex: 1; min-width: 42px; width: 60px; }
    .toolbar-meta { font-size: 10px; }
    .view-toolbar { gap: 10px; padding: 12px; }
    .view-caption { max-width: 95px; font-size: 10px; }
    .tab { padding: 4px 10px; }
    .viewer-content { padding: 0 12px 18px; }
    .document-surface { padding: 14px 12px 20px; border-radius: 8px; }
    .tree-children { padding-left: 8px; }
    .tree-summary { gap: 5px; }
    .state-panel { min-height: 240px; padding: 28px 16px; }
  }
  @media (prefers-reduced-motion: reduce) { button { transition: none; } }
  @media (forced-colors: active) {
    button, input, .tabs, .document-surface, .state-panel, .brand-mark { border: 1px solid CanvasText; }
    .tab.active { outline: 1px solid Highlight; }
    .tree-summary::before { border-color: CanvasText; }
    .tree-children { border-color: GrayText; }
  }
`;
