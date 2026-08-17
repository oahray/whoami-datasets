import {
  CheckResult,
  EntityRecord,
  clueLabel,
  isMain,
  loadDatasets,
  printResult,
} from "./dataset_utils.js";

/** Strip parenthetical disambiguators: "Darius (the Mede)" -> "Darius". */
export function nameWithoutParentheses(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Terms that must not appear in an entity's own clue text:
 * the primary name without parentheses, plus every alias (also without parentheses).
 */
export function forbiddenSelfTerms(entity: {
  name?: unknown;
  aliases?: unknown;
}): string[] {
  const terms = new Set<string>();

  if (typeof entity.name === "string" && entity.name.trim()) {
    const base = nameWithoutParentheses(entity.name);
    if (base) {
      terms.add(base);
    }
  }

  if (Array.isArray(entity.aliases)) {
    for (const alias of entity.aliases) {
      if (typeof alias !== "string" || !alias.trim()) {
        continue;
      }
      terms.add(alias.trim());
      const base = nameWithoutParentheses(alias);
      if (base) {
        terms.add(base);
      }
    }
  }

  return [...terms].sort((a, b) => b.length - a.length);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-term match; allows possessives like David's / Lot's. */
export function findForbiddenTerm(
  text: string,
  term: string,
): RegExpMatchArray | null {
  if (!term.trim()) {
    return null;
  }

  const pattern = new RegExp(
    `(?<![\\w'])${escapeRegExp(term)}(?:['\u2019]s)?(?![\\w'])`,
    "i",
  );
  return text.match(pattern);
}

export function checkSelfNames(records: EntityRecord[]): CheckResult {
  const result: CheckResult = { errors: [], warnings: [] };

  for (const record of records) {
    if (!Array.isArray(record.entity?.clues)) {
      continue;
    }

    const terms = forbiddenSelfTerms(record.entity);

    record.entity.clues.forEach((clue, clueIndex) => {
      if (typeof clue?.text !== "string" || !clue.text.trim()) {
        return;
      }

      for (const term of terms) {
        const match = findForbiddenTerm(clue.text, term);
        if (match) {
          result.errors.push(
            `${clueLabel(record, clueIndex)}: clue must not contain the entity name or alias "${term}"`,
          );
          break;
        }
      }
    });
  }

  return result;
}

if (isMain(import.meta.url)) {
  const loaded = loadDatasets(process.argv[2]);
  const result = checkSelfNames(loaded.records);
  result.errors.unshift(...loaded.errors);
  printResult("Self-name check", result, loaded.files.length);
}
