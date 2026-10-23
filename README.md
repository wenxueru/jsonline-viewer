<div align="center">
  <img src="resources/icon.png" alt="JSONLine Viewer icon" width="112" height="112">
  <h1>JSONLine Viewer</h1>
  <p><strong>English</strong> | <a href="README.zh-CN.md">简体中文</a></p>
  <p><strong>One record at a time. Easier to read. Ready for large files.</strong></p>
  <p>A read-only VS Code extension for inspecting <code>.jsonl</code> and <code>.ndjson</code> files.</p>
  <p>
    <img src="https://img.shields.io/badge/VS%20Code-1.85%2B-007ACC" alt="VS Code 1.85 or later">
    <img src="https://img.shields.io/badge/Node.js-20%2B-43853D" alt="Node.js 20 or later for development">
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2bcedd" alt="MIT license"></a>
  </p>
</div>

| Dark | Light |
| --- | --- |
| ![Dark preview](resources/preview.png) | ![Light preview](resources/preview-light.png) |

*Rendered from the fictional records in [examples/sample.jsonl](examples/sample.jsonl).*

## Try it

1. Open [examples/sample.jsonl](examples/sample.jsonl) in VS Code, or use any `.jsonl` / `.ndjson` file.
2. Place the cursor on a record and click **Preview** in the editor toolbar, or run **JSONLine Viewer: Preview** from the Command Palette.
3. Read the record in the side panel. Move the source cursor, use the previous / next arrows, or enter a **Record** number and click **Go**.

The preview follows source edits, including unsaved changes. Each physical line is a separate JSON record.

The included sample contains three records:

| Record | Try this |
| --- | --- |
| 1 | Fold `messages` or `metadata`; read multiline English and Chinese text in Pretty. |
| 2 | Expand nested arrays and inspect empty objects, empty arrays, and a literal `\n`. |
| 3 | Switch to Raw to inspect whitespace, duplicate keys, a large integer, and exponent notation exactly as written. |

All sample content is fictional and contains no credentials or personal data.

## Views and controls

| View | Purpose |
| --- | --- |
| **Pretty** · default | Indented, highlighted JSON. Objects and arrays can be folded; string line breaks and tabs display as actual whitespace. |
| **Tree** | Explore objects and arrays as expandable fields. |
| **Raw** | Highlighted original text, preserving whitespace, escapes, duplicate keys, and numeric precision. |
| **Native JSON Preview** | Use VS Code's JSON editor for folding, bracket matching, diagnostics, and Find. |

- **Folding:** Pretty and Tree support individual toggles and **Expand all / Collapse all**. Each view retains its fold state while switching views within the same record.
- **Invalid records:** Pretty and Tree show the parse error. Raw remains available, and navigation still works.
- **Native preview:** with the source editor active, run **JSONLine Viewer: Native JSON Preview**. Navigate with its editor-title arrows or **Go to Row...**.
- **Appearance:** automatically follows the current VS Code theme, including dark, light, and high contrast. Theme changes apply immediately. A compact toolbar keeps navigation and folding close to the content; record details sit in the footer.

Pretty and Tree display parsed JSON. Use Raw whenever exact source representation matters.

## Large files

Run **JSONLine Viewer: Open File** to browse without opening the entire file in the text editor.

- One scan builds a byte-offset index; navigation then reads only the selected record.
- Indexing time grows with file size, index memory with row count, and rendering memory with the current record's size.
- All views are read-only and support filesystem-backed `file:` URIs, including files on a Remote SSH host.

## Build and install

Requires **Node.js 20+** to build and **VS Code 1.85+** to run.

```bash
npm ci
npm run package
code --install-extension ./large-jsonl-viewer.vsix --force
```

Run **Developer: Reload Window** after installation. To open the sample locally:

```bash
code examples/sample.jsonl
```

For **Remote SSH**, install the VSIX in the connected remote environment, then reload that window. The extension must run on the host containing the file.

## Development

| Command | Action |
| --- | --- |
| `npm run compile` | Type-check and compile into `dist/`. |
| `npm test` | Compile and run indexing and viewer behavior tests. |
| `npm run package` | Clean, compile, test, and create `large-jsonl-viewer.vsix`. |
| `npm run clean` | Remove generated build and package output. |

## License

[MIT](LICENSE)
