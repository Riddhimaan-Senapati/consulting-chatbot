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

app = FastAPI()
# Added CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Update with the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connecting to MongoDB Database
load_dotenv()
client = motor.motor_asyncio.AsyncIOMotorClient(os.getenv("MONGODB_URL"))
db = client.Consulting_data
discussion_collection = db.get_collection("Discussion_data")
user_collection = db.get_collection("User_data")

# Represents an ObjectId field in the database.
# It will be represented as a `str` on the model so that it can be serialized to JSON.
PyObjectId = Annotated[str, BeforeValidator(str)]

#chain that calls the LLM. Note: This is because of Langgraph that we are using in
#graph.py which requires this to be a chain
analysis_chain = initialize_workflow()

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

#status check API route
@app.get("/")
async def health_check():
    return {"status": "active", "version": "1.0.0"}

#API for downloading the chats
@app.get("/download/")
async def download_analysis(format: str = Query("pdf")):
    # Fetch analysis report from MongoDB
    # obj_id = ObjectId(item_id)
    download_chat = await discussion_collection.find_one(sort=[("_id", -1)])
    print(download_chat)
    if not download_chat:
        return {"error": "Report not found"}

    # Extract relevant data
    messages = download_chat.get("full_history", [])
    analysis_text = "\n".join([f"{msg[0]}: {msg[1]}" for msg in messages])

    # Define file paths
    file_path = f"analysis_report.{format}"

    # Generate PDF
    if format == "pdf":
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()
        pdf.add_font("NotoSans", "", "fonts/NotoSans-Regular.ttf", uni=True)
        pdf.set_font("NotoSans", size=12)
        pdf.multi_cell(0, 10, analysis_text)
        pdf.output(file_path)
    

    # Return file as response
    return FileResponse(path=file_path, filename=file_path, media_type="application/octet-stream")

# main API for communicating with the LLM and storing it in the database
@app.post("/analyze/", response_model = AnalysisResponse)
async def analyze(request: AnalysisRequest = Body(...)):
    state = {
        "messages": request.messages,
        "input": request.user_input
    }
    result = analysis_chain.invoke(state)

    print("Debug - Result:", result)  # Debugging line => I am not getting the "response" from here


    final_data = {
        "messages": request.messages,
        "input": request.user_input,
        "response": result["messages"][-1][1],
        "full_history": request.messages + [(request.user_input, result["messages"][-1][1])]
    }
    print("Final Result:", final_data)  # Debugging line
    # Send result data to the Db  
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
    existing_user = await user_collection.find_one({"email": user.email})
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")

    if not pwd_context.verify(user.password, existing_user["password"]):
        raise HTTPException(status_code=400, detail="Incorrect password")

    return {"message": "Login successful", "user_id": str(existing_user["_id"])}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
