import type { BoardSquare, PageVisitEvent } from "@bingo/shared";

export function evaluateSquare(
  square: BoardSquare,
  event: PageVisitEvent,
): boolean {
  switch (square.type) {
    case "TITLE_CONTAINS": {
      const text = String(square.condition.text).toLowerCase();
      return event.title.toLowerCase().includes(text);
    }

    case "TITLE_STARTS_WITH": {
      const letter = String(square.condition.letter).toLowerCase();
      return event.title.toLowerCase().startsWith(letter);
    }

    case "CATEGORY_CONTAINS": {
      const text = String(square.condition.text).toLowerCase();
      return event.categories.some((category) =>
        category.toLowerCase().includes(text),
      );
    }

    case "LINK_COUNT_GREATER_THAN": {
      const count = Number(square.condition.count);
      return event.links.length > count;
    }

    default:
      return false;
  }
}
