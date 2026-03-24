# src/preprocess.py

import sys
import os

# Add project root to Python path so config.py can be imported
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import config
from datasets import Dataset
from transformers import BertTokenizer
import torch
from torch.utils.data import DataLoader, TensorDataset

# Initialize BERT tokenizer
tokenizer = BertTokenizer.from_pretrained(config.MODEL_NAME)

def tokenize_dataset(dataset_split):
    """
    Tokenize the 'text' column of a Hugging Face dataset split.
    Args:
        dataset_split: Dataset object (train or test)
    Returns:
        TensorDataset for PyTorch
    """
    # Convert the 'text' column to a Python list
    texts = list(dataset_split["text"])   # <-- fixed
    labels = list(dataset_split["label"]) # also ensure labels are a list

    # Tokenize all texts
    encoding = tokenizer(
        texts,
        padding="max_length",
        truncation=True,
        max_length=config.MAX_LENGTH,
        return_tensors="pt"
    )

    # Convert labels to tensors
    labels_tensor = torch.tensor(labels)

    # Return a TensorDataset
    dataset = TensorDataset(
        encoding["input_ids"],
        encoding["attention_mask"],
        labels_tensor
    )
    return dataset
def create_dataloaders(dataset, batch_size=config.BATCH_SIZE):
    """
    Create PyTorch DataLoaders for train and test splits.
    """
    train_dataset = tokenize_dataset(dataset["train"])
    test_dataset = tokenize_dataset(dataset["test"])

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=batch_size)

    return train_loader, test_loader

# Optional test
if __name__ == "__main__":
    from src.load_data import load_babe_dataset
    dataset = load_babe_dataset()
    train_loader, test_loader = create_dataloaders(dataset)

    # Print the first batch for verification
    batch = next(iter(train_loader))
    print("input_ids shape:", batch[0].shape)
    print("attention_mask shape:", batch[1].shape)
    print("labels shape:", batch[2].shape)