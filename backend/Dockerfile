FROM python:3.12-alpine

# Install build dependencies
RUN apk add --no-cache gcc musl-dev libffi-dev

# Install Poetry
RUN pip install --no-cache-dir poetry

WORKDIR /app

# Copy only the dependency files first for better caching
COPY pyproject.toml poetry.lock* ./

# Install dependencies (no virtualenv, install to system)
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi

# Copy the rest of the application code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"] 