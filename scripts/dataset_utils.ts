import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import {
  findNodeAtLocation,
  parseTree,
} from "jsonc-parser";

export const DIFFICULTIES = [
  "easy",
  "medium",
  "hard",
  "nightmare",
] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

export interface Clue {
  text: string;
  citations: string;
  difficulty: Difficulty;
}

export interface Entity {
  name: string;
  aliases: string[];
  type: "character" | "place";
  is_published: boolean;
  clues: Clue[];
}

export interface EntityRecord {
  entity: Entity;
  filePath: string;
  index: number;
  line: number;
  aliasLines: number[];
  clueLines: number[];
}

export interface LoadResult {
  records: EntityRecord[];
  files: string[];
  errors: string[];
}

export interface CheckResult {
  errors: string[];
  warnings: string[];
}

const DATASET_ROOT = path.join(process.cwd(), "datasets");

function walk(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return walk(fullPath);
      }

      return entry.isFile() && entry.name.endsWith(".json")
        ? [fullPath]
        : [];
    })
    .sort();
}

export function collectFiles(inputPath?: string): {
  files: string[];
  errors: string[];
} {
  const resolved = inputPath
    ? path.resolve(inputPath)
    : DATASET_ROOT;

  if (!fs.existsSync(resolved)) {
    return { files: [], errors: [`Path not found: ${resolved}`] };
  }

  const stat = fs.statSync(resolved);

  if (stat.isFile()) {
    return resolved.endsWith(".json")
      ? { files: [resolved], errors: [] }
      : { files: [], errors: ["Provided file must be a JSON file"] };
  }

  if (stat.isDirectory()) {
    return { files: walk(resolved), errors: [] };
  }

  return {
    files: [],
    errors: ["Provided path must be a file or directory"],
  };
}

export function loadDatasets(inputPath?: string): LoadResult {
  const collected = collectFiles(inputPath);
  const records: EntityRecord[] = [];
  const errors = [...collected.errors];

  for (const filePath of collected.files) {
    const raw = fs.readFileSync(filePath, "utf8");
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      errors.push(`${filePath}: invalid JSON`);
      continue;
    }

    if (!Array.isArray(parsed)) {
      errors.push(`${filePath}: root must be an array`);
      continue;
    }

    const rootNode = parseTree(raw);
    const lineStarts = [0];

    for (let offset = 0; offset < raw.length; offset += 1) {
      if (raw[offset] === "\n") {
        lineStarts.push(offset + 1);
      }
    }

    const lineAt = (offset: number | undefined): number => {
      if (offset === undefined) {
        return 1;
      }

      let low = 0;
      let high = lineStarts.length - 1;

      while (low <= high) {
        const middle = Math.floor((low + high) / 2);

        if (lineStarts[middle] <= offset) {
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }

      return high + 1;
    };

    parsed.forEach((entity, index) => {
      const entityNode = rootNode?.children?.[index];
      const findEntityNode = (path: (string | number)[]) =>
        entityNode
          ? findNodeAtLocation(entityNode, path)
          : undefined;
      const aliases = Array.isArray((entity as Entity)?.aliases)
        ? (entity as Entity).aliases
        : [];
      const clues = Array.isArray((entity as Entity)?.clues)
        ? (entity as Entity).clues
        : [];

      records.push({
        entity: entity as Entity,
        filePath,
        index,
        line: lineAt(
          findEntityNode(["name"])?.offset ??
            entityNode?.offset,
        ),
        aliasLines: aliases.map((_, aliasIndex) =>
          lineAt(
            findEntityNode(["aliases", aliasIndex])?.offset,
          ),
        ),
        clueLines: clues.map((_, clueIndex) =>
          lineAt(
            findEntityNode([
              "clues",
              clueIndex,
              "text",
            ])?.offset ??
              findEntityNode(["clues", clueIndex])?.offset,
          ),
        ),
      });
    });
  }

  return {
    records,
    files: collected.files,
    errors,
  };
}

export function entityLabel(record: EntityRecord): string {
  const name =
    typeof record.entity?.name === "string"
      ? record.entity.name
      : `entity ${record.index + 1}`;

  return `${record.filePath}:${record.line} -> ${name}`;
}

export function clueLabel(
  record: EntityRecord,
  clueIndex: number,
): string {
  const line = record.clueLines[clueIndex] ?? record.line;

  return `${record.filePath}:${line} -> ${record.entity.name} -> clue ${clueIndex + 1}`;
}

export function isMain(metaUrl: string): boolean {
  return Boolean(
    process.argv[1] &&
      metaUrl === pathToFileURL(path.resolve(process.argv[1])).href,
  );
}

export function printResult(
  title: string,
  result: CheckResult,
  filesChecked: number,
): void {
  if (result.warnings.length > 0) {
    console.warn(`\n${title} warnings:\n`);
    result.warnings.forEach((warning) =>
      console.warn(`- ${warning}`),
    );
  }

  if (result.errors.length > 0) {
    console.error(`\n${title} failed:\n`);
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log(`${title} passed (${filesChecked} files checked)`);
}
