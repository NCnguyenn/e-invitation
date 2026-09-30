import os
import sys
import urllib.request
from pathlib import Path
import numpy as np
from PIL import Image
import onnxruntime as ort

MODEL_DIR = Path.home() / ".u2net"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
MODEL_NAME = "u2netp.onnx" # 4.7MB fast model
MODEL_URL = f"https://github.com/danielgatis/rembg/releases/download/v0.0.0/{MODEL_NAME}"
MODEL_PATH = MODEL_DIR / MODEL_NAME

def ensure_model():
    if not MODEL_PATH.exists():
        print(f"Downloading {MODEL_NAME} ({MODEL_URL})...")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print("Model downloaded.")
    else:
        print(f"Model already exists at {MODEL_PATH}")

def remove_background(image_path: str, output_path: str):
    ensure_model()
    print(f"Loading {image_path}...")
    orig_img = Image.open(image_path).convert("RGB")
    orig_w, orig_h = orig_img.size

    # Preprocess
    img_resized = orig_img.resize((320, 320), Image.BILINEAR)
    img_np = np.array(img_resized).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img_norm = (img_np - mean) / std
    img_trans = np.transpose(img_norm, (2, 0, 1))
    input_tensor = np.expand_dims(img_trans, axis=0).astype(np.float32)

    print("Running ONNX inference...")
    session = ort.InferenceSession(str(MODEL_PATH), providers=['CPUExecutionProvider'])
    input_name = session.get_inputs()[0].name
    outputs = session.run(None, {input_name: input_tensor})
    
    # Postprocess output mask (d0 is the first output)
    pred = outputs[0][0, 0, :, :]
    pred_min, pred_max = pred.min(), pred.max()
    pred_norm = (pred - pred_min) / (pred_max - pred_min + 1e-8)
    mask = (pred_norm * 255).astype(np.uint8)

    mask_img = Image.fromarray(mask).resize((orig_w, orig_h), Image.BILINEAR)
    
    # Apply alpha mask
    result = orig_img.copy().convert("RGBA")
    result.putalpha(mask_img)

    print(f"Saving to {output_path}...")
    result.save(output_path, "WEBP", quality=95)
    print("Done!")

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "public/templates/graduation-editorial-01/hero-cutout.webp"
    dst = sys.argv[2] if len(sys.argv) > 2 else src
    remove_background(src, dst)
