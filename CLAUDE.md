
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered consulting chatbot that helps small businesses with strategic analysis. It performs SWOT, PESTLE, TOWS, Porter's Five Forces, and Business Model Canvas analyses using web-
sourced real-time data.

**Tech Stack:**
- Backend: FastAPI + LangGraph + Google Gemini AI + Tavily Search
- Frontend: Next.js 15 (React 19, TypeScript, Tailwind CSS, shadcn/ui)
- Database: MongoDB (via Motor async driver)
- Deployment: Docker Compose

## Development Commands

### Backend (FastAPI)

**Location:** `backend/`

**Setup:**
```bash
cd backend
# Install dependencies with uv
uv sync

# Copy environment template and configure
cp .env.example .env
# Edit .env with: MONGODB_URL, TAVILY_API_KEY, GOOGLE_API_KEY
```

**Run development server:**
```bash
cd backend
uv run uvicorn main:app --host 0.0.0.0 --port 8000
# API docs available at http://127.0.0.1:8000/docs
```

**Run tests:**
```bash
cd backend
uv run pytest
# Tests use monkey patching to avoid real database/LLM calls
```

### Frontend (Next.js)

**Location:** `frontend/`

**Setup:**
```bash
cd frontend
npm install
```

**Run development server:**
```bash
cd frontend
npm run dev
# App runs at http://localhost:3000
```

**Build for production:**
```bash
cd frontend
npm run build
npm start
```

**Lint:**
```bash
cd frontend
npm run lint
```

### Docker (Full Stack)

**Run entire application:**
```bash
docker-compose up --build
# Backend: http://localhost:8000
# Frontend: http://localhost:3000
```

Note: Ensure `backend/.env` exists before running docker-compose (the .env file is volume-mounted).

## Architecture

### Backend Architecture (FastAPI + LangGraph)

**Core Files:**
- `main.py` - FastAPI app with routes, MongoDB integration, CORS, authentication
- `graph.py` - LangGraph workflow for routing and executing analyses
- `test_main.py` - Test suite with mocked database and LLM

**LangGraph Workflow (`graph.py`):**

The system uses a `StateGraph` with conditional routing based on user input:

1. **State Structure:**
   - `messages`: conversation history as list of tuples
   - `input`: current user input string

2. **Analysis Nodes:**
   - `swot` - SWOT analysis node
   - `pestle` - PESTLE analysis node
   - `tows` - TOWS Matrix analysis node
   - `porter` - Porter's Five Forces analysis node
   - `canvas` - Business Model Canvas analysis node
   - `general` - General conversation node (fallback)

3. **Routing Logic:**
   - Routes from START based on keywords in user input (e.g., "swot" → swot node)
   - Each specialized node invokes Tavily search, formats results with LLM, adds in-text citations
   - All nodes use markdown formatting instructions to generate structured output
   - Source links are appended as numbered citations
   - All nodes flow to END after execution

4. **Key Features:**
   - Markdown sanitization to remove accidental code block wrappers
   - In-text citations with format `[1]`, `[2]`, etc.
   - Web search integration via Tavily (max_results=5)
   - Uses Google Gemini 2.0 Pro (`gemini-2.0-pro-exp-02-05`)

**API Routes:**
- `GET /` - Health check
- `POST /analyze/` - Main chat endpoint (processes input, returns AI response)
- `GET /download/?format=pdf` - Download chat history as PDF
- `POST /auth/signup` - User registration (bcrypt password hashing)
- `POST /auth/login` - User authentication
- `POST /plans/` - Create strategic plan
- `GET /plans/` - List all plans (sorted by created_at descending)
- `GET /plans/{plan_id}` - Get specific plan
- `PUT /plans/{plan_id}` - Update plan (status, title, description)
- `DELETE /plans/{plan_id}` - Delete plan

**MongoDB Collections:**

1. **Discussion_data** - Chat conversation history
   - `messages`: conversation history array
   - `input`: user input string
   - `response`: AI response string
   - `full_history`: complete message history array

2. **User_data** - User accounts
   - `email`: EmailStr (unique)
   - `password`: hashed with bcrypt

3. **plans_data** - Strategy plans board
   - `title`: plan title string
   - `description`: plan description string
   - `status`: "todo" | "inprogress" | "done"
   - `created_at`: datetime (auto-set)
   - `updated_at`: datetime (auto-updated)

### Frontend Architecture (Next.js)

**Structure:**
- `app/` - Next.js 15 App Router pages
  - `page.tsx` - Landing page
  - `chat/page.tsx` - Main chat interface
  - `auth/` - Authentication pages
  - `plans/page.tsx` - Plans board (drag-and-drop Kanban)
- `components/ui/` - shadcn/ui components (Radix UI primitives)
- `providers/` - React context providers (theme, etc.)
- `hooks/` - Custom React hooks
- `lib/utils.ts` - Utility functions (clsx, tailwind-merge)

**Key Dependencies:**
- `@hello-pangea/dnd` - Drag-and-drop for Plans board
- `react-markdown` + `remark-gfm` + `rehype-raw` - Markdown rendering
- `next-themes` - Dark mode support
- `react-hook-form` + `zod` - Form validation
- `recharts` - Charts/data visualization

**API Communication:**
- Backend URL: `http://localhost:8000`
- CORS configured for `http://localhost:3000`
- Uses fetch API for backend communication

## Important Notes

### Backend Dependencies
- Recently migrated from Poetry to **uv** for dependency management
- `pyproject.toml` uses uv format, dependencies managed with `uv sync`
- `requirements.txt` exists for Docker compatibility (generated from uv)

### Authentication
- Passwords are hashed with bcrypt before storage
- Login verifies password hash with `pwd_context.verify()`
- No JWT/session tokens currently implemented (stateless auth)

### Testing
- Backend tests mock LLM workflow and MongoDB collections
- Uses `monkeypatch` to stub `analysis_chain.invoke()`
- Mock classes: `AsyncIterator`, `DummyCursor`, `DummyCollection`

### Markdown Formatting
- LLM responses should not be wrapped in triple backticks
- In-text citations use `[X]` format linked to sources section
- Source links appear at bottom as numbered list: `1. [Title](URL)`

### Docker Notes
- Backend Dockerfile must include `requirements.txt` (not just pyproject.toml)
- `.dockerignore` files exist to speed up builds
- Backend `.env` is volume-mounted (not copied into image)

## Common Pitfalls

1. **Environment Variables:** Always ensure `backend/.env` exists with required API keys (MONGODB_URL, TAVILY_API_KEY, GOOGLE_API_KEY) before running backend or docker-compose.

2. **LangGraph State:** When modifying workflow, remember that routing happens at START based on input keywords. New analysis types need both a node function and a routing keyword.

3. **MongoDB ObjectId:** Use `PyObjectId = Annotated[str, BeforeValidator(str)]` for _id fields in Pydantic models. Convert strings to ObjectId with `ObjectId(id_string)` when querying.

4. **CORS:** Backend only allows `http://localhost:3000`. Update if frontend runs on different port.

5. **PDF Generation:** Uses FPDF with custom NotoSans font from `backend/fonts/`. Font file required for Unicode support.

6. **Plans Board:** Frontend uses drag-and-drop. Status values must match backend: "todo", "inprogress", "done".

7. **Testing:** Tests stub out LLM and database - don't expect real AI responses in test environment.
