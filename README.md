# Swagger AI

Application repository for **Swagger AI**, managed by [Entonomy](https://entonomy.com).

## Overview

This repository contains a Next.js web application that serves as the company product. AI agents working in Entonomy modify this codebase to implement features, fix bugs, and build out the product.

## Running the Application

### Via Entonomy (recommended)

Go to the **App** page in your Entonomy dashboard and click **Start**. The system will:

1. Clone this repository
2. Install dependencies (`npm install`)
3. Build the application (`npm run build`)
4. Start the production server on an assigned port (`npm start`)

### Locally

```bash
npm install
npm run dev
```

## Project Structure

```
swagger-ai/
  src/app/          -- Next.js App Router (pages and layouts)
  documents/        -- Working directory for AI agents
  package.json      -- Dependencies and scripts
  next.config.ts    -- Next.js configuration (required for app detection)
  tsconfig.json     -- TypeScript configuration
```

## Important

- **Do not remove `next.config.ts`** -- it is required for the app runner to detect this as a Next.js project
- **Do not change the project structure** -- the runner expects standard Next.js conventions
- The `documents/` directory is reserved for AI agent working files (research, reports, generated content)
- Agents create and update files in `documents/` as they execute tasks
