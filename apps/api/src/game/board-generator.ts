import type { Board } from "./types.js";

export function generateBoard(): Board {
  return {
    id: crypto.randomUUID(),
    size: 5,
    squares: [
      {
        id: crypto.randomUUID(),
        position: 0,
        type: "TITLE_CONTAINS",
        label: "Visit a page with 'science' in the title",
        condition: { text: "science" },
        difficulty: "EASY",
      },
      {
        id: crypto.randomUUID(),
        position: 1,
        type: "TITLE_STARTS_WITH",
        label: "Visit a page starting with A",
        condition: { letter: "A" },
        difficulty: "EASY",
      },
      {
        id: crypto.randomUUID(),
        position: 2,
        type: "CATEGORY_CONTAINS",
        label: "Visit a page in a history category",
        condition: { text: "history" },
        difficulty: "MEDIUM",
      },
      {
        id: crypto.randomUUID(),
        position: 3,
        type: "LINK_COUNT_GREATER_THAN",
        label: "Visit a page with more than 100 links",
        condition: { count: 100 },
        difficulty: "MEDIUM",
      },
    ],
  };
}
