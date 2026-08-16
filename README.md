# QA API Agent

QA API Agent is a QA-focused web application that helps testers analyse API endpoints, generate risk-based test ideas, execute requests, identify coverage gaps, and keep a local history of test runs.

## Hackathon goal

The project focuses on a practical QA decision: **what should I test first, what can fail, and what am I missing?**

## Features

- API endpoint analysis
- Risk scoring
- Functional, negative, boundary and security test suggestions
- Test prioritisation
- Real API request execution
- Response time and status-code capture
- AI-assisted failure analysis
- Test-gap detection
- Test-run history stored in browser localStorage
- JSON report export
- Vercel-ready serverless AI endpoint

## Stack

- React + Vite
- JavaScript
- Tailwind CSS
- Vercel Functions
- OpenAI-compatible API for AI analysis
- Browser localStorage for hackathon output history

## Run locally

```bash
npm install
npm run dev
```

Optional AI configuration:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
```

For Vercel, add the same environment variables in Project Settings.

Without an AI key, the application uses a transparent demo analysis so the UI can still be reviewed. Demo analysis is never presented as a real API execution result.

## Demo API

The default sample uses Restful Booker:

`https://restful-booker.herokuapp.com/ping`

The API target can be changed from the UI.

## Important

Never commit API keys, bearer tokens, passwords, or private customer data.


## Vercel report sharing

The application now creates a professional HTML execution report after a single run or Excel batch run.

For a persistent Share Report URL on Vercel:

1. Create a Vercel Blob store from your Vercel project dashboard
2. Connect the Blob store to this project
3. Make sure `BLOB_READ_WRITE_TOKEN` is available in the Vercel environment
4. Redeploy the project

The UI provides:

- Share Report modal
- Copy URL
- Open Report
- Download Report
- Professional execution summary
- Bulk Excel execution report
- Persistent report URLs on Vercel

For local development, reports are stored in the local `reports` folder when Blob storage is not configured.
