from huggingface_hub import snapshot_download
import os
from datasets import load_from_disk, load_dataset

repo_id = "mediabiasgroup/BABE"
cache_dir = os.path.abspath("bias_module/data/cache")
os.makedirs(cache_dir, exist_ok=True)

try:
    print(f"Downloading snapshot for {repo_id}...")
    # Try downloading to a local path that doesn't look like a repo ID
    local_dir = snapshot_download(repo_id=repo_id, repo_type="dataset", local_dir=cache_dir)
    print(f"Downloaded to {local_dir}")
    
    # Try loading from the local dir
    print("Attempting to load from local dir...")
    dataset = load_dataset(local_dir)
    print("Success!")
    print(dataset)
except Exception as e:
    print(f"Error: {e}")
