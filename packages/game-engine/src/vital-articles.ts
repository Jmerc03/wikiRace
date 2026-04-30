import rawVitalArticles from "./data/vital-articles.json" with { type: "json" };

export type VitalArticle = {
  title: string;

  level: 1 | 2 | 3 | 4;

  topic?: string;

  section?: string;
};

export const vitalArticles = rawVitalArticles as VitalArticle[];
