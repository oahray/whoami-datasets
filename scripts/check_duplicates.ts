import {
  CheckResult,
  EntityRecord,
  clueLabel,
  entityLabel,
  isMain,
  loadDatasets,
  printResult,
} from "./dataset_utils.js";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "for",
  "from",
  "i",
  "in",
  "is",
  "me",
  "my",
  "of",
  "on",
  "the",
  "that",
  "to",
  "was",
  "were",
  "with",
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function meaningfulTokens(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((token) => token && !STOP_WORDS.has(token)),
  );
}

function jaccard(left: Set<string>, right: Set<string>): number {
  const intersection = [...left].filter((token) =>
    right.has(token),
  ).length;
  const union = new Set([...left, ...right]).size;

  return union === 0 ? 0 : intersection / union;
}

function checkEntityClues(
  record: EntityRecord,
  result: CheckResult,
): void {
  if (!Array.isArray(record.entity?.clues)) {
    return;
  }

  const clues = record.entity.clues
    .map((clue, index) => ({ clue, index }))
    .filter(
      ({ clue }) =>
        typeof clue?.text === "string" && clue.text.trim(),
    );

  for (let leftIndex = 0; leftIndex < clues.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < clues.length;
      rightIndex += 1
    ) {
      const leftEntry = clues[leftIndex];
      const rightEntry = clues[rightIndex];
      const left = leftEntry.clue.text;
      const right = rightEntry.clue.text;
      const rightLine =
        record.clueLines[rightEntry.index] ?? record.line;

      if (normalize(left) === normalize(right)) {
        result.errors.push(
          `${clueLabel(record, leftEntry.index)}: duplicate of clue ${rightEntry.index + 1} at ${record.filePath}:${rightLine}; "${left}"`,
        );
        continue;
      }

      const leftTokens = meaningfulTokens(left);
      const rightTokens = meaningfulTokens(right);

      if (
        Math.min(leftTokens.size, rightTokens.size) >= 3 &&
        jaccard(leftTokens, rightTokens) >= 0.8
      ) {
        result.warnings.push(
          `${clueLabel(record, leftEntry.index)}: possible near-duplicate of clue ${rightEntry.index + 1} at ${record.filePath}:${rightLine}; "${left}" and "${right}"`,
        );
      }
    }
  }
}

export function checkDuplicates(
  records: EntityRecord[],
): CheckResult {
  const result: CheckResult = { errors: [], warnings: [] };
  const names = new Map<string, string>();

  for (const record of records) {
    const label = entityLabel(record);
    const name =
      typeof record.entity?.name === "string"
        ? normalize(record.entity.name)
        : "";

    if (name) {
      const previous = names.get(name);

      if (previous) {
        result.errors.push(
          `${label}: duplicate entity name; first seen at ${previous}`,
        );
      } else {
        names.set(name, label);
      }
    }

    if (Array.isArray(record.entity?.aliases)) {
      const aliases = new Map<string, number>();

      record.entity.aliases.forEach((alias, aliasIndex) => {
        if (typeof alias !== "string") {
          return;
        }

        const normalized = normalize(alias);
        const previousIndex = aliases.get(normalized);

        if (previousIndex !== undefined) {
          const line =
            record.aliasLines[aliasIndex] ?? record.line;
          const previousLine =
            record.aliasLines[previousIndex] ?? record.line;
          result.errors.push(
            `${record.filePath}:${line} -> ${record.entity.name}: duplicate alias "${alias}"; first seen at ${record.filePath}:${previousLine}`,
          );
        }

        aliases.set(normalized, aliasIndex);
      });
    }

    checkEntityClues(record, result);
  }

  return result;
}

if (isMain(import.meta.url)) {
  const loaded = loadDatasets(process.argv[2]);
  const result = checkDuplicates(loaded.records);
  result.errors.unshift(...loaded.errors);
  printResult("Duplicate check", result, loaded.files.length);
}
