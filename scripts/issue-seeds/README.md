# Issue seeds

Markdown files here are **not** committed backlog — they are one-time inputs for `npm run seed-github-issues`.

Each `*.md` file becomes a GitHub issue (title from first `#` heading, body is the rest).

After seeding, delete or archive files you no longer need. The Cloud Agent token cannot create issues; run locally:

```bash
npm run seed-github-issues
```

Or create issues manually via the **Feature** issue template in GitHub.
