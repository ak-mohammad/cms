# Portfolio CMS - Dashboard

A client-side Content Management System (CMS) designed specifically to manage blog posts on the portfolio website (`ak-mohammad/profile` repository). 

Since this CMS is built entirely with client-side HTML, CSS, and JavaScript, it runs serverless and can be deployed directly to GitHub Pages (e.g. `https://ak-mohammad.github.io/cms/`).

## 🚀 Local Execution

To start the CMS locally:
1. Install dependencies and serve the site:
   ```bash
   ./bin/jekyll serve
   ```
2. Navigate to your browser:
   👉 **[http://localhost:4000/cms/](http://localhost:4000/cms/)**

## ⚙️ Configuration & Access

### 1. Direct Access (Personal Access Token)
* Input your **GitHub Username** (`ak-mohammad`), your **Repository Name** (`profile`), and your **GitHub Personal Access Token (PAT)** with `repo` permissions.
* Click **Connect Dashboard** to sign in. The credentials are saved locally in your browser's `localStorage` and used directly to communicate with the GitHub API.

### 2. GitHub OAuth Access
* Enter your **GitHub Username** (`ak-mohammad`), **Repository Name** (`profile`), and your **OAuth Proxy URL** (e.g. a Cloudflare Worker proxy that holds your Client Secret).
* Click **Sign in with GitHub** to authenticate via standard OAuth redirection.

## 📝 Writing & Publishing

* **Metadata Fields**: Write a Headline, Subheadline, select the Publish Date, assign Categories/Tags, and link a Main Banner Image.
* **Markdown Editor**: Draft content with a **Live Preview** pane rendered using `marked.js` on-the-fly.
* **Auto-generated Filenames**: Auto-creates standard Jekyll files (e.g. `YYYY-MM-DD-slug.md`) from your headline.
* **Deployment Progress**: A status tracker polls your portfolio's Actions API to display progress as GitHub Pages builds and publishes your new article.
