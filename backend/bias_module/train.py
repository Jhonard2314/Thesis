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
from load_data import load_babe_dataset
from preprocess import create_dataloaders
from tqdm import tqdm

# ── Device setup ─────────────────────────────────────────────────────────────
# Force GPU if available, with a clear message so you know which is being used.
if torch.cuda.is_available():
    device = torch.device("cuda")
    print(f"Using GPU: {torch.cuda.get_device_name(0)}")
    print(f"  VRAM available: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
else:
    device = torch.device("cpu")
    print("WARNING: No CUDA GPU detected — falling back to CPU. Training will be slow.")

# ── Dataset and dataloaders ───────────────────────────────────────────────────
dataset = load_babe_dataset()
train_loader, test_loader = create_dataloaders(dataset, batch_size=config.BATCH_SIZE)

# ── Model ─────────────────────────────────────────────────────────────────────
model = BertForSequenceClassification.from_pretrained(
    config.MODEL_NAME,
    num_labels=2  # BABE labels: 0 = factual, 1 = biased
)
model.to(device)

# ── Optimizer and scheduler ───────────────────────────────────────────────────
optimizer = AdamW(model.parameters(), lr=config.LEARNING_RATE, weight_decay=config.WEIGHT_DECAY)
total_steps = len(train_loader) * config.EPOCHS
scheduler = get_linear_schedule_with_warmup(
    optimizer,
    num_warmup_steps=int(0.1 * total_steps),  # 10% warmup
    num_training_steps=total_steps
)

criterion = nn.CrossEntropyLoss()

# ── Best-model checkpoint tracking ───────────────────────────────────────────
os.makedirs(config.MODEL_DIR, exist_ok=True)
best_accuracy = 0.0
best_epoch = 0
model_save_path = os.path.join(config.MODEL_DIR, "bert_babe.pt")

print(f"\nStarting training for {config.EPOCHS} epochs...\n")

# ── Training loop ─────────────────────────────────────────────────────────────
for epoch in range(config.EPOCHS):
    # --- Train ---
    model.train()
    total_loss = 0

    progress_bar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{config.EPOCHS}", unit="batch", ncols=80)
    for batch in progress_bar:
        input_ids, attention_mask, labels = [x.to(device) for x in batch]

        optimizer.zero_grad()
        outputs = model(input_ids=input_ids, attention_mask=attention_mask, labels=labels)
        loss = outputs.loss
        total_loss += loss.item()
        loss.backward()

        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

        optimizer.step()
        scheduler.step()
        progress_bar.set_postfix(loss=f"{loss.item():.4f}")

    avg_loss = total_loss / len(train_loader)

    # --- Evaluate ---
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
    print(f"Epoch {epoch+1}/{config.EPOCHS} — Loss: {avg_loss:.4f} | Test Accuracy: {acc:.4f}", end="")

    # --- Save best checkpoint ---
    if acc > best_accuracy:
        best_accuracy = acc
        best_epoch = epoch + 1
        torch.save(model.state_dict(), model_save_path)
        print(f"  ✓ New best — saved to {model_save_path}")
    else:
        print(f"  (best so far: {best_accuracy:.4f} at epoch {best_epoch})")

print(f"\nTraining complete.")
print(f"Best accuracy: {best_accuracy:.4f} at epoch {best_epoch}/{config.EPOCHS}")
print(f"Best model saved to: {model_save_path}")
