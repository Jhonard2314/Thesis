from datasets import load_dataset
try:
    print("Testing dataset load...")
    dataset = load_dataset("mediabiasgroup/BABE")
    print("Success!")
    print(dataset)
except Exception as e:
    print(f"Error: {e}")
