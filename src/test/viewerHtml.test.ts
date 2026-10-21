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

test("Raw preserves exact source, Tree folds, and navigation keeps the selected mode", t => {
  const view = viewer(t);
  const raw = '  {"text":"line 1\\nline 2","nested":{"value":42}}  ';
  view.load(raw);
  view.click("raw");
  assert.equal(view.content.textContent, raw);
  view.load('{"next":true}', 2);
  assert.equal(view.content.textContent, '{"next":true}');
  assert.equal((view.document.getElementById("next") as HTMLButtonElement).disabled, true);
  view.click("tree");
  assert.equal(view.content.querySelector("details")?.open, true);
  view.load(raw);
  assert.equal(view.content.querySelectorAll("details")[1].open, false);
  view.click("pretty");
  assert.equal(view.content.querySelector(".string")?.textContent, '"line 1\nline 2"');
  (view.document.getElementById("next") as HTMLButtonElement).click();
  assert.deepEqual(view.sent.at(-1), { type: "move", delta: 1 });
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

test("renders HTML-like strings and escaped quotes as text, including large records", t => {
  const view = viewer(t);
  const payload = '<img src=x onerror="alert(1)"></script><script>window.injected=true</script>\n' + "x".repeat(1024 * 1024);
  view.load(JSON.stringify({ text: payload }));
  assert.equal(view.content.querySelector("img, script"), null);
  assert.equal(view.content.querySelector(".string")?.textContent, JSON.stringify(payload).replace('\\n', '\n'));
  assert.equal(view.content.querySelectorAll(".string").length, 1);
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

test("file names and tree fields remain inert text inside the webview", t => {
  const fileName = '\"><img src=x onerror="window.injected=true"> & records.jsonl';
  const view = viewer(t, fileName);
  assert.equal(view.document.querySelector(".file-name")?.textContent, fileName);
  assert.equal(view.document.querySelector(".file-name")?.getAttribute("title"), fileName);
  view.load(JSON.stringify({ '<script>window.injected=true</script>': '<img src=x onerror="alert(1)">' }));
  view.click("tree");
  assert.equal(view.document.querySelector("img"), null);
  assert.equal(view.document.querySelectorAll("script").length, 1);
  assert.equal(view.content.querySelector(".key")?.textContent, "<script>window.injected=true</script>: ");
  assert.equal(view.content.querySelector(".string")?.textContent, JSON.stringify('<img src=x onerror="alert(1)">'));
});
