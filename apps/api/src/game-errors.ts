export class GameError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}
