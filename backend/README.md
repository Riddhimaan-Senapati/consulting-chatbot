This is the backend of our code. We are using FastAPI to create our API routes.

## Installation and usage

# 1. Prerequisites

Make sure you have the following installed on your machine:

- Python 3.7 or higher
- pip (Python package installer)

You also need to have a TAVILY API and GEMINI API keys to be set up in a .env file in the backend folder

# 2. Create a Virtual Environment
Create a virtual environment to isolate your project dependencies:

```
python -m venv .venv
```

# 3. Activate the Virtual Environment

Activate the virtual environment:

```
#For Windows
.venv\Scripts\Activate.ps1

#For macOS/Linux
source venv/bin/activate
```

# 4. Install Dependencies

Install the required packages from requirements.txt:

```
pip install -r requirements.txt
```

# 5. Run the FastAPI Application

Run the FastAPI application using the following command:

```
fastapi dev main.py
```

# 6. Access the Application

Once the server is running, you can access the FastAPI application in your web browser at: `http://127.0.0.1:8000`

You can also access the interactive API documentation at: `http://127.0.0.1:8000/docs`

# 7. Deactivating the Virtual Environment

When you're done working, you can deactivate the virtual environment by running:

```
deactivate
```

