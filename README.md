# AI Workplace Productivity Assistant

A modern, responsive productivity application that uses generative AI to help professionals create workplace emails, turn meeting notes into actionable summaries, and organise work into practical daily or weekly schedules.

The application is designed as a **frontend-only project**. It uses a user-provided Google Gemini API key for AI features and browser storage for local productivity data. No custom backend or database is required.

## Features Implemented

### AI Email Generator
- Generate context-aware professional emails from the recipient, subject, objective, and supporting details supplied by the user.
- Choose between **Formal**, **Friendly**, and **Persuasive** tones.
- Edit generated drafts, regenerate them, and copy the final text.

### Meeting Notes Summarizer
- Paste meeting notes or upload supported documents (PDF, DOCX, or TXT).
- Generate a concise summary based on the supplied meeting content.
- Extract key decisions, action items, responsible people, and deadlines where they are present in the source notes.
- Review and edit the generated results.

### AI Task Planner and Scheduler
- Add tasks with deadlines, estimated durations, and priority levels.
- Generate daily or weekly schedules based on the entered tasks.
- Highlight urgent and important work, and include breaks where appropriate.
- Edit and rearrange the suggested schedule.

### Productivity Dashboard
- View productivity indicators for completed tasks, estimated time saved, emails generated, and meetings summarised.
- Review weekly productivity visualisations, recent activity, and AI-generated recommendations.
- Navigate between the main tools using the application sidebar.

### Additional Application Features
- Responsive layouts for desktop, tablet, and mobile screens.
- Search, navigation, loading states, validation, empty states, and error feedback.
- Local browser storage for tasks, generated content, and activity history.
- Settings area for entering a Gemini API key.
- Responsible AI notice reminding users to review generated content before relying on or sharing it.

> **AI output notice:** Generated content can be incomplete, inaccurate, or misleading. Review all emails, summaries, decisions, deadlines, and schedules before using them in a professional setting.

## Technologies and Tools Used

| Technology / Tool | Purpose |
| --- | --- |
| React | Component-based user interface |
| TypeScript | Type safety and maintainable application code |
| Tailwind CSS | Responsive styling and design system |
| Google Gemini API | AI-generated emails, meeting summaries, and task schedules |
| Browser `localStorage` | Local persistence for productivity data and activity history |
| Browser File APIs | Reading supported document uploads on the client |
| Lovable | AI-assisted application development and UI generation |
| Git and GitHub | Source control and project hosting |

The exact package versions and any additional libraries (for example, charting or document-parsing packages) are defined by the project's `package.json` and lockfile.

## Prerequisites

Before running the project, install:

- [Node.js](https://nodejs.org/) (use a current LTS release).
- npm, which is included with Node.js, or another package manager compatible with the project's lockfile.
- A Google Gemini API key for AI-powered features. Create or manage a key in [Google AI Studio](https://aistudio.google.com/app/apikey).
- Git, if you are cloning the repository.

## Setup Instructions

### 1. Clone the repository

Replace the example URL with the URL of your GitHub repository:

```bash
git clone https://github.com/<your-username>/<your-repository>.git
cd <your-repository>
```

### 2. Install dependencies

From the project root, run:

```bash
npm install
```

If the repository uses a different package manager, follow the lockfile included in the project (for example, use `pnpm install` for a `pnpm-lock.yaml` project).

### 3. Start the development server

```bash
npm run dev
```

Open the local URL printed in the terminal (commonly `http://localhost:5173`) in your browser.

### 4. Configure the Gemini API key

1. Open the application.
2. Navigate to **Settings**.
3. Enter your Google Gemini API key in the API key field and save or apply it.
4. Open the Email Generator, Meeting Notes Summarizer, or Task Planner and submit your input to generate AI content.

The application is designed to accept the key from the user at runtime rather than embedding a credential in the source code. In this frontend-only setup, the key is used by the browser to make API requests and may be visible to the user or through browser developer tools. **Do not use this approach for a shared production deployment or enter a sensitive, unrestricted API key.** Apply appropriate API restrictions and usage limits. A secure production implementation should proxy AI requests through a backend and keep credentials server-side.

## Available Scripts

The following are typical scripts in a Lovable-generated Vite project. Check the `scripts` section of `package.json` for the commands available in this repository.

```bash
npm run dev       # Start the local development server
npm run build     # Create a production build
npm run preview   # Preview the production build locally
```

## Data and Privacy

- Productivity data is stored locally in the browser using `localStorage`; it is not synchronised to a server by this frontend-only design.
- AI features send the relevant text or document content to Google's Gemini API when the user requests generation.
- Avoid submitting confidential, personal, client, or otherwise sensitive workplace information unless you are authorised to do so and have reviewed the applicable data-handling requirements.
- Clearing the browser's site data may remove locally stored application information.
- The API key is not a substitute for secure server-side secret management. Browser-based API calls expose the key during use.

## Project Structure

The exact structure may vary depending on the Lovable export. A typical React and Vite project includes:

```text
.
├── public/              # Static assets
├── src/                 # Application source code and components
├── index.html           # HTML entry point
├── package.json         # Dependencies and npm scripts
├── package-lock.json    # Dependency lockfile (if using npm)
├── tsconfig.json        # TypeScript configuration
└── vite.config.ts       # Vite configuration
```

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/your-change`.
3. Make and test your changes.
4. Commit your work: `git commit -m "Add your change"`.
5. Push the branch and open a pull request.

## License

No license has been specified yet. Add a `LICENSE` file and update this section before distributing or reusing the project publicly.
