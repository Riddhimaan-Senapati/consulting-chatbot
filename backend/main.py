from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Tuple
from graph import initialize_workflow
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Update with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

analysis_chain = initialize_workflow()

class AnalysisRequest(BaseModel):
    messages: List[Tuple[str, str]]
    user_input: str

@app.get("/")
async def health_check():
    return {"status": "active", "version": "1.0.0"}

@app.post("/analyze")
async def analyze(request: AnalysisRequest):
    state = {
        "messages": request.messages,
        "input": request.user_input
    }
    result = analysis_chain.invoke(state)
    return {
        "response": result["messages"][-1][1],
        "full_history": result["messages"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
