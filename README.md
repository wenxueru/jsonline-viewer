# JSONLine Viewer

A fast, read-only VS Code extension for inspecting `.jsonl` and `.ndjson` files one record at a time. Format the row under your cursor as a native JSON document, or browse very large files through an indexed viewer without loading the complete file into memory.

## Highlights

- **Native JSON preview** — syntax highlighting, formatting, folding, bracket matching, diagnostics, and Find are provided by VS Code's JSON editor.
- **Cursor following** — move between rows in the source file and the preview updates automatically.
- **Row navigation** — use Previous, Next, or Go to Row from the preview editor title bar. The status bar shows the current row and total row count.
- **Large-file viewer** — build a compact byte-offset index and read only the selected record.
- **Multiple representations** — inspect an indexed record as a collapsible tree, pretty-printed JSON, or its raw source line.
- **Per-row errors** — malformed records are shown without preventing access to the rest of the file.

## Usage

### Preview the row under the cursor

1. Open a `.jsonl` or `.ndjson` file in the normal text editor.
2. Place the cursor on the record you want to inspect.
3. Click the **Preview** icon in the editor title bar.
4. A read-only, formatted `.json` preview opens beside the source file.

While the preview is open, moving the source cursor updates it immediately. Use the arrow icons to move to the previous or next record, or click **Go to Row** (or the JSONL row indicator in the status bar) to jump directly.

### Browse without opening the source as text

Run **JSONLine Viewer: Open File** from the Command Palette, or right-click a `.jsonl` / `.ndjson` file in Explorer. This mode performs one sequential indexing pass, then reads records on demand. Index memory grows with the number of records rather than total file size.

| Mode | Best for | Views |
| --- | --- | --- |
| Editor-title Preview | Inspecting the row selected in an open source file | Native formatted JSON |
| Open File | Browsing large files independently of the text editor | Tree, Pretty, Raw |

## Install

Install the prebuilt VSIX:

```bash
code --install-extension large-jsonl-viewer.vsix
```

When using VS Code Remote SSH, run this command in the remote VS Code terminal so the extension is installed on the remote extension host. Reload the VS Code window after installation.

## Development

Requires Node.js 20 or later.

```bash
npm install
npm test
npm run package
```

`npm test` compiles the TypeScript and exercises line indexing against LF/CRLF, empty files, and a generated file larger than 50 MiB whose individual JSON records exceed 1 MiB. `npm run package` also creates `large-jsonl-viewer.vsix`.

## Design and limitations

- Both preview modes are intentionally read-only.
- It currently accepts filesystem-backed `file:` URIs. It does not read virtual filesystem providers.
- **Open File** indexing is linear in file size. Moving between indexed lines is independent of total file size.
- **Open File** parses the selected line in its webview. Native Preview formats the selected line in the extension host and exposes it through a read-only virtual JSON document.
