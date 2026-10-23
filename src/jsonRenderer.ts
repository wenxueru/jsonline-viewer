export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type ViewMode = "pretty" | "tree" | "raw";

export interface JsonView {
  element: HTMLElement;
  foldable: boolean;
  setExpanded(expanded: boolean): void;
}

// Embedded in the webview by viewerHtml; keep runtime dependencies inside this function.
export function renderJson(mode: ViewMode, value: JsonValue, raw: string): JsonView {
  const folds: Array<(expanded: boolean) => void> = [];

  function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = ""): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.textContent = text;
    node.className = className;
    return node;
  }

  function scalar(value: JsonValue): HTMLSpanElement {
    const className = value === null ? "null" : typeof value;
    const text = typeof value === "string" ? JSON.stringify(value) : String(value);
    return element("span", text, className);
  }

  function tree(value: JsonValue, name?: string, root = false): HTMLElement {
    if (value === null || typeof value !== "object") {
      const row = element("div", "", "tree-row");
      if (name !== undefined) row.append(element("span", name + ": ", "key"));
      const text = scalar(value);
      text.classList.add("tree-value");
      row.append(text);
      return row;
    }
    const isArray = Array.isArray(value);
    const entries = Object.entries(value);
    const details = element("details", "", root ? "tree-node tree-root" : "tree-node");
    details.open = root;
    folds.push(expanded => { details.open = expanded; });
    const label = isArray ? "item" : "key";
    const summary = element("summary", "", "tree-summary");
    if (name !== undefined) summary.append(element("span", name + ": ", "key"));
    summary.append(
      element("span", isArray ? "Array" : "Object", "tree-kind"),
      element("span", entries.length + " " + label + (entries.length === 1 ? "" : "s"), "tree-count"),
    );
    const children = element("div", "", "tree-children");
    for (const [key, child] of entries) children.append(tree(child, key));
    details.append(summary, children);
    return details;
  }

  function createFold(opening: string, offset: number) {
    const node = element("span", "", "pretty-node");
    const toggle = element("button", "", "fold-toggle");
    const body = element("span", "", "pretty-body");
    const placeholder = element("span", "", "fold-placeholder");
    const kind = opening === "{" ? "object" : "array";
    toggle.type = "button";
    body.id = "pretty-fold-" + offset;
    toggle.setAttribute("aria-controls", body.id);
    placeholder.setAttribute("aria-hidden", "true");

    function setExpanded(expanded: boolean) {
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.title = (expanded ? "Collapse " : "Expand ") + kind;
      toggle.setAttribute("aria-label", toggle.title);
      body.hidden = !expanded;
      placeholder.hidden = expanded;
    }
    setExpanded(true);
    toggle.onclick = () => setExpanded(body.hidden);
    folds.push(setExpanded);
    node.append(toggle, opening, placeholder, body);
    return { node, body };
  }

  function tokenClass(text: string): string {
    if (text[0] === '"') return text.endsWith(":") ? "key" : "string";
    if (text === "null") return "null";
    if (text === "true" || text === "false") return "boolean";
    return "number";
  }

  function highlighted(source: string, pretty: boolean): HTMLPreElement {
    const pre = element("pre", "", pretty ? "pretty-json" : "raw-json");
    pre.setAttribute("aria-label", pretty ? "Pretty JSON" : "Raw JSON");
    const tokens = /"(?:\\.|[^"\\])*"(?:\s*:)?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b|[{}\[\]]/g;
    const whitespace: Record<string, string> = { "\\n": "\n", "\\r": "\r", "\\t": "\t" };
    const stack: Array<{ parent: HTMLElement; node: HTMLSpanElement }> = [];
    let parent: HTMLElement = pre;
    let pendingKey: HTMLSpanElement | undefined;
    let offset = 0;

    // Scan the source directly: Raw must retain numeric precision, duplicate keys and malformed text.
    for (const match of source.matchAll(tokens)) {
      const text = match[0];
      const gap = source.slice(offset, match.index);
      const key = pendingKey;
      pendingKey = undefined;
      if (!key) parent.append(gap);

      const opening = text === "{" || text === "[";
      const closing = text === "}" || text === "]";
      const empty = opening && source[match.index + 1] === (text === "{" ? "}" : "]");
      if (pretty && opening && !empty) {
        const fold = createFold(text, match.index);
        // Include the field name so its arrow sits in the indentation gutter.
        if (key) fold.node.prepend(key, gap);
        parent.append(fold.node);
        stack.push({ parent, node: fold.node });
        parent = fold.body;
      } else {
        if (key) parent.append(key, gap);
        if (pretty && closing && source[match.index - 1] !== "{" && source[match.index - 1] !== "[") {
          const container = stack.pop()!;
          container.node.append(text);
          parent = container.parent;
        } else if (opening || closing) {
          parent.append(text);
        } else {
          const className = tokenClass(text);
          const display = pretty && className === "string"
            ? text.replace(/\\(?:u[0-9a-fA-F]{4}|.)/g, escape => whitespace[escape] ?? escape)
            : text;
          const token = element("span", display, className);
          if (pretty && className === "key") pendingKey = token;
          else parent.append(token);
        }
      }
      offset = match.index + text.length;
    }
    parent.append(source.slice(offset));
    return pre;
  }

  const surface = element("div", "", "document-surface " + mode + "-surface");
  switch (mode) {
    case "tree": surface.append(tree(value, undefined, true)); break;
    case "pretty": surface.append(highlighted(JSON.stringify(value, null, 2), true)); break;
    case "raw": surface.append(highlighted(raw, false)); break;
  }
  return {
    element: surface,
    foldable: folds.length > 0,
    setExpanded(expanded) { for (const setExpanded of folds) setExpanded(expanded); },
  };
}
