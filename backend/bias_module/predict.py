# src/predict.py

import sys
import os

# -----------------------------
# Add project root to Python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# -----------------------------
import torch
from transformers import BertTokenizer, BertForSequenceClassification
from sklearn.metrics import classification_report
from load_data import load_babe_dataset
from preprocess import create_dataloaders
import config

# -----------------------------
# Device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Using device:", device)

# -----------------------------
# Load tokenizer and model
tokenizer = BertTokenizer.from_pretrained(config.MODEL_NAME)
model = BertForSequenceClassification.from_pretrained(
    config.MODEL_NAME,
    num_labels=2
)

model_path = os.path.join(PROJECT_ROOT, "models", "bert_babe.pt")
model.load_state_dict(torch.load(model_path, map_location=device))

model.to(device)
model.eval()
print(f"Model loaded successfully from {model_path}")

# -----------------------------
# Evaluate on test set
def evaluate_model(test_loader):
    true_labels = []
    predicted_labels = []

    with torch.no_grad():
        for batch in test_loader:
            input_ids, attention_mask, labels = [x.to(device) for x in batch]
            outputs = model(input_ids=input_ids, attention_mask=attention_mask)
            predictions = torch.argmax(outputs.logits, dim=1)

            true_labels.extend(labels.cpu().numpy())
            predicted_labels.extend(predictions.cpu().numpy())

    print("\n=== Evaluation on Test Set ===")
    print(classification_report(true_labels, predicted_labels, target_names=["factual", "biased"]))

# -----------------------------
# Load dataset and dataloaders
dataset = load_babe_dataset()
_, test_loader = create_dataloaders(dataset, batch_size=config.BATCH_SIZE)
evaluate_model(test_loader)

# -----------------------------
# 🔹 NEW: Get top biased words using gradients
def get_top_biased_words(text, top_k=5):
    encoding = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding="max_length",
        max_length=config.MAX_LENGTH
    )

    input_ids = encoding["input_ids"].to(device)
    attention_mask = encoding["attention_mask"].to(device)

    # Enable gradients
    model.zero_grad()

    outputs = model(input_ids=input_ids, attention_mask=attention_mask)
    logits = outputs.logits

    # Focus on "biased" class
    bias_logit = logits[0, 1]
    bias_logit.backward()

    # Get gradients from embedding layer
    embedding_grad = model.bert.embeddings.word_embeddings.weight.grad

    token_ids = input_ids[0]
    token_grads = embedding_grad[token_ids]

    # Importance score = L2 norm
    scores = torch.norm(token_grads, dim=1)

    tokens = tokenizer.convert_ids_to_tokens(token_ids)

    # Filter special tokens
    filtered = [
        (tok, score.item())
        for tok, score in zip(tokens, scores)
        if tok not in ["[CLS]", "[SEP]", "[PAD]"]
    ]

    # Sort by importance
    sorted_tokens = sorted(filtered, key=lambda x: x[1], reverse=True)

    return sorted_tokens[:top_k]

# -----------------------------
# Function for predicting single text
def predict_text(text):
    encoding = tokenizer(
        text,
        return_tensors="pt",
        padding="max_length",
        truncation=True,
        max_length=config.MAX_LENGTH
    ).to(device)

    with torch.no_grad():
        outputs = model(**encoding)

        probs = torch.softmax(outputs.logits, dim=1)

        bias_prob = probs[0][1].item()
        factual_prob = probs[0][0].item()

        prediction = torch.argmax(probs, dim=1).item()

    label = "biased" if prediction == 1 else "factual"

    result = {
        "label": label,
        "bias_score": bias_prob,
        "factual_score": factual_prob
    }

    # 🔹 Only compute word importance if biased
    if label == "biased":
        result["top_biased_words"] = get_top_biased_words(text)

    return result

# -----------------------------
# Interactive loop
print("\n=== Custom News Prediction ===")
print("Type 'exit' to quit.")

while True:
    text = input("\nEnter news text: ")
    if text.lower() == "exit":
        break

    result = predict_text(text)

    print("\nPrediction:", result["label"])
    print(f"Bias Score: {result['bias_score']:.4f}")
    print(f"Factual Score: {result['factual_score']:.4f}")

    # Interpretation
    if result["bias_score"] > 0.7:
        print("Interpretation: Strongly biased")
    elif result["bias_score"] > 0.5:
        print("Interpretation: Slightly biased / borderline")
    else:
        print("Interpretation: Likely factual")

    # 🔹 Show top biased words
    if result["label"] == "biased":
        print("\nTop Biased Words:")
        for word, score in result["top_biased_words"]:
            print(f"{word} ({score:.4f})")