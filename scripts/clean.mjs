import { rm } from "node:fs/promises";

for (const name of ["dist", "large-jsonl-viewer.vsix"]) {
  await rm(new URL(`../${name}`, import.meta.url), { recursive: true, force: true });
}
