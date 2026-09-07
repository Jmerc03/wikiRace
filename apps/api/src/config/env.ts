import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  HOST: process.env.HOST ?? "127.0.0.1",
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
