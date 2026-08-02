import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules", "coverage", "dist", "out", "target"]);
const allowedRepositoryOwners = new Set(["LycaonLLC", "roycorp", "usr-bin-roygbiv"]);
const machineNodePattern = /\bk3s-(?:epyc|worker)-\d+\b/gu;
const semanticT4TailnetPattern = /\bt4-[a-z0-9-]+\.tailb18de3\.ts\.net\b/giu;
const repositoryPattern = /(?<![A-Za-z0-9_.-])([A-Za-z0-9_.-]+)\/t4-code\b/gu;

async function sourceFiles(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await sourceFiles(path, files);
    } else if (entry.isFile() && (await stat(path)).size <= 2_000_000) {
      files.push(path);
    }
  }
  return files;
}

function matchesFor(path, text) {
  const matches = [];
  for (const value of text.matchAll(machineNodePattern)) {
    matches.push({ file: path, kind: "machine-node", value: value[0] });
  }
  for (const value of text.matchAll(semanticT4TailnetPattern)) {
    matches.push({ file: path, kind: "semantic-tailnet-host", value: value[0] });
  }
  for (const value of text.matchAll(repositoryPattern)) {
    if (!allowedRepositoryOwners.has(value[1])) {
      matches.push({ file: path, kind: "repository-owner", value: value[1] });
    }
  }
  return matches;
}

test("public source contains no machine names or personal repository owners", async () => {
  const matches = [];
  for (const path of await sourceFiles(repoRoot)) {
    const bytes = await readFile(path);
    if (bytes.includes(0)) continue;
    matches.push(...matchesFor(relative(repoRoot, path), bytes.toString("utf8")));
  }

  assert.deepEqual(matches, []);
});
