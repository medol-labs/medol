import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, normalize, resolve } from 'node:path';
import { parseMedolSources, readMedolImports, type MedolSource } from './dslParser';
import type { EmModel } from './model';

export interface MedolProjectFileSystem {
  readFile(path: string): string;
  resolveImport(importer: string, imported: string): string;
}

const nodeFileSystem: MedolProjectFileSystem = {
  readFile: (path) => readFileSync(path, 'utf8'),
  resolveImport: (importer, imported) =>
    normalize(isAbsolute(imported) ? imported : resolve(dirname(importer), imported))
};

export const parseMedolFile = (
  entryPath: string,
  fileSystem: MedolProjectFileSystem = nodeFileSystem
): EmModel => {
  const entry = normalize(resolve(entryPath));
  const sources: MedolSource[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const diagnostics: string[] = [];

  const visit = (path: string, chain: string[]): void => {
    if (visited.has(path)) return;
    if (visiting.has(path)) {
      diagnostics.push(`Circular import: ${[...chain, path].join(' -> ')}.`);
      return;
    }

    visiting.add(path);
    let text: string;
    try {
      text = fileSystem.readFile(path);
    } catch (error) {
      diagnostics.push(`Unable to import ${path}: ${error instanceof Error ? error.message : String(error)}.`);
      visiting.delete(path);
      return;
    }

    for (const imported of readMedolImports(text)) {
      visit(fileSystem.resolveImport(path, imported), [...chain, path]);
    }
    visiting.delete(path);
    visited.add(path);
    sources.push({ sourceName: path, text });
  };

  visit(entry, []);
  const model = parseMedolSources(sources);
  model.diagnostics.unshift(...diagnostics);
  return model;
};

