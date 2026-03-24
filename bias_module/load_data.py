# src/load_data.py

import sys
import os

# Ensure the project root (parent of src/) is in Python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)  # insert at the beginning

# Now we can safely import config
import config
from datasets import load_dataset

def load_babe_dataset():
    """
    Load the BABE dataset from Hugging Face and split into train/test.
    Returns:
        dataset: dict with 'train' and 'test' splits
    """
    # Load the full dataset
    dataset = load_dataset(config.DATASET_NAME)

    # BABE dataset doesn't have a default validation split
    # Split the training data into train (80%) and test (20%)
    dataset = dataset["train"].train_test_split(test_size=0.2)

    return dataset

# Optional: test loading
if __name__ == "__main__":
    dataset = load_babe_dataset()
    print(dataset)
    print(dataset["train"][0])