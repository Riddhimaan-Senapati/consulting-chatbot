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

# 2. Create and Activate a Virtual Environment with Poetry

Navigate to the `backend` directory:
```
cd backend
```
Poetry automatically creates and manages virtual environments. To get started, run:
```
poetry install
```
This command will create a virtual environment (if one doesn't exist) and install all dependencies specified in `pyproject.toml`.

# 3. Activate the Virtual Environment (Optional, for direct shell access)

If you need to work within the virtual environment's shell (e.g., to run Python scripts directly), activate it using:

```
poetry shell
```
To exit the Poetry shell, type `exit`.

# 4. Set up Environment Variables

Make sure you have a MongoDB cluster URL, TAVILY API, and GEMINI API keys to be set up in a .env file in the backend folder.

There is a .env.example file where the keys are defined, just copy these in your .env file using:

```
cp .env.example .env
```

and then fill the .env file with API key values.

Remember to never commit .env files.

# 5. Run the FastAPI Application

Run the FastAPI application using Poetry:

```
poetry run uvicorn main:app --host 0.0.0.0 --port 8000
```

# 6. Access the Application

Once the server is running, you can access the FastAPI application in your web browser at: `http://127.0.0.1:8000`

You can also access the interactive API documentation at: `http://127.0.0.1:8000/docs`

# 7. Testing

There are also tests to make sure the backend is working in the `test_main.py` file. In order to use the tests, go to the backend folder and use the following command:

```
poetry run pytest
```
You should be able to see the test results.



