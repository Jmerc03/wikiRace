import fs from "node:fs";
import path from "node:path";

type VitalArticle = {
  title: string;
  level: number;
  topic?: string;
  [key: string]: unknown;
};

const inputDir = path.resolve("scripts/raw-data/vital-articles");
const outputFile = path.resolve(
  "packages/game-engine/src/data/vital-articles.json",
);

const inputFiles = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    .split("")
    .flatMap((letter) => [`${letter}.json`, `${letter}.txt`]),

  "others.json",

  "others.txt",
];
const mergedArticles: VitalArticle[] = [];

for (const fileName of inputFiles) {
  const filePath = path.join(inputDir, fileName);

  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping missing file: ${fileName}`);
    continue;
  }

  const raw = fs.readFileSync(filePath, "utf-8");

  const articles = parseInputFile(raw, fileName);

  const filtered = articles.filter(
    (article) => article.level >= 1 && article.level <= 4,
  );

  mergedArticles.push(...filtered);
}

const uniqueArticles = dedupeByTitle(mergedArticles);

fs.mkdirSync(path.dirname(outputFile), { recursive: true });

fs.writeFileSync(outputFile, JSON.stringify(uniqueArticles, null, 2), "utf-8");

console.log(`Merged ${uniqueArticles.length} level 1-4 vital articles.`);
console.log(`Output written to: ${outputFile}`);

function parseInputFile(raw: string, fileName: string): VitalArticle[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeParsedJson(parsed, fileName);
  } catch {
    return parseVitalText(raw);
  }
}

function normalizeParsedJson(
  parsed: unknown,
  fileName: string,
): VitalArticle[] {
  if (Array.isArray(parsed)) {
    return parsed as VitalArticle[];
  }

  if (parsed && typeof parsed === "object") {
    const objectValue = parsed as Record<string, unknown>;

    for (const key of ["articles", "data", "items", "pages", "results"]) {
      const value = objectValue[key];

      if (Array.isArray(value)) {
        return value as VitalArticle[];
      }
    }

    const entries = Object.entries(objectValue);

    const titleKeyedArticles = entries
      .filter(([, value]) => value && typeof value === "object")
      .map(([title, value]) => ({
        title,
        ...(value as Record<string, unknown>),
      })) as VitalArticle[];

    if (titleKeyedArticles.length > 0) {
      return titleKeyedArticles;
    }
  }

  console.warn(`Skipping unsupported JSON structure in ${fileName}`);
  return [];
}

function dedupeByTitle(articles: VitalArticle[]): VitalArticle[] {
  const seen = new Map<string, VitalArticle>();

  for (const article of articles) {
    if (!article.title || article.level < 1 || article.level > 4) {
      continue;
    }

    const key = article.title.trim().toLowerCase();

    if (!seen.has(key)) {
      seen.set(key, article);
    }
  }

  return Array.from(seen.values());
}

function parseVitalText(raw: string): VitalArticle[] {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const articles: VitalArticle[] = [];
  let currentArticle: VitalArticle | null = null;

  const metadataKeys = new Set(["level", "topic", "section"]);

  for (let i = 0; i < lines.length; i++) {
    const parsedLine = parseTextLine(lines[i]);
    const key = parsedLine.key;
    let value = parsedLine.value;

    if (!metadataKeys.has(key)) {
      if (currentArticle) {
        articles.push(currentArticle);
      }

      currentArticle = {
        title: lines[i].replace(/\t+/g, " ").trim(),
        level: 0,
      };

      continue;
    }

    if (!currentArticle) {
      continue;
    }

    if (!value) {
      value = lines[i + 1]?.trim() ?? "";
      i++;
    }

    value = value.replace(/^"|"$/g, "");

    if (key === "level") {
      currentArticle.level = Number(value);
    } else if (key === "topic") {
      currentArticle.topic = value;
    } else {
      currentArticle[key] = value;
    }
  }

  if (currentArticle) {
    articles.push(currentArticle);
  }

  return articles;
}

function parseTextLine(line: string): { key: string; value: string } {
  const tabParts = line
    .split(/\t+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (tabParts.length >= 2) {
    return {
      key: tabParts[0],
      value: tabParts.slice(1).join(" "),
    };
  }

  const spacedMatch = line.match(/^(level|topic|section)\s+(.+)$/);

  if (spacedMatch) {
    return {
      key: spacedMatch[1],
      value: spacedMatch[2],
    };
  }

  return {
    key: line,
    value: "",
  };
}
