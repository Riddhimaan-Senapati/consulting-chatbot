
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered consulting chatbot that helps small businesses with strategic analysis. It performs SWOT, PESTLE, TOWS, Porter's Five Forces, and Business Model Canvas analyses using web-
sourced real-time data.

**Tech Stack:**
- Backend: FastAPI + LangGraph + Google Gemini AI + Tavily Search
- Frontend: Next.js 15 (React 19, TypeScript, Tailwind CSS, shadcn/ui)
- Database: MongoDB (via Motor async driver)
- Deployment: Docker Compose (local), Vercel (production)

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

### Vercel (Production Deployment)

**Frontend Deployment:**
```bash
cd frontend
npx vercel deploy --prod --yes
# Production URL: https://consulting-chatbot.vercel.app
```

**Backend Deployment:**
```bash
cd backend
npx vercel deploy --prod --yes
# Production URL: https://consulting-chatbot-backend.vercel.app
# API Docs: https://consulting-chatbot-backend.vercel.app/docs
```

**Environment Variables:**
Set these in Vercel dashboard for each project:
- **Backend**: `MONGODB_URL`, `TAVILY_API_KEY`, `GOOGLE_API_KEY`
- **Frontend**: `NEXT_PUBLIC_API_URL` (points to backend URL)

**Vercel Projects:**
- Frontend: https://vercel.com/riddhimaan-senapatis-projects/consulting-chatbot
- Backend: https://vercel.com/riddhimaan-senapatis-projects/consulting-chatbot-backend

## Architecture

### Backend Architecture (FastAPI + LangGraph)

**Core Files:**
- `main.py` - FastAPI app with routes, MongoDB integration, CORS, authentication
- `graph.py` - LangGraph workflow for routing and executing analyses
- `test_main.py` - Test suite with mocked database and LLM
- `vercel.json` - Vercel serverless deployment configuration

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

### Vercel Serverless Architecture

**Lazy Initialization Pattern:**
The backend uses lazy initialization for serverless environments (Vercel) because:
- Serverless functions are **stateless** and **ephemeral**
- Traditional startup events (`@app.on_event("startup")`) may not execute reliably
- Connections must be initialized on-demand, not at module import time

**LangGraph Workflow (main.py:53-57):**
```python
analysis_chain = None  # Don't initialize at module level

def get_analysis_chain():
    global analysis_chain
    if analysis_chain is None:
        analysis_chain = initialize_workflow()  # Initialize on first use
    return analysis_chain
```

**MongoDB Connection (main.py:44-62):**
```python
_client = None  # Global connection pool

def get_db_collections():
    global _client, _db, _discussion_collection, _user_collection, _plans_collection
    if _client is None:
        mongodb_url = os.getenv("MONGODB_URL")
        _client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_url)
        _db = _client.Consulting_data
        _discussion_collection = _db.get_collection("Discussion_data")
        _user_collection = _db.get_collection("User_data")
        _plans_collection = _db.get_collection("plans_data")
    return _discussion_collection, _user_collection, _plans_collection
```

**Why This Works:**
- Motor automatically manages connection pooling internally
- Lazy initialization ensures connections are created only when needed
- Each serverless invocation gets a fresh or pooled connection
- No explicit cleanup required - Motor handles it automatically

**Usage in Endpoints:**
All endpoints call `get_db_collections()` to retrieve collections:
```python
@app.get("/plans/")
async def get_all_plans():
    _, _, plans_collection = get_db_collections()  # Lazy load
    plans = []
    async for plan_doc in plans_collection.find().sort("created_at", -1):
        plans.append(Plan(**plan_doc))
    return plans
```

**PDF Generation for Serverless:**
- Uses `/tmp` directory (writable in serverless)
- Fonts are included via `vercel.json` config: `"includeFiles": "fonts/**"`
- Files are cleaned up automatically when function terminates

## Common Pitfalls

1. **Environment Variables:** Always ensure `backend/.env` exists with required API keys (MONGODB_URL, TAVILY_API_KEY, GOOGLE_API_KEY) before running backend or docker-compose.

2. **LangGraph State:** When modifying workflow, remember that routing happens at START based on input keywords. New analysis types need both a node function and a routing keyword.

3. **MongoDB ObjectId:** Use `PyObjectId = Annotated[str, BeforeValidator(str)]` for _id fields in Pydantic models. Convert strings to ObjectId with `ObjectId(id_string)` when querying.

4. **CORS:** Backend only allows `http://localhost:3000`. Update if frontend runs on different port.

5. **PDF Generation:** Uses FPDF with custom NotoSans font from `backend/fonts/`. Font file required for Unicode support.

6. **Plans Board:** Frontend uses drag-and-drop. Status values must match backend: "todo", "inprogress", "done".

7. **Testing:** Tests stub out LLM and database - don't expect real AI responses in test environment.

8. **Vercel Serverless:** Lazy initialization is critical for serverless. Never initialize connections or heavy resources at module level - always use getter functions that initialize on first use.

## Troubleshooting

### MongoDB Connection Issues

**Symptom:** `Internal Server Error` on database operations, or DNS error:
```
The DNS query name does not exist: _mongodb._tcp.cluster0.xxxxx.mongodb.net.
```

**Solutions:**

1. **Verify MongoDB Atlas Cluster:**
   - Go to https://cloud.mongodb.com
   - Ensure cluster exists and is running (not paused)
   - Check cluster name matches `MONGODB_URL`

2. **Configure Network Access:**
   - MongoDB Atlas → Network Access
   - Add IP whitelist entry: `0.0.0.0/0` (allow all - recommended for Vercel serverless)
   - Or add specific Vercel IP ranges

3. **Verify Connection String Format:**
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/database?retryWrites=true&w=majority
   ```
   - Use `mongodb+srv://` protocol
   - Include username, password, cluster domain
   - Add query parameters for connection options

4. **Update Vercel Environment Variable:**
   - Backend project settings → Environment Variables
   - Update `MONGODB_URL` with correct connection string
   - Redeploy: `cd backend && npx vercel deploy --prod --yes`

5. **Test Connection Locally:**
   ```bash
   cd backend
   uv run python -c "from motor.motor_asyncio import AsyncIOMotorClient; import os; from dotenv import load_dotenv; load_dotenv(); client = AsyncIOMotorClient(os.getenv('MONGODB_URL')); print('Connected:', client.server_info())"
   ```

### Google Gemini API Quota Exceeded

**Symptom:** `/analyze/` endpoint returns 429 error:
```
Analysis failed: 429 You exceeded your current quota
```

**Solutions:**

1. **Check API Usage:**
   - Visit: https://ai.google.dev/gemini-api/docs/rate-limits
   - Monitor usage: https://ai.dev/usage?tab=rate-limit

2. **Wait for Quota Reset:**
   - Free tier quotas reset daily
   - Error message shows retry delay (e.g., "retry in 30s")

3. **Upgrade API Plan:**
   - Go to Google AI Studio and upgrade to paid tier
   - Provides higher rate limits and request quotas

4. **Switch Model (Temporary):**
   - Edit `backend/graph.py` line 16:
   ```python
   llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")  # Lower quota usage
   ```
   - Redeploy backend

### Vercel Deployment Failures

**Symptom:** Build fails or functions timeout

**Solutions:**

1. **Check Build Logs:**
   - Vercel dashboard → Deployments → Click deployment
   - View build and function logs for errors

2. **Verify Dependencies:**
   - Ensure `requirements.txt` includes all packages
   - Check `pyproject.toml` matches `requirements.txt`

3. **Check Function Size:**
   - Vercel functions have size limits (50MB)
   - If exceeded, optimize dependencies or use external services

4. **Environment Variables:**
   - Verify all required env vars are set in Vercel dashboard
   - Check for typos in variable names

5. **Test Endpoint Health:**
   ```bash
   curl https://consulting-chatbot-backend.vercel.app/
   # Should return: {"status":"active","version":"1.0.0"}
   ```

### Frontend Not Connecting to Backend

**Symptom:** Frontend shows connection errors

**Solutions:**

1. **Verify Backend URL:**
   - Check `NEXT_PUBLIC_API_URL` in Vercel frontend settings
   - Should be: `https://consulting-chatbot-backend.vercel.app`

2. **Check CORS Configuration:**
   - Backend `main.py` must allow frontend domain
   - Current allowed origins in `main.py:25-30`:
     ```python
     allow_origins=[
         "http://localhost:3000",
         "https://consulting-chatbot.vercel.app",
         "https://consulting-chatbot-riddhimaan-senapatis-projects.vercel.app",
         "https://*.vercel.app"
     ]
     ```

3. **Test Backend Directly:**
   ```bash
   curl https://consulting-chatbot-backend.vercel.app/
   ```

4. **Check Browser Console:**
   - Open DevTools → Console/Network tabs
   - Look for CORS errors or 404/500 responses

### PDF Download Not Working

**Symptom:** `/download/` endpoint fails or returns empty file

**Solutions:**

1. **Verify Font Files:**
   - Check `backend/fonts/NotoSans-Regular.ttf` exists
   - Confirm `vercel.json` includes: `"includeFiles": "fonts/**"`

2. **Check Chat History:**
   - PDF requires existing chat in `Discussion_data` collection
   - Run a chat analysis first to populate database

3. **Test Locally:**
   ```bash
   cd backend
   uv run uvicorn main:app --reload
   # Test: http://localhost:8000/download/
   ```
