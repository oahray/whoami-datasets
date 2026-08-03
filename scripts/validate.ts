import { checkCitations } from "./check_citations.js";
import { checkDifficulty } from "./check_difficulty.js";
import { checkDuplicates } from "./check_duplicates.js";
import {
  CheckResult,
  loadDatasets,
  printResult,
} from "./dataset_utils.js";
import { validateStructure } from "./validate_dataset.js";

function mergeResults(results: CheckResult[]): CheckResult {
  return {
    errors: results.flatMap((result) => result.errors),
    warnings: results.flatMap((result) => result.warnings),
  };
}

const loaded = loadDatasets(process.argv[2]);
const result = mergeResults([
  validateStructure(loaded.records),
  checkDuplicates(loaded.records),
  checkCitations(loaded.records),
  checkDifficulty(loaded.records),
]);

result.errors.unshift(...loaded.errors);
printResult("Dataset validation", result, loaded.files.length);
