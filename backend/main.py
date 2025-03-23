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
import os

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# Connecting to MongoDB Database
client = motor.motor_asyncio.AsyncIOMotorClient(os.getenv("MONGODB_URL"))
db = client.Consulting_data
discussion_collection = db.get_collection("Discussion_data")



# Represents an ObjectId field in the database.
# It will be represented as a `str` on the model so that it can be serialized to JSON.
PyObjectId = Annotated[str, BeforeValidator(str)]


class AnalysisRequest(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    messages: List[Tuple[str, str]]
    user_input: str


class AnalysisResponse(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    response: str
    full_history: List[Tuple[str,str]]




analysis_chain = initialize_workflow()


@app.get("/")
async def health_check():
    return {"status": "active", "version": "1.0.0"}


@app.get("/download/{item_id}")
async def download_analysis(item_id: str, format: str = Query("pdf", enum=["pdf", "csv"])):
    # Fetch analysis report from MongoDB
    obj_id = ObjectId(item_id)
    download_chat = await discussion_collection.find_one({"_id": obj_id})
    print(download_chat)
    if not download_chat:
        return {"error": "Report not found"}

    # Extract relevant data
    messages = download_chat.get("messages", [])
    analysis_text = "\n".join([f"{msg[0]}: {msg[1]}" for msg in messages])

    # Define file paths
    file_path = f"analysis_report_{item_id}.{format}"

    # Generate PDF
    if format == "pdf":
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        pdf.multi_cell(0, 10, analysis_text)
        pdf.output(file_path)
    
    # Generate CSV
    elif format == "csv":
        df = pd.DataFrame(messages, columns=["Sender", "Message"])
        df.to_csv(file_path, index=False)

    # Return file as response
    return FileResponse(path=file_path, filename=file_path, media_type="application/octet-stream")

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


