This is the backend of our code. We are using FastAPI to create our API routes. 

Here are the the [FastAPI docs](https://fastapi.tiangolo.com/)
Here's an example using both [FastAPI+MongoDB](https://www.mongodb.com/developer/languages/python/python-quickstart-fastapi/)

[FastAPI in the MongoDB docs](https://www.mongodb.com/developer/technologies/fastapi/)

## Installation and usage

# 1. Prerequisites

Make sure you have the following installed on your machine:

- Python 3.7 or higher
- pip (Python package installer)

You also need to have a MongoDB cluster URL, TAVILY API and GEMINI API keys to be set up in a .env file in the backend folder. 

There is a .env.example file where the keys are defined, just copy these in your .env file using

```
cp .env.example .env
```

and then fill the .env file with API key values.

Remember to never commit .env files

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
source .venv/bin/activate
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

##   Testing

There are also tests to make sure the backend is working in the  `test_main.py` file.  In order to use the tests, go to the backend folder and use the following command

```
pytest
```
You should be able to see the test results.



