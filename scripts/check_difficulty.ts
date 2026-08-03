import {
  CheckResult,
  DIFFICULTIES,
  Difficulty,
  EntityRecord,
  clueLabel,
  entityLabel,
  isMain,
  loadDatasets,
  printResult,
} from "./dataset_utils.js";

const DIFFICULTY_ORDER = new Map(
  DIFFICULTIES.map((difficulty, index) => [difficulty, index]),
);

export function checkDifficulty(
  records: EntityRecord[],
): CheckResult {
  const result: CheckResult = { errors: [], warnings: [] };

  for (const record of records) {
    if (!Array.isArray(record.entity?.clues)) {
      continue;
    }

    const label = entityLabel(record);
    const counts = new Map<Difficulty, number>(
      DIFFICULTIES.map((difficulty) => [difficulty, 0]),
    );
    let previousOrder = -1;

    record.entity.clues.forEach((clue, clueIndex) => {
      const order = DIFFICULTY_ORDER.get(clue?.difficulty);

      if (order === undefined) {
        result.errors.push(
          `${clueLabel(record, clueIndex)}: invalid difficulty "${String(clue?.difficulty)}"`,
        );
        return;
      }

      counts.set(
        clue.difficulty,
        (counts.get(clue.difficulty) ?? 0) + 1,
      );

      if (order < previousOrder) {
        result.errors.push(
          `${clueLabel(record, clueIndex)}: "${clue.difficulty}" clue appears after a harder difficulty`,
        );
      }

      previousOrder = Math.max(previousOrder, order);
    });

    for (const difficulty of DIFFICULTIES) {
      const count = counts.get(difficulty) ?? 0;

      if (count > 0 && count < 3) {
        result.errors.push(
          `${label}: requires at least 3 ${difficulty} clues; found ${count}`,
        );
      }
    }
  }

  return result;
}

if (isMain(import.meta.url)) {
  const loaded = loadDatasets(process.argv[2]);
  const result = checkDifficulty(loaded.records);
  result.errors.unshift(...loaded.errors);
  printResult("Difficulty check", result, loaded.files.length);
}
