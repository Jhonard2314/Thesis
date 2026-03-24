# src/train.py

import sys
import os

# Add project root to Python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import config
import torch
from torch import nn
from torch.utils.data import DataLoader
from transformers import BertForSequenceClassification, get_linear_schedule_with_warmup
from torch.optim import AdamW
from src.load_data import load_babe_dataset
from src.preprocess import create_dataloaders

# Check device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Using device:", device)

# Load dataset and create dataloaders
dataset = load_babe_dataset()
train_loader, test_loader = create_dataloaders(dataset, batch_size=config.BATCH_SIZE)

# Initialize BERT model for sequence classification
model = BertForSequenceClassification.from_pretrained(
    config.MODEL_NAME,
    num_labels=2  # BABE labels are 0/1
)
model.to(device)

# Optimizer and scheduler
optimizer = AdamW(model.parameters(), lr=config.LEARNING_RATE, weight_decay=config.WEIGHT_DECAY)
total_steps = len(train_loader) * config.EPOCHS
scheduler = get_linear_schedule_with_warmup(optimizer, num_warmup_steps=0, num_training_steps=total_steps)

# Loss function
criterion = nn.CrossEntropyLoss()

# Training loop
for epoch in range(config.EPOCHS):
    model.train()
    total_loss = 0
    for batch in train_loader:
        input_ids, attention_mask, labels = [x.to(device) for x in batch]

        optimizer.zero_grad()
        outputs = model(input_ids=input_ids, attention_mask=attention_mask, labels=labels)
        loss = outputs.loss
        total_loss += loss.item()
        loss.backward()
        optimizer.step()
        scheduler.step()

    avg_loss = total_loss / len(train_loader)
    print(f"Epoch {epoch+1}/{config.EPOCHS} - Training Loss: {avg_loss:.4f}")

    # Evaluation after each epoch
    model.eval()
    correct, total = 0, 0
    with torch.no_grad():
        for batch in test_loader:
            input_ids, attention_mask, labels = [x.to(device) for x in batch]
            outputs = model(input_ids=input_ids, attention_mask=attention_mask)
            predictions = torch.argmax(outputs.logits, dim=1)
            correct += (predictions == labels).sum().item()
            total += labels.size(0)
    acc = correct / total
    print(f"Epoch {epoch+1} - Test Accuracy: {acc:.4f}")

# Save the trained model
os.makedirs(config.MODEL_DIR, exist_ok=True)
model_save_path = os.path.join(config.MODEL_DIR, "bert_babe.pt")
torch.save(model.state_dict(), model_save_path)
print(f"Model saved to {model_save_path}")