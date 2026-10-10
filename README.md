<div align="center">
  <img src="resources/icon.png" alt="JSONLine Viewer icon" width="112" height="112">
  <h1>JSONLine Viewer</h1>
  <p><strong>One record at a time. Easier to read. Ready for large files.</strong></p>
  <p>A read-only VS Code extension for inspecting <code>.jsonl</code> and <code>.ndjson</code> files.</p>
  <p>
    <img src="https://img.shields.io/badge/VS%20Code-1.85%2B-007ACC" alt="VS Code 1.85 or later">
    <img src="https://img.shields.io/badge/Node.js-20%2B-43853D" alt="Node.js 20 or later for development">
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2bcedd" alt="MIT license"></a>
  </p>
</div>

![Pretty preview with colored JSON values and a multiline string](resources/preview.png)

*Illustrated Pretty preview, generated from the actual renderer with fictional sample data.*

## Why JSONLine Viewer?

- **Pretty by default.** Open a record with JSON syntax highlighting. Newlines and tabs inside strings display as actual whitespace.
- **Follow the cursor.** Move between source rows or edit a record; the preview follows, including unsaved edits.
- **Browse large files.** Index byte offsets once, then read the selected record without retaining the complete file in memory.
- **Choose your view.** Use Pretty for reading, Tree for folding objects, and Raw for the exact source line.
- **Keep browsing through errors.** A malformed record shows its parse error without blocking other rows.

## Quick start

After installing the extension:

1. Open a `.jsonl` or `.ndjson` file.
2. Place the cursor on a record.
3. Click the **Preview** icon in the editor's upper-right toolbar.

A **Pretty** preview opens beside the source. Use **Previous**, **Next**, or **Line → Go** to navigate.

To browse a large file without opening it as text, run **JSONLine Viewer: Open File** from the Command Palette. The viewer performs one indexing pass and opens in Pretty mode. The Explorer right-click menu stays unchanged.

### Try a sample

Save this one-line record as `sample.jsonl` and click **Preview**:

```json
{"id":"sample-001","score":0.98,"is_reasoning":true,"messages":[{"role":"user","content":"Explain this record.\nKeep the answer short."}],"metadata":null}
```

Pretty displays the content string on two lines. Switch to Raw to see the original `\n` escape.

## Views

| View | Use it for |
| --- | --- |
| **Pretty** · default | Highlighted, indented JSON with readable line breaks and tabs in strings |
| **Tree** | Expand or collapse objects and arrays |
| **Raw** | The unchanged source record, including JSON escapes |
| **Native JSON Preview** | VS Code's JSON editor: folding, bracket matching, diagnostics, and Find |

Run **JSONLine Viewer: Native JSON Preview** while the source file is active. Its editor-title arrows and **Go to Row** command navigate between records; the status bar shows the current row and total count.

## Install from source

Requires **Node.js 20+** for development and **VS Code 1.85+** to run the extension.

```bash
npm ci
npm run package
code --install-extension ./large-jsonl-viewer.vsix --force
```

The package command compiles the extension, runs the tests, and creates `large-jsonl-viewer.vsix`. Reload the VS Code window after installation.

**Remote SSH:** install the VSIX in the connected remote environment so the extension runs on the host that contains your files, then reload that window.

## Development

```bash
npm run compile
npm test
```

Tests cover LF/CRLF indexing, empty files, and a generated file larger than 50 MiB with records exceeding 1 MiB. DOM tests cover syntax highlighting, string whitespace, Raw source preservation, mode switching, navigation, invalid JSON, and HTML-like strings in large records.

## Limits

- All views are read-only and accept filesystem-backed `file:` URIs, including paths on a Remote SSH extension host.
- Indexing is linear in file size. Index memory grows with the number of rows; navigating reads only the requested record.
- Pretty unescapes string whitespace for display. Use **Raw** when you need the unchanged JSON source.

## License

[MIT](LICENSE)
