import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export interface StorageObjectMetadata {
  key: string;
  size: number;
  contentType: string;
  lastModified?: Date;
}

export interface StorageObjectResult {
  stream: NodeJS.ReadableStream;
  size: number;
  totalSize: number;
  contentType: string;
  start?: number;
  end?: number;
  isRange?: boolean;
}

export interface IStorageProvider {
  putObject(key: string, buffer: Buffer, contentType: string): Promise<{ key: string; size: number }>;
  getObject(key: string, range?: { start?: number; end?: number }): Promise<StorageObjectResult | null>;
  deleteObject(key: string): Promise<void>;
  hasObject(key: string): Promise<boolean>;
}

/**
 * Local Disk-backed S3-compatible storage provider.
 * Keeps uploaded documents strictly private in an isolated vault directory.
 */
export class LocalStorageProvider implements IStorageProvider {
  private baseDir: string;

  constructor(baseDir: string = path.join(process.cwd(), 'storage_vault')) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolvePath(key: string): string {
    // Prevent path traversal attacks
    const normalized = path.normalize(key).replace(/^(\.\.[\/\\])+/, '');
    return path.join(this.baseDir, normalized);
  }

  async putObject(key: string, buffer: Buffer, contentType: string): Promise<{ key: string; size: number }> {
    const fullPath = this.resolvePath(key);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(fullPath, buffer);

    // Save metadata sidecar for contentType tracking if needed
    const metaPath = `${fullPath}.meta.json`;
    await fs.promises.writeFile(
      metaPath,
      JSON.stringify({
        contentType,
        size: buffer.length,
        updatedAt: new Date().toISOString(),
      }),
      'utf-8'
    );

    return { key, size: buffer.length };
  }

  async getObject(key: string, range?: { start?: number; end?: number }): Promise<StorageObjectResult | null> {
    const fullPath = this.resolvePath(key);
    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const stat = await fs.promises.stat(fullPath);
    let contentType = 'application/octet-stream';

    const metaPath = `${fullPath}.meta.json`;
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'));
        if (meta.contentType) contentType = meta.contentType;
      } catch (e) {
        // Fallback to octet-stream
      }
    }

    if (range && (range.start !== undefined || range.end !== undefined)) {
      const start = range.start ?? 0;
      const end = range.end !== undefined ? Math.min(range.end, stat.size - 1) : stat.size - 1;
      const stream = fs.createReadStream(fullPath, { start, end });
      return {
        stream,
        size: end - start + 1,
        totalSize: stat.size,
        contentType,
        start,
        end,
        isRange: true,
      };
    }

    const stream = fs.createReadStream(fullPath);
    return {
      stream,
      size: stat.size,
      totalSize: stat.size,
      contentType,
      isRange: false,
    };
  }

  async deleteObject(key: string): Promise<void> {
    const fullPath = this.resolvePath(key);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
    const metaPath = `${fullPath}.meta.json`;
    if (fs.existsSync(metaPath)) {
      await fs.promises.unlink(metaPath).catch(() => {});
    }
  }

  async hasObject(key: string): Promise<boolean> {
    const fullPath = this.resolvePath(key);
    return fs.existsSync(fullPath);
  }
}

// Singleton storage provider instance
let storageInstance: IStorageProvider | null = null;

export function getStorageProvider(): IStorageProvider {
  if (!storageInstance) {
    storageInstance = new LocalStorageProvider();
  }
  return storageInstance;
}
