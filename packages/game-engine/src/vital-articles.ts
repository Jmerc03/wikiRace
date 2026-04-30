export type VitalArticle = {
  title: string;
  level: 1 | 2 | 3 | 4 | 5;
  topic: string;
};

export const vitalArticles: VitalArticle[] = [
  { title: "Science", level: 1, topic: "Science" },
  { title: "Mathematics", level: 1, topic: "Mathematics" },
  { title: "History", level: 1, topic: "History" },
  { title: "Earth", level: 1, topic: "Geography" },
  { title: "Human", level: 1, topic: "Biology" },

  { title: "World War II", level: 3, topic: "History" },
  { title: "Albert Einstein", level: 3, topic: "Science" },
  { title: "United States", level: 2, topic: "Geography" },
  { title: "China", level: 2, topic: "Geography" },
  { title: "Internet", level: 3, topic: "Technology" },
  { title: "Computer", level: 3, topic: "Technology" },
  { title: "Democracy", level: 3, topic: "Politics" },
  { title: "Evolution", level: 3, topic: "Biology" },
  { title: "Christianity", level: 3, topic: "Religion" },
  { title: "Islam", level: 3, topic: "Religion" },
  { title: "William Shakespeare", level: 3, topic: "Literature" },
  { title: "Genghis Khan", level: 3, topic: "History" },
  { title: "Physics", level: 2, topic: "Science" },
  { title: "Chemistry", level: 2, topic: "Science" },
  { title: "Biology", level: 2, topic: "Biology" },
];
