import sys, os, time, json

_current = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.dirname(_current)
_project_root = os.path.dirname(_backend_dir)
for _p in [
    _current,
    _backend_dir,
    _project_root,
    os.path.join(_backend_dir, "core"),
    os.path.join(_backend_dir, "bias_module"),
]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from core.news_service import NewsService

MODEL_PATH = os.path.join(_backend_dir, "models", "bert_babe.pt")
TEST_TEXT = "The corrupt government conspired with big corporations to destroy the lives of ordinary people."

print("=" * 70)
print("TEST 1: File integrity (size / torch.load)")
print("=" * 70)
st = os.stat(MODEL_PATH)
print(f"Path   : {MODEL_PATH}")
print(f"Size   : {st.st_size} bytes ({st.st_size/1024/1024:.1f} MB)")
print(f"Mtime  : {time.ctime(st.st_mtime)}")
print("Loading with torch.load(map_location='cpu') ...")
import torch
try:
    ckpt = torch.load(MODEL_PATH, map_location="cpu")
    print(f"OK: torch.load SUCCESS")
    print(f"  type = {type(ckpt).__name__}")
    if isinstance(ckpt, dict):
        print(f"  keys = {list(ckpt.keys())}")
        for k, v in ckpt.items():
            if hasattr(v, "shape"):
                print(f"    {k}: shape={tuple(v.shape)}, dtype={v.dtype}")
            else:
                print(f"    {k}: {type(v).__name__} = {str(v)[:100]}")
    del ckpt
except Exception as e:
    print(f"FAIL: torch.load failed: {type(e).__name__}: {e}")
    sys.exit(1)

print()
print("=" * 70)
print("TEST 2: NewsService().load_local_bias_model() end-to-end")
print("=" * 70)
s = NewsService()
ok = s.load_local_bias_model()
print(f"load_local_bias_model() returned: {ok}")
print(f"s.bias_model     is loaded: {s.bias_model is not None}")
print(f"s.bias_tokenizer is loaded: {s.bias_tokenizer is not None}")
if s.bias_model is not None:
    n_params = sum(p.numel() for p in s.bias_model.parameters())
    print(f"  model params  : {n_params:,}")
    print(f"  model class   : {type(s.bias_model).__name__}")
if s.bias_tokenizer is not None:
    print(f"  tokenizer cls : {type(s.bias_tokenizer).__name__}")
if not ok or s.bias_model is None:
    print("FAIL: could not load local bias model")
    sys.exit(2)

print()
print("=" * 70)
print("TEST 3: Actual bias prediction")
print("=" * 70)
print(f"Input text : {TEST_TEXT}")
label, conf, logits = s.predict_bias_local(TEST_TEXT)
print(f"label      : {label}")
print(f"confidence : {conf}")
print(f"logits     : {logits}")
if label is None:
    print("FAIL: prediction returned None")
    sys.exit(3)
else:
    print("SUCCESS: bias prediction completed with actual result")
