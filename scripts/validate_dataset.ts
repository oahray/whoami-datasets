import {
  CheckResult,
  DIFFICULTIES,
  EntityRecord,
  clueLabel,
  entityLabel,
  isMain,
  loadDatasets,
  printResult,
} from "./dataset_utils.js";

const VALID_DIFFICULTIES = new Set<string>(DIFFICULTIES);
const VALID_TYPES = new Set(["character", "place"]);

export function validateStructure(
  records: EntityRecord[],
): CheckResult {
  const result: CheckResult = { errors: [], warnings: [] };

  for (const record of records) {
    const entity = record.entity;
    const label = entityLabel(record);

    if (!entity || typeof entity !== "object") {
      result.errors.push(`${label}: entity must be an object`);
      continue;
    }

    if (typeof entity.name !== "string" || !entity.name.trim()) {
      result.errors.push(`${label}: name is required`);
    }

    if (!Array.isArray(entity.aliases)) {
      result.errors.push(`${label}: aliases must be an array`);
    } else {
      entity.aliases.forEach((alias, aliasIndex) => {
        if (typeof alias !== "string" || !alias.trim()) {
          const aliasLine =
            record.aliasLines[aliasIndex] ?? record.line;
          result.errors.push(
            `${record.filePath}:${aliasLine} -> ${entity.name}: alias ${aliasIndex + 1} must be a nonblank string`,
          );
        }
      });
    }

    if (!VALID_TYPES.has(entity.type)) {
      result.errors.push(
        `${label}: invalid type "${String(entity.type)}"`,
      );
    }

    if (typeof entity.is_published !== "boolean") {
      result.errors.push(`${label}: is_published must be boolean`);
    }

    if (!Array.isArray(entity.clues)) {
      result.errors.push(`${label}: clues must be an array`);
      continue;
    }

    if (entity.clues.length < 3) {
      result.errors.push(`${label}: must contain at least 3 clues`);
    }

    entity.clues.forEach((clue, clueIndex) => {
      const currentClueLabel = clueLabel(record, clueIndex);

      if (typeof clue?.text !== "string" || !clue.text.trim()) {
        result.errors.push(`${currentClueLabel}: text is required`);
      }

      if (
        typeof clue?.citations !== "string" ||
        !clue.citations.trim()
      ) {
        result.errors.push(
          `${currentClueLabel}: citations are required`,
        );
      }

      if (!VALID_DIFFICULTIES.has(clue?.difficulty)) {
        result.errors.push(
          `${currentClueLabel}: invalid difficulty "${String(clue?.difficulty)}"`,
        );
      }
    });
  }

  return result;
}

if (isMain(import.meta.url)) {
  const loaded = loadDatasets(process.argv[2]);
  const result = validateStructure(loaded.records);
  result.errors.unshift(...loaded.errors);
  printResult("Structure validation", result, loaded.files.length);
}