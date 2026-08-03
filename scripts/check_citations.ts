import {
  CheckResult,
  EntityRecord,
  clueLabel,
  isMain,
  loadDatasets,
  printResult,
} from "./dataset_utils.js";

const BIBLE_BOOKS = new Set([
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Chronicles",
  "2 Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalm",
  "Psalms",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation",
]);

const BOOK_PATTERN =
  "((?:[1-3] )?[A-Za-z]+(?: [A-Za-z]+)*)";
const VERSE_SELECTION_PATTERN =
  "[1-9]\\d*(?:-[1-9]\\d*)?(?:,\\s*[1-9]\\d*(?:-[1-9]\\d*)?)*";
const REFERENCE_PATTERN = new RegExp(
  `^${BOOK_PATTERN} ([1-9]\\d*):(${VERSE_SELECTION_PATTERN})$`,
);
const SINGLE_CHAPTER_PATTERN = new RegExp(
  `^${BOOK_PATTERN} (${VERSE_SELECTION_PATTERN})$`,
);
const CHAPTER_PATTERN = new RegExp(
  `^${BOOK_PATTERN} ([1-9]\\d*)(?:-([1-9]\\d*))?$`,
);
const PSALM_TITLE_PATTERN =
  /^(Psalm|Psalms) ([1-9]\d*):title$/;

const SINGLE_CHAPTER_BOOKS = new Set([
  "Obadiah",
  "Philemon",
  "2 John",
  "3 John",
  "Jude",
]);

const CHAPTER_COUNTS: Record<string, number> = {
  Genesis: 50,
  Exodus: 40,
  Leviticus: 27,
  Numbers: 36,
  Deuteronomy: 34,
  Joshua: 24,
  Judges: 21,
  Ruth: 4,
  "1 Samuel": 31,
  "2 Samuel": 24,
  "1 Kings": 22,
  "2 Kings": 25,
  "1 Chronicles": 29,
  "2 Chronicles": 36,
  Ezra: 10,
  Nehemiah: 13,
  Esther: 10,
  Job: 42,
  Psalm: 150,
  Psalms: 150,
  Proverbs: 31,
  Ecclesiastes: 12,
  "Song of Solomon": 8,
  Isaiah: 66,
  Jeremiah: 52,
  Lamentations: 5,
  Ezekiel: 48,
  Daniel: 12,
  Hosea: 14,
  Joel: 3,
  Amos: 9,
  Obadiah: 1,
  Jonah: 4,
  Micah: 7,
  Nahum: 3,
  Habakkuk: 3,
  Zephaniah: 3,
  Haggai: 2,
  Zechariah: 14,
  Malachi: 4,
  Matthew: 28,
  Mark: 16,
  Luke: 24,
  John: 21,
  Acts: 28,
  Romans: 16,
  "1 Corinthians": 16,
  "2 Corinthians": 13,
  Galatians: 6,
  Ephesians: 6,
  Philippians: 4,
  Colossians: 4,
  "1 Thessalonians": 5,
  "2 Thessalonians": 3,
  "1 Timothy": 6,
  "2 Timothy": 4,
  Titus: 3,
  Philemon: 1,
  Hebrews: 13,
  James: 5,
  "1 Peter": 5,
  "2 Peter": 3,
  "1 John": 5,
  "2 John": 1,
  "3 John": 1,
  Jude: 1,
  Revelation: 22,
};

function validateVerseSelection(
  selection: string,
  reference: string,
  clueLabel: string,
  result: CheckResult,
): void {
  const seen = new Set<string>();

  for (const selector of selection.split(/,\s*/)) {
    const [startVerse, endVerse] = selector.split("-");

    if (
      endVerse !== undefined &&
      Number(endVerse) < Number(startVerse)
    ) {
      result.errors.push(
        `${clueLabel}: verse range runs backward "${reference}"`,
      );
    }

    if (seen.has(selector)) {
      result.errors.push(
        `${clueLabel}: repeated verse selection "${selector}" in "${reference}"`,
      );
    }

    seen.add(selector);
  }
}

export function checkCitations(
  records: EntityRecord[],
): CheckResult {
  const result: CheckResult = { errors: [], warnings: [] };

  for (const record of records) {
    if (!Array.isArray(record.entity?.clues)) {
      continue;
    }

    record.entity.clues.forEach((clue, clueIndex) => {
      const currentClueLabel = clueLabel(record, clueIndex);

      if (
        typeof clue?.citations !== "string" ||
        !clue.citations.trim()
      ) {
        result.errors.push(
          `${currentClueLabel}: citations are required`,
        );
        return;
      }

      const references = clue.citations.split("; ");
      const seen = new Set<string>();

      if (references.join("; ") !== clue.citations) {
        result.errors.push(
          `${currentClueLabel}: references must be separated by "; "`,
        );
      }

      for (const reference of references) {
        const match = REFERENCE_PATTERN.exec(reference);
        const singleChapterMatch =
          SINGLE_CHAPTER_PATTERN.exec(reference);
        const chapterMatch = CHAPTER_PATTERN.exec(reference);
        const psalmTitleMatch =
          PSALM_TITLE_PATTERN.exec(reference);
        const isSingleChapterVerse =
          singleChapterMatch !== null &&
          SINGLE_CHAPTER_BOOKS.has(singleChapterMatch[1]);

        if (
          !match &&
          !isSingleChapterVerse &&
          !chapterMatch &&
          !psalmTitleMatch
        ) {
          result.errors.push(
            `${currentClueLabel}: invalid citation format "${reference}"`,
          );
          continue;
        }

        const book =
          match?.[1] ??
          (isSingleChapterVerse
            ? singleChapterMatch?.[1]
            : undefined) ??
          chapterMatch?.[1] ??
          psalmTitleMatch?.[1] ??
          "";

        if (!BIBLE_BOOKS.has(book)) {
          result.errors.push(
            `${currentClueLabel}: unrecognized Bible book "${book}"`,
          );
        }

        const chapter =
          match?.[2] ??
          (!isSingleChapterVerse
            ? chapterMatch?.[2]
            : undefined) ??
          psalmTitleMatch?.[2];
        const endChapter = !isSingleChapterVerse
          ? chapterMatch?.[3]
          : undefined;
        const chapterCount = CHAPTER_COUNTS[book];

        if (
          chapter !== undefined &&
          chapterCount !== undefined &&
          Number(chapter) > chapterCount
        ) {
          result.errors.push(
            `${currentClueLabel}: chapter does not exist in "${reference}"`,
          );
        }

        if (
          endChapter !== undefined &&
          chapterCount !== undefined &&
          Number(endChapter) > chapterCount
        ) {
          result.errors.push(
            `${currentClueLabel}: chapter does not exist in "${reference}"`,
          );
        }

        if (
          chapter !== undefined &&
          endChapter !== undefined &&
          Number(endChapter) < Number(chapter)
        ) {
          result.errors.push(
            `${currentClueLabel}: chapter range runs backward "${reference}"`,
          );
        }

        const verseSelection =
          match?.[3] ??
          (isSingleChapterVerse
            ? singleChapterMatch?.[2]
            : undefined);

        if (verseSelection !== undefined) {
          validateVerseSelection(
            verseSelection,
            reference,
            currentClueLabel,
            result,
          );
        }

        if (seen.has(reference)) {
          result.errors.push(
            `${currentClueLabel}: repeated citation "${reference}"`,
          );
        }

        seen.add(reference);
      }
    });
  }

  return result;
}

if (isMain(import.meta.url)) {
  const loaded = loadDatasets(process.argv[2]);
  const result = checkCitations(loaded.records);
  result.errors.unshift(...loaded.errors);
  printResult("Citation check", result, loaded.files.length);
}
