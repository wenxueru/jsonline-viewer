import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { JSDOM } from "jsdom";
import { viewerHtml } from "../viewerHtml";

function viewer(t: TestContext, fileName?: string) {
  const sent: unknown[] = [];
  const dom = new JSDOM(viewerHtml(fileName), {
    runScripts: "dangerously",
    beforeParse(window) {
      (window as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
        postMessage: (message: unknown) => sent.push(JSON.parse(JSON.stringify(message))),
      });
    },
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  const content = document.getElementById("content")!;
  const receive = (data: unknown) => window.dispatchEvent(new window.MessageEvent("message", { data }));
  const load = (raw: string, line = 1, lineCount = 2) => receive({
    type: "line", raw, line, lineCount, byteLength: Buffer.byteLength(raw), fileSize: 2048,
  });
  const click = (mode: string) => (document.querySelector(`[data-mode="${mode}"]`) as HTMLElement).click();
  return { window, document, content, receive, load, click, sent };
}

test("opens in Pretty with colored JSON tokens and readable string whitespace", t => {
  const view = viewer(t);
  const value = {
    'quoted"key': "first\nsecond\tvalue\r\nthird",
    literal: String.raw`literal\n`,
    number: -12.5,
    bool: true,
    nil: null,
    nested: [false, 1e21],
  };
  view.load(JSON.stringify(value));
  assert.equal(view.document.querySelector(".tab.active")?.getAttribute("data-mode"), "pretty");
  assert.equal(view.content.querySelector("pre")?.getAttribute("aria-label"), "Pretty JSON");
  assert.equal(view.content.querySelector(".key")?.textContent, '"quoted\\"key":');
  assert.equal(view.content.querySelector(".string")?.textContent, '"first\nsecond\tvalue\r\nthird"');
  assert.equal(view.content.querySelectorAll(".string")[1].textContent, JSON.stringify(value.literal));
  assert.deepEqual([...view.content.querySelectorAll(".number")].map(node => node.textContent), ["-12.5", "1e+21"]);
  assert.deepEqual([...view.content.querySelectorAll(".boolean")].map(node => node.textContent), ["true", "false"]);
  assert.equal(view.content.querySelector(".null")?.textContent, "null");
});

test("handles malformed and empty files, and recovers when the next row is valid", t => {
  const view = viewer(t);
  view.click("tree"); // No row yet: retain the indexing message.
  assert.match(view.content.textContent!, /Building/);
  view.click("pretty");
  view.load('{"broken":');
  assert.match(view.content.querySelector(".error")?.textContent!, /Invalid JSON on line 1/);
  view.click("raw");
  assert.equal(view.content.textContent, '{"broken":');
  view.click("pretty");
  view.load('null', 2);
  assert.equal(view.content.textContent, "null");
  view.receive({ type: "empty" });
  view.click("tree");
  view.click("pretty");
  assert.equal(view.content.textContent, "This file has no lines.");
});

test("tabs support keyboard navigation and expose the selected panel to assistive technology", t => {
  const view = viewer(t);
  view.load('{"nested":{"value":42}}');
  const tabs = [...view.document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const selectWithKey = (key: string) => {
    const selected = view.document.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')!;
    selected.dispatchEvent(new view.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  };
  const assertSelected = (mode: string) => {
    const selected = tabs.find(tab => tab.dataset.mode === mode)!;
    assert.equal(view.document.activeElement, selected);
    assert.equal(view.content.getAttribute("aria-labelledby"), selected.id);
    assert.equal(view.document.querySelectorAll('[role="tab"][aria-selected="true"]').length, 1);
    for (const tab of tabs) assert.equal(tab.tabIndex, tab === selected ? 0 : -1);
  };
  selectWithKey("ArrowRight");
  assertSelected("tree");
  assert.equal(view.content.querySelector("details")?.open, true);
  selectWithKey("End");
  assertSelected("raw");
  selectWithKey("ArrowRight");
  assertSelected("pretty");
  selectWithKey("ArrowLeft");
  assertSelected("raw");
  selectWithKey("Home");
  assertSelected("pretty");
});

test("navigation validates row bounds and disables controls while no record is available", t => {
  const view = viewer(t);
  const input = view.document.getElementById("line") as HTMLInputElement;
  const go = view.document.getElementById("go") as HTMLButtonElement;
  const prev = view.document.getElementById("prev") as HTMLButtonElement;
  const next = view.document.getElementById("next") as HTMLButtonElement;
  const assertDisabled = () => {
    for (const control of [input, go, prev, next]) assert.equal(control.disabled, true);
  };
  assertDisabled();
  assert.equal(view.content.getAttribute("aria-busy"), "true");
  view.load('{"value":1}', 2, 3);
  assert.equal(view.content.getAttribute("aria-busy"), "false");
  for (const control of [input, go, prev, next]) assert.equal(control.disabled, false);
  view.click("raw");
  next.click();
  assert.deepEqual(view.sent.at(-1), { type: "move", delta: 1 });
  view.load('{"value":2}', 3, 3);
  assert.equal(view.document.querySelector(".tab.active")?.getAttribute("data-mode"), "raw");
  assert.equal(view.content.textContent, '{"value":2}');
  assert.equal(next.disabled, true);
  prev.click();
  assert.deepEqual(view.sent.at(-1), { type: "move", delta: -1 });
  const sentBeforeInvalidInput = view.sent.length;
  for (const value of ["", "0", "-1", "1.5", "4"]) {
    input.value = value;
    go.click();
    input.dispatchEvent(new view.window.KeyboardEvent("keydown", { key: "Enter" }));
  }
  assert.equal(view.sent.length, sentBeforeInvalidInput);
  input.value = "3";
  input.dispatchEvent(new view.window.KeyboardEvent("keydown", { key: "Enter" }));
  assert.deepEqual(view.sent.at(-1), { type: "goto", line: 3 });
  view.receive({ type: "fatal", message: "Permission denied <file>" });
  assertDisabled();
  assert.equal(input.value, "");
  assert.equal(view.content.getAttribute("aria-busy"), "false");
  assert.match(view.content.textContent!, /Permission denied <file>/);
  view.click("tree");
  assert.match(view.content.textContent!, /Permission denied <file>/);
  view.load('{"recovered":true}', 1, 1);
  assert.equal(input.disabled, false);
  assert.equal(go.disabled, false);
  assert.equal(prev.disabled, true);
  assert.equal(next.disabled, true);
  view.receive({ type: "empty" });
  assertDisabled();
});

test("file names and JSON fields remain inert text in every mode, including large records", t => {
  const fileName = '\"><img src=x onerror="window.injected=true"> & records.jsonl';
  const view = viewer(t, fileName);
  const key = '<script>window.injected=true</script>';
  const text = '<img src=x onerror="alert(1)"></script><script>window.injected=true</script>' + "x".repeat(1024 * 1024);
  assert.equal(view.document.querySelector(".file-name")?.textContent, fileName);
  assert.equal(view.document.querySelector(".file-name")?.getAttribute("title"), fileName);
  view.load(JSON.stringify({ [key]: text }));
  for (const mode of ["pretty", "tree", "raw"]) {
    view.click(mode);
    assert.equal(view.content.querySelector("img, script"), null);
    assert.ok(view.content.textContent?.includes(key));
    assert.equal(view.content.querySelector(".string")?.textContent, JSON.stringify(text));
  }
});

test("Pretty folds nested values, preserves state across tabs, and resets for changed records", t => {
  const view = viewer(t);
  const value = { nested: { list: [{ text: 'braces {} [] and \\"quotes\\"', empty: {} }, []] }, tail: true };
  const raw = JSON.stringify(value);
  view.load(raw);
  const pre = view.content.querySelector("pre")!;
  assert.equal(pre.textContent, JSON.stringify(value, null, 2));
  const toggles = [...pre.querySelectorAll<HTMLButtonElement>(".fold-toggle")];
  assert.equal(toggles.length, 4); // Empty objects and arrays need no folding control.
  assert.equal((view.document.getElementById("fold-controls") as HTMLElement).hidden, false);
  const nested = toggles[1];
  const body = view.document.getElementById(nested.getAttribute("aria-controls")!)!;
  assert.equal(nested.parentElement?.querySelector(".key")?.textContent, '"nested":');
  nested.click();
  assert.equal(nested.getAttribute("aria-expanded"), "false");
  assert.equal(body.hidden, true);
  assert.equal(nested.getAttribute("aria-label"), "Expand object");
  assert.equal((nested.parentElement?.querySelector(".fold-placeholder") as HTMLElement).hidden, false);
  assert.equal((pre.querySelector(".pretty-body") as HTMLElement).hidden, false);
  view.click("raw");
  assert.equal((view.document.getElementById("fold-controls") as HTMLElement).hidden, true);
  view.click("pretty");
  assert.equal(view.content.querySelectorAll(".fold-toggle")[1].getAttribute("aria-expanded"), "false");
  (view.document.getElementById("collapse-all") as HTMLButtonElement).click();
  for (const toggle of view.content.querySelectorAll(".fold-toggle")) assert.equal(toggle.getAttribute("aria-expanded"), "false");
  (view.document.getElementById("expand-all") as HTMLButtonElement).click();
  for (const toggle of view.content.querySelectorAll(".fold-toggle")) assert.equal(toggle.getAttribute("aria-expanded"), "true");
  view.content.querySelectorAll<HTMLButtonElement>(".fold-toggle")[1].click();
  view.load(raw); // A repeated update for the same record keeps its fold state.
  assert.equal(view.content.querySelectorAll(".fold-toggle")[1].getAttribute("aria-expanded"), "false");
  view.load('{"changed":[1,2]}');
  assert.equal(view.content.querySelector("pre")?.textContent, '{\n  "changed": [\n    1,\n    2\n  ]\n}');
  assert.equal(view.content.querySelector(".fold-toggle")?.getAttribute("aria-expanded"), "true");
  view.load(raw, 2);
  assert.equal(view.content.querySelectorAll(".fold-toggle").length, 4);
  assert.equal(view.content.querySelectorAll(".pretty-body[hidden]").length, 0);
});

test("Raw highlights source without changing escapes, number precision, duplicate keys, or malformed text", t => {
  const view = viewer(t);
  const raw = String.raw`  { "text" : "a\n\t\u4e2d\\b\"<img>{}", "n":9007199254740993, "n":1.00e+09, "bool":false, "nil":null }  `;
  view.load(raw);
  view.click("raw");
  assert.equal(view.content.textContent, raw);
  assert.deepEqual([...view.content.querySelectorAll(".number")].map(node => node.textContent), ["9007199254740993", "1.00e+09"]);
  assert.equal(view.content.querySelector(".key")?.textContent, '"text" :');
  assert.equal(view.content.querySelector(".string")?.textContent, String.raw`"a\n\t\u4e2d\\b\"<img>{}"`);
  assert.equal(view.content.querySelector(".boolean")?.textContent, "false");
  assert.equal(view.content.querySelector(".null")?.textContent, "null");
  assert.equal(view.content.querySelector("img"), null);
  view.load('{"broken": true, "number": -2.5e-3, "unterminated');
  assert.equal(view.content.textContent, '{"broken": true, "number": -2.5e-3, "unterminated');
  assert.equal(view.content.querySelector(".boolean")?.textContent, "true");
  assert.equal(view.content.querySelector(".number")?.textContent, "-2.5e-3");
  assert.equal(view.content.querySelector(".error"), null);
  view.click("pretty");
  assert.match(view.content.querySelector(".error")?.textContent!, /Invalid JSON/);
  assert.equal((view.document.getElementById("fold-controls") as HTMLElement).hidden, true);
});

test("bulk folding works in Tree and controls disappear for scalar, empty, and fatal states", t => {
  const view = viewer(t);
  view.load('{"nested":{"list":[1,2]}}');
  view.click("tree");
  const branches = [...view.content.querySelectorAll("details")];
  assert.deepEqual(branches.map(branch => branch.open), [true, false, false]);
  (view.document.getElementById("expand-all") as HTMLButtonElement).click();
  assert.equal(view.content.querySelectorAll("details[open]").length, 3);
  (view.document.getElementById("collapse-all") as HTMLButtonElement).click();
  assert.equal(view.content.querySelectorAll("details[open]").length, 0);
  view.click("pretty");
  view.click("tree");
  assert.equal(view.content.querySelectorAll("details[open]").length, 0);
  view.click("pretty");
  for (const source of ['null', '42', '"text"', '{}', '[]']) {
    view.load(source);
    assert.equal((view.document.getElementById("fold-controls") as HTMLElement).hidden, true);
    assert.equal(view.content.textContent, source);
  }
  view.load('{"nested":[1]}');
  view.receive({ type: "empty" });
  assert.equal((view.document.getElementById("fold-controls") as HTMLElement).hidden, true);
  view.load('{"nested":[1]}');
  view.receive({ type: "fatal", message: "Unable to read" });
  assert.equal((view.document.getElementById("fold-controls") as HTMLElement).hidden, true);
});
