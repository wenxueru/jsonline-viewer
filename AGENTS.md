# Project guidance

- Keep the extension read-only and preserve public commands and preview behavior.
- `viewerHtml.ts` owns HTML and CSP; `viewerClient.ts` owns record state and interaction; `jsonRenderer.ts` owns JSON rendering and folding.
- Browser functions are serialized into the inline script. Keep them self-contained: no imported runtime values or module-level dependencies.
- Keep mutable browser state inside the viewer instance. Folding state belongs to the current record and survives view switching, not record changes.
- Raw must preserve the exact source text, including whitespace, escapes, duplicate keys, and numeric precision.
- Preserve byte-offset indexing and selected-record reads for large files.
- Prefer direct data flow and cohesive helpers; avoid speculative abstractions, redundant validation, hashes, and snapshots.
- Test observable behavior and meaningful edge cases; merge overlapping tests instead of asserting implementation details.
- Keep `README.md` and `README.zh-CN.md` consistent, concise, and organized around user workflows.
- Run `npm test` for verification; `npm run package` verifies and builds the VSIX; `npm run clean` removes generated build and package output.
- After successful verification, replace the installed extension directly. Do not keep backups of older versions.
