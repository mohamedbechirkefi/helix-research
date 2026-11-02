// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
/** Node-only helpers for build scripts: paths, git state, the file-system cache store. */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { KeyValueStore } from "@helix/data-adapters";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const USER_AGENT = "helix-research";

export function gitState(): { commit: string | null; dirty: boolean | null } {
  try {
    const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: REPO_ROOT, encoding: "utf8" }).trim().length > 0;
    return { commit, dirty };
  } catch {
    return { commit: null, dirty: null };
  }
}

/** KeyValueStore on the local file system (keys become relative paths under `root`). */
export class FsStore implements KeyValueStore {
  readonly root: string;
  constructor(root: string) {
    this.root = root;
  }
  private path(key: string): string {
    if (key.includes("..")) throw new Error(`invalid cache key ${key}`);
    return join(this.root, key);
  }
  async get(key: string): Promise<string | null> {
    try {
      return await readFile(this.path(key), "utf8");
    } catch {
      return null;
    }
  }
  async set(key: string, value: string): Promise<void> {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, value);
  }
  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }
  async keys(prefix: string): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: string, rel: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) await walk(join(dir, e.name), r);
        else if (r.startsWith(prefix)) out.push(r);
      }
    };
    await walk(this.root, "");
    return out.sort();
  }
}
