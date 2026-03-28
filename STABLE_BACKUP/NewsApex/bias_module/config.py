# config.py

# ---------------- Model and Dataset ----------------
MODEL_NAME = "bert-base-uncased"       # pre-trained BERT model
DATASET_NAME = "mediabiasgroup/BABE"   # Hugging Face dataset

# ---------------- Training Parameters ----------------
MAX_LENGTH = 128        # max token length per sentence
BATCH_SIZE = 16         # batch size for training
EPOCHS = 3              # number of training epochs
LEARNING_RATE = 2e-5    # optimizer learning rate
WEIGHT_DECAY = 0.01     # regularization

# ---------------- Paths ----------------
MODEL_DIR = "./models"   # where to save fine-tuned model
DATA_DIR = "./data"      # optional cache folder