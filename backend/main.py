#main.py
from fastapi.middleware.cors import CORSMiddleware
import os
from fastapi import FastAPI, Body, Response, Query
from pydantic import BaseModel, Field, EmailStr
from typing import List, Tuple, Optional
from graph import initialize_workflow
import motor.motor_asyncio
from bson import ObjectId
from typing_extensions import Annotated
from pydantic.functional_validators import BeforeValidator
import uvicorn
from dotenv import load_dotenv
from fastapi.responses import FileResponse
import pandas as pd
from fpdf import FPDF 
from passlib.context import CryptContext
from fastapi import HTTPException
from datetime import datetime # Added datetime import

app = FastAPI()
# Added CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://consulting-chatbot.vercel.app",
        "https://consulting-chatbot-riddhimaan-senapatis-projects.vercel.app",
        "https://*.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connecting to MongoDB Database - using lazy initialization for serverless
load_dotenv()
_client = None
_db = None
_discussion_collection = None
_user_collection = None
_plans_collection = None

def get_db_collections():
    """Lazy initialization of database connection for serverless environment"""
    global _client, _db, _discussion_collection, _user_collection, _plans_collection

    if _client is None:
        try:
            mongodb_url = os.getenv("MONGODB_URL")
            if not mongodb_url:
                raise ValueError("MONGODB_URL environment variable not set")
            _client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_url)
            _db = _client.Consulting_data
            _discussion_collection = _db.get_collection("Discussion_data")
            _user_collection = _db.get_collection("User_data")
            _plans_collection = _db.get_collection("plans_data")
        except Exception as e:
            print(f"Error connecting to MongoDB: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

    return _discussion_collection, _user_collection, _plans_collection

# Represents an ObjectId field in the database.
# It will be represented as a `str` on the model so that it can be serialized to JSON.
PyObjectId = Annotated[str, BeforeValidator(str)]

#chain that calls the LLM. Note: This is because of Langgraph that we are using in
#graph.py which requires this to be a chain
# Use lazy initialization for serverless environment
analysis_chain = None

def get_analysis_chain():
    global analysis_chain
    if analysis_chain is None:
        try:
            analysis_chain = initialize_workflow()
        except Exception as e:
            print(f"Error initializing workflow: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to initialize workflow: {str(e)}")
    return analysis_chain

#MongoDb classes for Requests, Responses and users
class AnalysisRequest(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    messages: List[Tuple[str, str]]
    user_input: str


class AnalysisResponse(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    response: str
    full_history: List[Tuple[str,str]]

class User(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    email: EmailStr
    password: str

# Pydantic models for Plans
class Plan(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    title: str = Field(...)
    description: str = Field(...)
    status: str = Field(...)  # e.g., "todo", "inprogress", "done"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {
        "json_encoders": {ObjectId: str},
        "arbitrary_types_allowed": True,
        "populate_by_name": True,
    }

class PlanCreate(BaseModel):
    title: str = Field(...)
    description: str = Field(...)
    status: str = Field(...)

class PlanUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    # updated_at will be set by the server, so not included here for client input


#status check API route
@app.get("/")
async def health_check():
    return {"status": "active", "version": "1.0.0"}

@app.get("/test-env")
async def test_env():
    """Test endpoint to check environment variables"""
    mongodb_url = os.getenv("MONGODB_URL")
    return {
        "mongodb_url_set": mongodb_url is not None,
        "mongodb_url_length": len(mongodb_url) if mongodb_url else 0
    }

#API for downloading the chats
@app.get("/download/")
async def download_analysis(format: str = Query("pdf")):
    discussion_collection, _, _ = get_db_collections()
    # Fetch analysis report from MongoDB
    # obj_id = ObjectId(item_id)
    download_chat = await discussion_collection.find_one(sort=[("_id", -1)])
    print(download_chat)
    if not download_chat:
        return {"error": "Report not found"}

    # Extract relevant data
    messages = download_chat.get("full_history", [])
    analysis_text = "\n".join([f"{msg[0]}: {msg[1]}" for msg in messages])

    # Define file paths - use /tmp for serverless environment
    import tempfile
    temp_dir = tempfile.gettempdir()
    file_path = os.path.join(temp_dir, f"analysis_report.{format}")

    # Generate PDF
    if format == "pdf":
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()
        # Get the absolute path to fonts directory
        fonts_dir = os.path.join(os.path.dirname(__file__), "fonts")
        font_path = os.path.join(fonts_dir, "NotoSans-Regular.ttf")
        pdf.add_font("NotoSans", "", font_path, uni=True)
        pdf.set_font("NotoSans", size=12)
        pdf.multi_cell(0, 10, analysis_text)
        pdf.output(file_path)


    # Return file as response
    return FileResponse(path=file_path, filename=f"analysis_report.{format}", media_type="application/octet-stream")

# main API for communicating with the LLM and storing it in the database
@app.post("/analyze/", response_model = AnalysisResponse)
async def analyze(request: AnalysisRequest = Body(...)):
    try:
        state = {
            "messages": request.messages,
            "input": request.user_input
        }
        chain = get_analysis_chain()
        result = chain.invoke(state)
    except Exception as e:
        print(f"Error in analyze endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    print("Debug - Result:", result)  # Debugging line => I am not getting the "response" from here


    final_data = {
        "messages": request.messages,
        "input": request.user_input,
        "response": result["messages"][-1][1],
        "full_history": request.messages + [(request.user_input, result["messages"][-1][1])]
    }
    print("Final Result:", final_data)  # Debugging line
    # Send result data to the Db
    discussion_collection, _, _ = get_db_collections()
    new_resp = await discussion_collection.insert_one(final_data)

    #Fetch data from Db
    result_chat = await discussion_collection.find_one( {"_id": new_resp.inserted_id})

    return AnalysisResponse(
        id = str(result_chat["_id"]),
        response= result_chat["response"],
        full_history = result_chat["full_history"],
    )

#use bcrypt for password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# API for signup
@app.post("/auth/signup")
async def signup(user: User):
    _, user_collection, _ = get_db_collections()
    # Check if user already exists
    existing_user = await user_collection.find_one({"email": user.email})
    if existing_user:
        return {"error": "User already exists"}

    # Hash the password before storing
    hashed_password = pwd_context.hash(user.password)
    user_dict = user.model_dump()
    user_dict["password"] = hashed_password

    # Insert user into database
    new_user = await user_collection.insert_one(user_dict)

    return {"message": "User created successfully", "user_id": str(new_user.inserted_id)}

#API for Login
@app.post("/auth/login")
async def login(user: User):
    _, user_collection, _ = get_db_collections()
    existing_user = await user_collection.find_one({"email": user.email})
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")

    if not pwd_context.verify(user.password, existing_user["password"]):
        raise HTTPException(status_code=400, detail="Incorrect password")

    return {"message": "Login successful", "user_id": str(existing_user["_id"])}

# --- CRUD Endpoints for Plans ---

@app.post("/plans/", response_model=Plan)
async def create_plan(plan_data: PlanCreate = Body(...)):
    _, _, plans_collection = get_db_collections()
    plan_dict = plan_data.model_dump()
    plan_dict["created_at"] = datetime.utcnow()
    plan_dict["updated_at"] = datetime.utcnow()

    new_plan = await plans_collection.insert_one(plan_dict)
    created_plan_doc = await plans_collection.find_one({"_id": new_plan.inserted_id})
    if created_plan_doc:
        return Plan(**created_plan_doc)
    raise HTTPException(status_code=500, detail="Failed to create plan")

@app.get("/plans/", response_model=List[Plan])
async def get_all_plans():
    try:
        _, _, plans_collection = get_db_collections()
        plans = []
        async for plan_doc in plans_collection.find().sort("created_at", -1): # Sort by newest first
            plans.append(Plan(**plan_doc))
        return plans
    except Exception as e:
        print(f"Error in get_all_plans: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch plans: {str(e)}")

@app.get("/plans/{plan_id}", response_model=Plan)
async def get_plan(plan_id: str):
    _, _, plans_collection = get_db_collections()
    try:
        obj_id = ObjectId(plan_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Plan ID format")

    plan_doc = await plans_collection.find_one({"_id": obj_id})
    if plan_doc:
        return Plan(**plan_doc)
    raise HTTPException(status_code=404, detail=f"Plan with id {plan_id} not found")

@app.put("/plans/{plan_id}", response_model=Plan)
async def update_plan(plan_id: str, plan_update_data: PlanUpdate = Body(...)):
    _, _, plans_collection = get_db_collections()
    try:
        obj_id = ObjectId(plan_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Plan ID format")

    update_data = plan_update_data.model_dump(exclude_unset=True, exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")

    update_data["updated_at"] = datetime.utcnow()

    result = await plans_collection.update_one(
        {"_id": obj_id},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Plan with id {plan_id} not found")

    updated_plan_doc = await plans_collection.find_one({"_id": obj_id})
    if updated_plan_doc:
        return Plan(**updated_plan_doc)
    # This case should ideally not be reached if update was successful
    raise HTTPException(status_code=500, detail="Failed to retrieve updated plan")

@app.delete("/plans/{plan_id}", response_model=dict)
async def delete_plan(plan_id: str):
    _, _, plans_collection = get_db_collections()
    try:
        obj_id = ObjectId(plan_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Plan ID format")

    result = await plans_collection.delete_one({"_id": obj_id})
    if result.deleted_count == 1:
        return {"message": f"Plan {plan_id} deleted successfully"}
    raise HTTPException(status_code=404, detail=f"Plan with id {plan_id} not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
