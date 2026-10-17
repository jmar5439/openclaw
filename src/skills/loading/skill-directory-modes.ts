import fs from "node:fs";
import path from "node:path";
import { root } from "@openclaw/fs-safe/root";
import { openRootFileSync } from "../../infra/boundary-file-read.js";

export async function ensureWritableSkillDirectories(
  skillsDir: string,
  relativePath: string,
<<<<<<< HEAD
  assertCurrent?: () => void,
  sourceMode?: number,
=======
>>>>>>> test/all-fixes-2026.9.8
): Promise<void> {
  if (process.platform === "win32") {
    return;
  }
  const fixedRoot = path.join(
    await fs.promises.realpath(path.dirname(skillsDir)),
    path.basename(skillsDir),
  );
<<<<<<< HEAD
  assertCurrent?.();
  const boundary = await root(fixedRoot);
  assertCurrent?.();
  if (boundary.rootReal !== fixedRoot) {
    throw new Error("Skill directory root must not be a symbolic link");
  }
  const visit = async (relativeDir: string, initialMode?: number): Promise<void> => {
    const scopedPath = `.${path.sep}${relativeDir}`;
    const stat = await boundary.stat(scopedPath);
    assertCurrent?.();
=======
  const boundary = await root(fixedRoot);
  if (boundary.rootReal !== fixedRoot) {
    throw new Error("Skill directory root must not be a symbolic link");
  }
  const visit = async (relativeDir: string): Promise<void> => {
    const scopedPath = `.${path.sep}${relativeDir}`;
    const stat = await boundary.stat(scopedPath);
>>>>>>> test/all-fixes-2026.9.8
    if (stat.isSymbolicLink || !stat.isDirectory) {
      return;
    }
    const opened = openRootFileSync({
      absolutePath: path.join(fixedRoot, relativeDir),
      rootPath: fixedRoot,
      rootRealPath: fixedRoot,
      boundaryLabel: "skills directory",
      allowedType: "directory",
      symlinks: "reject",
    });
    if (!opened.ok) {
      throw new Error("Could not open skill directory safely", { cause: opened.error });
    }
    try {
      // Sealed release copies (including legacy sandboxes) need writable directories, not files.
<<<<<<< HEAD
      const writableMode = (initialMode ?? opened.stat.mode) | 0o700;
      if (opened.stat.mode !== writableMode) {
        assertCurrent?.();
        fs.fchmodSync(opened.fd, writableMode);
=======
      if ((opened.stat.mode & 0o700) !== 0o700) {
        fs.fchmodSync(opened.fd, opened.stat.mode | 0o700);
>>>>>>> test/all-fixes-2026.9.8
      }
    } finally {
      fs.closeSync(opened.fd);
    }
<<<<<<< HEAD
    const children = await boundary.list(scopedPath, { withFileTypes: true });
    assertCurrent?.();
    for (const child of children) {
=======
    for (const child of await boundary.list(scopedPath, { withFileTypes: true })) {
>>>>>>> test/all-fixes-2026.9.8
      if (child.isDirectory && !child.isSymbolicLink) {
        await visit(path.join(relativeDir, child.name));
      }
    }
  };
<<<<<<< HEAD
  await visit(relativePath, sourceMode);
=======
  await visit(relativePath);
>>>>>>> test/all-fixes-2026.9.8
}
