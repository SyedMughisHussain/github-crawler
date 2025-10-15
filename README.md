# GitHub Stars Crawler (GitHub Actions Only)

This project collects GitHub repository star counts using the GitHub GraphQL API. It runs entirely in GitHub Actions and stores data temporarily in PostgreSQL during the workflow. After each run, results are exported as a CSV file.

---

## How to Download the CSV Output

1. Go to your GitHub repository and open the **Actions** tab.
2. Select the latest workflow run named `crawler`.
3. Scroll down to the **Artifacts** section.
4. Click on `stars-csv` to download the ZIP file containing `stars.csv`.

---

## Future Implementation

To evolve beyond star counts, additional metadata can be collected using append-only tables:

| Data Type             | Storage Strategy                        |
| --------------------- | --------------------------------------- |
| Issues                | `issues` table with upsert by GitHub ID |
| Issue Comments        | Insert-only `issue_comments` table      |
| Pull Requests         | `pull_requests` table                   |
| PR Comments / Reviews | Insert-only `pr_comments`, `pr_reviews` |
| CI Checks             | Event-based `ci_events` table           |

Updates should append new rows rather than overwrite existing ones to minimize write operations and retain history.

---

## Scaling Strategy (From 100,000 to 500 Million Repositories)

To handle large-scale crawling:

| Challenge        | Approach                                                                               |
| ---------------- | -------------------------------------------------------------------------------------- |
| API Rate Limits  | Use multiple GitHub tokens in parallel with centralized rate limiting                  |
| Database Storage | Move from single Postgres to sharded Postgres or data warehouse (ClickHouse, BigQuery) |
| Runtime          | Use checkpointing and segmented crawls                                                 |
| Cold Storage     | Archive older or inactive repositories to object storage (S3, GCS, Azure Blob)         |

Cloud storage support for CSV exports can be added via AWS CLI, `gsutil`, or Azure CLI inside the workflow.

---

This repository is designed to run entirely within GitHub Actions without requiring local setup. Data is accessed only through workflow artifacts.
