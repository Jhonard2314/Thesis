# src/evaluate.py

import sys
import os
import torch
from sklearn.metrics import classification_report, accuracy_score
from transformers import BertTokenizer, BertForSequenceClassification

# -----------------------------
# Determine project root dynamically
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Now imports work reliably
from load_data import load_babe_dataset
from preprocess import create_dataloaders
import config

# -----------------------------
# Device setup
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Using device:", device)

# -----------------------------
# Load tokenizer and model
print("Loading model and tokenizer...")
try:
    model_cache_dir = os.path.join(PROJECT_ROOT, "bias_module", "data", "model_cache")
    if os.path.exists(model_cache_dir):
        print(f"Loading from local cache: {model_cache_dir}")
        tokenizer = BertTokenizer.from_pretrained(model_cache_dir)
        model = BertForSequenceClassification.from_pretrained(
            model_cache_dir,
            num_labels=2
        )
    else:
        print(f"Loading from HF Hub: {config.MODEL_NAME}")
        tokenizer = BertTokenizer.from_pretrained(config.MODEL_NAME)
        model = BertForSequenceClassification.from_pretrained(
            config.MODEL_NAME,
            num_labels=2
        )

    # Correct model path regardless of current working directory
    model_path = os.path.join(PROJECT_ROOT, "models", "bert_babe.pt")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found at {model_path}")

    model.load_state_dict(torch.load(model_path, map_location=device))
    model.to(device)
    model.eval()
    print(f"Model loaded successfully from {model_path}")
except Exception as e:
    print(f"Error loading model: {e}")
    sys.exit(1)

# -----------------------------
# Load dataset and create dataloaders
dataset = load_babe_dataset()
_, test_loader = create_dataloaders(dataset, batch_size=config.BATCH_SIZE)

# -----------------------------
# Evaluation function
def evaluate_model(model, test_loader):
    print("Starting evaluation...")
    true_labels = []
    predicted_labels = []

    with torch.no_grad():
        for i, batch in enumerate(test_loader):
            if i % 10 == 0:
                print(f"Processing batch {i}...")
            input_ids, attention_mask, labels = [x.to(device) for x in batch]
            outputs = model(input_ids=input_ids, attention_mask=attention_mask)
            predictions = torch.argmax(outputs.logits, dim=1)

            true_labels.extend(labels.cpu().numpy())
            predicted_labels.extend(predictions.cpu().numpy())

    print("Calculating metrics...")
    acc = accuracy_score(true_labels, predicted_labels)
    report = classification_report(true_labels, predicted_labels, target_names=["factual", "biased"])
    
    # Save to file as well as print
    with open("evaluation_results.txt", "w") as f:
        f.write(f"Test Accuracy: {acc:.4f}\n")
        f.write("\nClassification Report:\n")
        f.write(report)
        
    print(f"\nTest Accuracy: {acc:.4f}")
    print("\nClassification Report:")
    print(report)

# -----------------------------
# Run evaluation
if __name__ == "__main__":
    evaluate_model(model, test_loader)