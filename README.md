Logica Tourist Tax

Quick start

1. Initialize repo locally:

   git init
   git add .
   git commit -m "Initial commit"

2. Create a private GitHub repo (option A - GitHub CLI):

   gh repo create <repo-name> --private --source=. --remote=origin --push

   or (option B - website): create a new private repo on github.com then:

   git remote add origin git@github.com:<your-username>/<repo-name>.git
   git branch -M main
   git push -u origin main

Notes

- Keep the Google Apps Script exec URL out of version control if you consider it sensitive. Move it to an `.env` or similar and load it at runtime if needed.
- To enable automated checks, consider adding a GitHub Actions workflow to run linting and tests on push.
