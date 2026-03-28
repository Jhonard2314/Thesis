# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV PIP_NO_CACHE_DIR 1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements.txt first to leverage Docker cache
COPY hf_requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r hf_requirements.txt

# Pre-download the BERT base model during build to speed up startup
RUN python -c "from transformers import BertTokenizer, BertForSequenceClassification; \
    BertTokenizer.from_pretrained('bert-base-uncased'); \
    BertForSequenceClassification.from_pretrained('bert-base-uncased', num_labels=2)"

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 7860

# Command to run the application
CMD ["uvicorn", "hf_api:app", "--host", "0.0.0.0", "--port", "7860"]
