import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { JSDOM } from "jsdom";
import { viewerHtml } from "../viewerHtml";

function viewer(t: TestContext) {
  const sent: unknown[] = [];
  const dom = new JSDOM(viewerHtml(), {
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
  const load = (raw: string, line = 1, lineCount = 2) => window.dispatchEvent(new window.MessageEvent("message", {
    data: { type: "line", raw, line, lineCount, byteLength: Buffer.byteLength(raw), fileSize: 2048 },
  }));
  const click = (mode: string) => (document.querySelector(`[data-mode="${mode}"]`) as HTMLElement).click();
  return { window, document, content, load, click, sent };
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
  view.window.dispatchEvent(new view.window.MessageEvent("message", { data: { type: "empty" } }));
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
