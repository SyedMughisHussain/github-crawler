// src/index.js
import { runCrawler } from "./crawler.js";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  try {
    await runCrawler({
      GITHUB_GRAPHQL_URL:
        process.env.GITHUB_GRAPHQL_URL || "https://api.github.com/graphql",
      GITHUB_TOKEN:
        process.env.GITHUB_TOKEN ||
        process.env.GITHUB_ACTIONS_TOKEN ||
        process.env.GITHUB_TOKEN,
      PG_CONNECTION_STRING:
        process.env.DATABASE_URL ||
        process.env.PG_CONN ||
        "postgresql://postgres:postgres@localhost:5432/postgres",
      TARGET_REPOS: Number(process.env.TARGET_REPOS || 100000),
      PAGE_SIZE: Number(process.env.PAGE_SIZE || 100), // GraphQL page_size choice
    });
    console.log("Crawl finished.");
  } catch (err) {
    console.error("Fatal error in crawler:", err);
    process.exit(1);
  }
}

main();
