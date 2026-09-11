import assert from "node:assert/strict";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { IndexedLineFile } from "../lineFile";

test("indexes LF/CRLF without creating a terminal phantom line", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jsonl-viewer-unit-"));
  try {
    const path = join(dir, "sample.jsonl");
    await writeFile(path, '{"a":1}\r\n{"b":2}\n');
    const file = await IndexedLineFile.open(path);
    assert.equal(file.lineCount, 2);
    assert.equal(await file.readLine(1), '{"a":1}');
    assert.equal(await file.readLine(2), '{"b":2}');
    await assert.rejects(file.readLine(3), RangeError);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("reads only the requested line from a 50 MiB+ file with 1 MiB records", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jsonl-viewer-large-"));
  try {
    const path = join(dir, "large.jsonl");
    const handle = await open(path, "w");
    const payload = "x".repeat(1024 * 1024);
    try {
      for (let i = 1; i <= 51; i++) {
        await handle.write(`${JSON.stringify({ line: i, payload })}\n`);
      }
    } finally {
      await handle.close();
    }
    const file = await IndexedLineFile.open(path);
    assert.equal(file.lineCount, 51);
    const value = JSON.parse(await file.readLine(37)) as { line: number; payload: string };
    assert.equal(value.line, 37);
    assert.equal(value.payload.length, 1024 * 1024);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("handles empty files and a blank line", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jsonl-viewer-empty-"));
  try {
    const emptyPath = join(dir, "empty.jsonl");
    const blankPath = join(dir, "blank.jsonl");
    await writeFile(emptyPath, "");
    await writeFile(blankPath, "\n");
    assert.equal((await IndexedLineFile.open(emptyPath)).lineCount, 0);
    const blank = await IndexedLineFile.open(blankPath);
    assert.equal(blank.lineCount, 1);
    assert.equal(await blank.readLine(1), "");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
