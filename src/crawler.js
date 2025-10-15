import fetch from "node-fetch";
import { Client } from "pg";

export async function runCrawler(opts = {}) {
  const {
    GITHUB_GRAPHQL_URL = "https://api.github.com/graphql",
    GITHUB_TOKEN,
    PG_CONNECTION_STRING = "postgresql://postgres:postgres@localhost:5432/postgres",
    TARGET_REPOS = 100000,
    PAGE_SIZE = 100,
  } = opts;

  if (!GITHUB_TOKEN) {
    throw new Error(
      "GITHUB_TOKEN not provided in env. In GitHub Actions use default GITHUB_TOKEN."
    );
  }

  const pg = new Client({ connectionString: PG_CONNECTION_STRING });
  await pg.connect();

  try {
    const schemaSql = await import("fs").then((fs) =>
      fs.promises.readFile(new URL("../schema.sql", import.meta.url), "utf8")
    );
    await pg.query(schemaSql);

    let collected = 0;
    let afterCursor = null;
    const pageSize = Math.min(PAGE_SIZE, 100);

    const searchQuery = "stars:>0";

    while (collected < TARGET_REPOS) {
      const remaining = TARGET_REPOS - collected;
      const take = Math.min(pageSize, remaining);

      const { data, headers } = await graphqlRequestWithRetry(
        GITHUB_GRAPHQL_URL,
        GITHUB_TOKEN,
        buildSearchQuery(take, afterCursor, searchQuery)
      );

      if (headers) {
        const rl = {
          limit: headers.get("x-ratelimit-limit"),
          remaining: headers.get("x-ratelimit-remaining"),
          reset: headers.get("x-ratelimit-reset"),
        };
        console.log("rate limit:", rl);
      }

      if (!data) {
        console.log("No data returned; stopping.");
        break;
      }

      const edges = data.search.edges || [];
      if (edges.length === 0) {
        console.log("No more results from search.");
        break;
      }

      for (const edge of edges) {
        const repo = edge.node;
        const repoRes = await upsertRepository(pg, {
          github_id: repo.databaseId ?? null,
          full_name: `${repo.owner.login}/${repo.name}`,
          name: repo.name,
          owner: repo.owner.login,
          url: repo.url,
          description: repo.description,
          primary_language: repo.primaryLanguage
            ? repo.primaryLanguage.name
            : null,
          created_at: repo.createdAt,
          updated_at: repo.updatedAt,
          last_crawled_at: new Date().toISOString(),
        });

        await pg.query(
          `INSERT INTO stars_snapshots (repository_id, snapshot_date, stargazers_count)
           VALUES ($1, now(), $2)`,
          [repoRes.id, repo.stargazerCount]
        );

        collected += 1;
        if (collected >= TARGET_REPOS) break;
      }

      const pageInfo = data.search.pageInfo;
      if (!pageInfo.hasNextPage) {
        console.log("Reached end of search results.");
        break;
      }
      afterCursor = pageInfo.endCursor;

      const remainingHeader = headers
        ? headers.get("x-ratelimit-remaining")
        : null;
      if (remainingHeader !== null && Number(remainingHeader) < 10) {
        const reset = headers.get("x-ratelimit-reset");
        const waitMs = reset
          ? Number(reset) * 1000 - Date.now() + 1000
          : 60 * 1000;
        console.log(
          `Low rate limit remaining (${remainingHeader}). Waiting ${Math.ceil(
            waitMs / 1000
          )}s`
        );
        await sleep(waitMs);
      } else {
        await sleep(300);
      }
    }

    console.log(`Collected ${collected} repositories.`);
  } finally {
    await pg.end();
  }
}

async function graphqlRequestWithRetry(url, token, body, maxAttempts = 6) {
  let attempt = 0;
  let lastErr = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query: body }),
      });

      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch (e) {
        json = null;
      }

      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}: ${text}`);
        const backoff = Math.min(2000 * Math.pow(2, attempt), 30000);
        await sleep(backoff + Math.random() * 200);
        continue;
      }

      if (json && json.errors && json.errors.length > 0) {
        lastErr = new Error("GraphQL errors: " + JSON.stringify(json.errors));
        const backoff = Math.min(2000 * Math.pow(2, attempt), 30000);
        await sleep(backoff + Math.random() * 200);
        continue;
      }

      return { data: json.data, headers: res.headers };
    } catch (err) {
      lastErr = err;
      const backoff = Math.min(1000 * Math.pow(2, attempt), 30000);
      await sleep(backoff + Math.random() * 200);
    }
  }
  throw lastErr;
}

function buildSearchQuery(first = 100, after = null, q = "stars:>0") {
  const cursorPart = after ? `, after: "${after}"` : "";
  return `
    query {
      search(query: "${q}", type: REPOSITORY, first: ${first}${cursorPart}) {
        repositoryCount
        edges {
          node {
            ... on Repository {
              databaseId
              id
              name
              owner { login }
              url
              description
              stargazerCount
              createdAt
              updatedAt
              primaryLanguage { name }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;
}

async function upsertRepository(pg, repo) {
  const {
    github_id,
    full_name,
    name,
    owner,
    url,
    description,
    primary_language,
    created_at,
    updated_at,
    last_crawled_at,
  } = repo;
  const q = `
    INSERT INTO repositories (github_id, full_name, name, owner, url, description, primary_language, created_at, updated_at, last_crawled_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (full_name) DO UPDATE
      SET github_id = COALESCE(EXCLUDED.github_id, repositories.github_id),
          description = COALESCE(EXCLUDED.description, repositories.description),
          primary_language = COALESCE(EXCLUDED.primary_language, repositories.primary_language),
          updated_at = COALESCE(EXCLUDED.updated_at, repositories.updated_at),
          last_crawled_at = EXCLUDED.last_crawled_at
    RETURNING id;
  `;
  const res = await pg.query(q, [
    github_id,
    full_name,
    name,
    owner,
    url,
    description,
    primary_language,
    created_at,
    updated_at,
    last_crawled_at,
  ]);
  return res.rows[0];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
