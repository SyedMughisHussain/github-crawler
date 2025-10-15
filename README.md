# GitHub Stars Crawler (GitHub Actions + PostgreSQL)

This project automatically crawls GitHub’s GraphQL API to collect **star counts across public repositories** and stores them in **PostgreSQL** during a **GitHub Actions workflow run**.

At the end of each run, the data is **exported as a CSV file**, which can be **downloaded directly from the GitHub Actions Artifacts panel** — **no local database or runtime setup required**.

---

## 🚀 How It Works

When the GitHub Actions workflow runs:

1. A **temporary PostgreSQL service** is started inside the GitHub runner
2. The crawler script fetches repository star counts using the **GitHub GraphQL API**
3. Results are saved to Postgres and then exported to **CSV format**
4. The CSV file is **uploaded as a downloadable GitHub Artifact**

---

## 📥 How to Download the CSV File

Once a workflow run completes:

1. Go to **GitHub → Your Repository → Actions**
2. Click the latest workflow run named **`crawler`**
3. Scroll to the **Artifacts** section
4. Click **`stars-csv` → Download**

You will receive a **ZIP file**, which contains:
