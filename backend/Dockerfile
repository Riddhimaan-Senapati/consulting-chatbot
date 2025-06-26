FROM python:3.12-alpine

# Install build dependencies
RUN apk add --no-cache gcc musl-dev libffi-dev

# Install uv
RUN pip install --no-cache-dir uv

WORKDIR /app

# Copy only the dependency files first for better caching
COPY pyproject.toml uv.lock* ./

# Install dependencies
RUN uv pip install --system -e .

# Copy the rest of the application code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"] 