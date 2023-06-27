## Getting Started

First, check your node version. This project supports v16.8.0 or later.

If this is your first time running this project, run:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Setup

This project uses [Prettier](https://prettier.io/docs/en/index.html) to ensure consistent code formatting.

We use a pre-commit hook to run prettier on every commit. To install it run:

```bash
npm pkg set scripts.prepare="husky install"
npx husky add .husky/pre-commit "npx lint-staged"
```

To get the most out of Prettier, it’s recommended to run it from your editor as well. Check out the [docs here](https://prettier.io/docs/en/editors.html) for editor specific information.

## Other

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.
