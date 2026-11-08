/**
 * Question Explorer: the AnswerThePublic method. Each modifier is added to the
 * seed keyword and sent to Google's search-box suggestions; what Google
 * completes is what people actually type around the topic.
 */

export const QUESTION_EXPLORER_LANGUAGES = ["nl", "fr", "de", "en"] as const;
type QuestionExplorerLanguage = (typeof QUESTION_EXPLORER_LANGUAGES)[number];

export const QUESTION_EXPLORER_LANGUAGE_LABELS: Record<
  QuestionExplorerLanguage,
  string
> = {
  nl: "Dutch",
  fr: "French",
  de: "German",
  en: "English",
};

export type QuestionGroupId =
  | "questions"
  | "prepositions"
  | "comparisons"
  | "alphabetical";

export const QUESTION_GROUP_LABELS: Record<QuestionGroupId, string> = {
  questions: "Questions",
  prepositions: "Prepositions",
  comparisons: "Comparisons",
  alphabetical: "Alphabetical",
};

type ModifierSet = {
  /** Placed before the keyword: "how" + "back pain". */
  questions: string[];
  /** Placed after the keyword: "back pain" + "for". */
  prepositions: string[];
  /** Placed after the keyword: "back pain" + "vs". */
  comparisons: string[];
};

const MODIFIERS: Record<QuestionExplorerLanguage, ModifierSet> = {
  nl: {
    questions: [
      "hoe",
      "wat",
      "waarom",
      "waar",
      "wanneer",
      "wie",
      "welke",
      "kan",
      "is",
    ],
    prepositions: ["voor", "met", "zonder", "bij", "tegen", "na", "in"],
    comparisons: ["vs", "of", "en", "zoals"],
  },
  fr: {
    questions: [
      "comment",
      "que",
      "pourquoi",
      "où",
      "quand",
      "qui",
      "quel",
      "est-ce que",
      "peut-on",
    ],
    prepositions: ["pour", "avec", "sans", "contre", "après", "près de"],
    comparisons: ["vs", "ou", "et", "comme"],
  },
  de: {
    questions: [
      "wie",
      "was",
      "warum",
      "wo",
      "wann",
      "wer",
      "welche",
      "kann",
      "ist",
    ],
    prepositions: ["für", "mit", "ohne", "gegen", "nach", "bei"],
    comparisons: ["vs", "oder", "und", "wie"],
  },
  en: {
    questions: [
      "how",
      "what",
      "why",
      "where",
      "when",
      "who",
      "which",
      "can",
      "is",
      "are",
    ],
    prepositions: ["for", "with", "without", "near", "to", "against"],
    comparisons: ["vs", "or", "and", "like"],
  },
};

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

export function isQuestionExplorerLanguage(
  languageCode: string,
): languageCode is QuestionExplorerLanguage {
  return (QUESTION_EXPLORER_LANGUAGES as readonly string[]).includes(
    languageCode,
  );
}

type QuestionExplorerQuery = {
  group: QuestionGroupId;
  modifier: string;
  query: string;
};

/** Every Google query one search sends, in display order. */
export function buildQuestionExplorerQueries(input: {
  keyword: string;
  languageCode: QuestionExplorerLanguage;
  includeAlphabetical: boolean;
}): QuestionExplorerQuery[] {
  const { keyword } = input;
  const modifiers = MODIFIERS[input.languageCode];
  return [
    ...modifiers.questions.map((modifier) => ({
      group: "questions" as const,
      modifier,
      query: `${modifier} ${keyword}`,
    })),
    ...modifiers.prepositions.map((modifier) => ({
      group: "prepositions" as const,
      modifier,
      query: `${keyword} ${modifier}`,
    })),
    ...modifiers.comparisons.map((modifier) => ({
      group: "comparisons" as const,
      modifier,
      query: `${keyword} ${modifier}`,
    })),
    ...(input.includeAlphabetical
      ? ALPHABET.map((letter) => ({
          group: "alphabetical" as const,
          modifier: letter,
          query: `${keyword} ${letter}`,
        }))
      : []),
  ];
}

/** Raw DataForSEO USD per Google suggestion request (live). */
export const QUESTION_EXPLORER_REQUEST_USD = 0.002;

export function questionExplorerRequestCount(input: {
  languageCode: QuestionExplorerLanguage;
  includeAlphabetical: boolean;
}): number {
  const modifiers = MODIFIERS[input.languageCode];
  return (
    modifiers.questions.length +
    modifiers.prepositions.length +
    modifiers.comparisons.length +
    (input.includeAlphabetical ? ALPHABET.length : 0)
  );
}
