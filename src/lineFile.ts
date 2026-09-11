import { createReadStream, promises as fs } from "node:fs";

export interface IndexProgress {
  bytesRead: number;
  totalBytes: number;
}

/** A byte-offset line index. File contents are never retained in memory. */
export class IndexedLineFile {
  private constructor(
    readonly path: string,
    readonly size: number,
    private readonly starts: number[],
  ) {}

  static async open(
    path: string,
    onProgress?: (progress: IndexProgress) => void,
  ): Promise<IndexedLineFile> {
    const stat = await fs.stat(path);
    if (!stat.isFile()) {
      throw new Error("The selected path is not a regular file.");
    }
    if (!Number.isSafeInteger(stat.size)) {
      throw new Error("The file is too large for safe byte offsets in Node.js.");
    }

    const starts: number[] = stat.size === 0 ? [] : [0];
    let offset = 0;
    let lastProgress = 0;
    const stream = createReadStream(path, { highWaterMark: 4 * 1024 * 1024 });

    for await (const chunk of stream) {
      const bytes = chunk as Buffer;
      let newline = bytes.indexOf(0x0a);
      while (newline !== -1) {
        starts.push(offset + newline + 1);
        newline = bytes.indexOf(0x0a, newline + 1);
      }
      offset += bytes.length;
      if (onProgress && offset - lastProgress >= 16 * 1024 * 1024) {
        lastProgress = offset;
        onProgress({ bytesRead: offset, totalBytes: stat.size });
      }
    }

    // A terminal LF ends the final real line; it does not create a phantom line.
    if (starts.at(-1) === stat.size) {
      starts.pop();
    }
    onProgress?.({ bytesRead: stat.size, totalBytes: stat.size });
    return new IndexedLineFile(path, stat.size, starts);
  }

  get lineCount(): number {
    return this.starts.length;
  }

  async readLine(lineNumber: number): Promise<string> {
    if (!Number.isInteger(lineNumber) || lineNumber < 1 || lineNumber > this.lineCount) {
      throw new RangeError(`Line must be between 1 and ${this.lineCount}.`);
    }
    const index = lineNumber - 1;
    const start = this.starts[index];
    const end = index + 1 < this.starts.length ? this.starts[index + 1] : this.size;
    let length = end - start;
    const handle = await fs.open(this.path, "r");
    try {
      const buffer = Buffer.allocUnsafe(length);
      let read = 0;
      while (read < length) {
        const result = await handle.read(buffer, read, length - read, start + read);
        if (result.bytesRead === 0) break;
        read += result.bytesRead;
      }
      length = read;
      if (length > 0 && buffer[length - 1] === 0x0a) length--;
      if (length > 0 && buffer[length - 1] === 0x0d) length--;
      return buffer.subarray(0, length).toString("utf8");
    } finally {
      await handle.close();
    }
  }
}
