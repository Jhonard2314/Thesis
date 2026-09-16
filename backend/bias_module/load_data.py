# src/load_data.py

import sys
import os

# Ensure the project root (parent of src/) is in Python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)  # insert at the beginning

# Now we can safely import config
import config
from datasets import load_dataset, DatasetDict, Dataset
import pandas as pd

def load_babe_dataset():
    """
    Load the BABE dataset from local parquet files if available,
    otherwise from Hugging Face.
    Returns:
        dataset: DatasetDict with 'train' and 'test' splits
    """
    local_train = os.path.join(PROJECT_ROOT, "bias_module", "data", "cache", "data", "train-00000-of-00001.parquet")
    local_test = os.path.join(PROJECT_ROOT, "bias_module", "data", "cache", "data", "test-00000-of-00001.parquet")

    if os.path.exists(local_train) and os.path.exists(local_test):
        print("Loading BABE dataset from local parquet files...")
        train_df = pd.read_parquet(local_train)
        test_df = pd.read_parquet(local_test)
        
        dataset = DatasetDict({
            "train": Dataset.from_pandas(train_df),
            "test": Dataset.from_pandas(test_df)
        })
        return dataset

    print(f"Loading BABE dataset from Hugging Face ({config.DATASET_NAME})...")
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