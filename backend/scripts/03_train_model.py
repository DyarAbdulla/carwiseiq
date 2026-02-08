#!/usr/bin/env python3
"""
03_train_model.py - Train two-headed EfficientNetB4 (make + model) on car images.

- Uses ALL GPUs: MirroredStrategy if 2+, memory growth. Uses ALL CPU: intra/inter_op
  parallelism threads = cpu_count. tf.data.AUTOTUNE prefetch.
- Data augmentation: rotation, flip, brightness, zoom (training only)
- Transfer learning: EfficientNetB4 (ImageNet), two heads
- Saves: models/car_classifier.keras, models/car_classifier_label_maps.json, models/training_report.txt

Options: --epochs, --batch-size, --lr, --lr-reduce, --mixed-precision, --splits-json, --label-maps, --model-dir
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

import numpy as np

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_SPLITS = ROOT / "data" / "splits.json"
DEFAULT_LABEL_MAPS = ROOT / "data" / "label_maps.json"
DEFAULT_MODEL_DIR = ROOT / "models"


# ImageNet normalization for EfficientNet (same as preprocess_input)
_IMAGENET_MEAN = [0.485, 0.456, 0.406]
_IMAGENET_STD = [0.229, 0.224, 0.225]


def _build_tf_datasets(splits_path: Path, label_maps_path: Path, batch_size: int, target_size: tuple):
    """
    Build tf.data.Dataset pipelines with parallel CPU loading (num_parallel_calls=AUTOTUNE)
    so the GPU is fed continuously. Replaces the old from_generator + CarSequence which
    ran on a single thread and starved the GPU.
    """
    import tensorflow as tf

    with open(splits_path, encoding="utf-8") as f:
        splits = json.load(f)
    with open(label_maps_path, encoding="utf-8") as f:
        label_maps = json.load(f)

    num_makes = int(label_maps["num_makes"])
    num_models = int(label_maps["num_models"])
    h, w = target_size[0], target_size[1]

    def _parse(path: tf.Tensor, make_idx: tf.Tensor, model_idx: tf.Tensor, augment: bool):
        raw = tf.io.read_file(path)
        img = tf.io.decode_image(raw, channels=3, expand_animations=False)
        img.set_shape([None, None, 3])
        img = tf.image.resize(img, [h, w], method="bilinear")
        img = tf.cast(img, tf.float32)
        if augment:
            img = tf.image.random_flip_left_right(img)
            img = tf.image.random_brightness(img, 0.2)
            img = tf.image.random_contrast(img, 0.8, 1.2)
        # EfficientNet / ImageNet normalization
        img = (img / 255.0 - _IMAGENET_MEAN) / _IMAGENET_STD
        make_oh = tf.one_hot(tf.cast(make_idx, tf.int32), num_makes, dtype=tf.float32)
        model_oh = tf.one_hot(tf.cast(model_idx, tf.int32), num_models, dtype=tf.float32)
        return img, (make_oh, model_oh)

    def _parse_train(p, m, mo):
        return _parse(p, m, mo, augment=True)

    def _parse_val(p, m, mo):
        return _parse(p, m, mo, augment=False)

    # Filter to existing paths
    train_recs = [r for r in splits["train"] if Path(r["path"]).exists()]
    val_recs = [r for r in splits["val"] if Path(r["path"]).exists()]
    if not train_recs or not val_recs:
        raise FileNotFoundError("No existing image paths in splits; check car_images and splits.json.")

    paths_t = tf.constant([r["path"] for r in train_recs])
    make_t = tf.constant([r["make_idx"] for r in train_recs], dtype=tf.int32)
    model_t = tf.constant([r["model_idx"] for r in train_recs], dtype=tf.int32)

    train_ds = tf.data.Dataset.from_tensor_slices((paths_t, make_t, model_t))
    train_ds = train_ds.shuffle(min(10000, len(train_recs)), reshuffle_each_iteration=True)
    train_ds = train_ds.map(_parse_train, num_parallel_calls=tf.data.AUTOTUNE)
    train_ds = train_ds.batch(batch_size)
    train_ds = train_ds.prefetch(tf.data.AUTOTUNE)

    paths_v = tf.constant([r["path"] for r in val_recs])
    make_v = tf.constant([r["make_idx"] for r in val_recs], dtype=tf.int32)
    model_v = tf.constant([r["model_idx"] for r in val_recs], dtype=tf.int32)

    val_ds = tf.data.Dataset.from_tensor_slices((paths_v, make_v, model_v))
    val_ds = val_ds.map(_parse_val, num_parallel_calls=tf.data.AUTOTUNE)
    val_ds = val_ds.batch(batch_size)
    val_ds = val_ds.prefetch(tf.data.AUTOTUNE)

    n_train = len(train_recs)
    n_val = len(val_recs)
    steps_per_epoch = int(np.ceil(n_train / batch_size))
    validation_steps = int(np.ceil(n_val / batch_size))

    logger.info("tf.data pipeline: parallel map (AUTOTUNE), prefetch; train=%d, val=%d batches",
                steps_per_epoch, validation_steps)
    return train_ds, val_ds, splits, label_maps, steps_per_epoch, validation_steps


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--splits-json", type=Path, default=DEFAULT_SPLITS)
    ap.add_argument("--label-maps", type=Path, default=DEFAULT_LABEL_MAPS)
    ap.add_argument("--model-dir", type=Path, default=DEFAULT_MODEL_DIR)
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--epochs", type=int, default=50)
    ap.add_argument("--lr", type=float, default=0.001)
    ap.add_argument("--target-size", type=int, default=224, help="Height and width for EfficientNet")
    ap.add_argument("--mixed-precision", action="store_true", help="mixed_float16 on GPU (recommended for RTX 4060 / Tensor Cores)")
    ap.add_argument("--lr-reduce", action="store_true", help="Add ReduceLROnPlateau (factor=0.5, patience=3) for better accuracy")
    ap.add_argument("--allow-cpu", action="store_true", help="Allow running without GPU (default: exit if no GPU detected)")
    args = ap.parse_args()

    if not args.splits_json.exists() or not args.label_maps.exists():
        logger.error("Run 02_prepare_dataset.py first to create splits.json and label_maps.json")
        sys.exit(1)

    try:
        import tensorflow as tf
        from tensorflow.keras import Model
        from tensorflow.keras.applications import EfficientNetB4
        from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
        from tensorflow.keras.layers import Dense, Dropout, GlobalAveragePooling2D
        from tensorflow.keras.optimizers import Adam
    except ImportError as e:
        logger.error("TensorFlow not installed: %s. pip install tensorflow>=2.13", e)
        sys.exit(1)

    # ---- Startup: TensorFlow version and GPU check ----
    logger.info("TF %s", tf.__version__)
    gpus = tf.config.list_physical_devices("GPU")
    logger.info("GPUs %s", gpus)
    if not gpus:
        if args.allow_cpu:
            logger.warning("No GPU detected; training on CPU (slow). You passed --allow-cpu.")
        else:
            logger.error(
                "TensorFlow GPU not detected; you installed CPU-only TF. Training cannot use RTX 4060.\n"
                "Fix options:\n"
                "  1) WSL2 (recommended): Run inside WSL2 Ubuntu with NVIDIA drivers + CUDA/cuDNN, "
                "then install tensorflow; tf.config.list_physical_devices('GPU') must show your GPU.\n"
                "  2) Windows: Use TF 2.10.x (last with native Windows GPU support):\n"
                "       pip uninstall -y tensorflow tensorflow-intel\n"
                "       pip install \"tensorflow==2.10.*\"\n"
                "     Then install matching CUDA 11.2 and cuDNN 8.1 for TF 2.10. See README_TRAINING.md.\n"
                "  Or pass --allow-cpu to run on CPU anyway (slow)."
            )
            sys.exit(1)

    # ---- Use all GPUs and CPU ----
    for gpu in gpus:
        try:
            tf.config.experimental.set_memory_growth(gpu, True)
        except RuntimeError:
            pass
    if gpus:
        logger.info("Using %d GPU(s): %s", len(gpus), [g.name for g in gpus])
    # Use all CPU cores for TensorFlow ops (intra-op and inter-op parallelism)
    n_cpu = os.cpu_count() or 4
    tf.config.threading.set_intra_op_parallelism_threads(n_cpu)
    tf.config.threading.set_inter_op_parallelism_threads(n_cpu)

    # Multi-GPU: MirroredStrategy
    strategy = tf.distribute.MirroredStrategy() if len(gpus) > 1 else None
    if strategy:
        logger.info("Multi-GPU: MirroredStrategy with %d replicas", strategy.num_replicas_in_sync)

    # Mixed precision (faster on GPUs with Tensor Cores)
    if args.mixed_precision and gpus:
        tf.keras.mixed_precision.set_global_policy("mixed_float16")
        logger.info("Mixed precision: mixed_float16")

    target = (args.target_size, args.target_size)
    train_ds, val_ds, splits, label_maps, steps_per_epoch, validation_steps = _build_tf_datasets(
        args.splits_json, args.label_maps, args.batch_size, target
    )
    num_makes = int(label_maps["num_makes"])
    num_models = int(label_maps["num_models"])

    def build_model():
        base = EfficientNetB4(weights="imagenet", include_top=False, input_shape=(*target, 3), pooling=None)
        x = base.output
        x = GlobalAveragePooling2D()(x)
        x = Dropout(0.3)(x)
        make_head = Dense(512, activation="relu")(x)
        make_head = Dropout(0.2)(make_head)
        make_out = Dense(num_makes, activation="softmax", name="make")(make_head)
        model_head = Dense(512, activation="relu")(x)
        model_head = Dropout(0.2)(model_head)
        model_out = Dense(num_models, activation="softmax", name="model")(model_head)
        m = Model(inputs=base.input, outputs=[make_out, model_out])
        for layer in base.layers:
            layer.trainable = True
        return m

    if strategy:
        with strategy.scope():
            model = build_model()
            model.compile(
                optimizer=Adam(learning_rate=args.lr),
                loss={"make": "categorical_crossentropy", "model": "categorical_crossentropy"},
                loss_weights={"make": 1.0, "model": 1.0},
                metrics={"make": ["accuracy"], "model": ["accuracy"]},
            )
    else:
        model = build_model()
        model.compile(
            optimizer=Adam(learning_rate=args.lr),
            loss={"make": "categorical_crossentropy", "model": "categorical_crossentropy"},
            loss_weights={"make": 1.0, "model": 1.0},
            metrics={"make": ["accuracy"], "model": ["accuracy"]},
        )

    args.model_dir.mkdir(parents=True, exist_ok=True)
    model_path = args.model_dir / "car_classifier.keras"
    callbacks = [
        EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True, verbose=1),
        ModelCheckpoint(str(model_path), monitor="val_loss", save_best_only=True, verbose=1),
    ]
    if args.lr_reduce:
        callbacks.append(
            ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, min_lr=1e-6, verbose=1)
        )
        logger.info("Using ReduceLROnPlateau (factor=0.5, patience=3)")

    logger.info("Training: batch=%d, epochs=%d (tf.data parallel load + prefetch -> GPU)",
                args.batch_size, args.epochs)
    if gpus and not args.mixed_precision:
        logger.info("Tip: add --mixed-precision to use RTX Tensor Cores (faster on RTX 4060).")
    hist = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.epochs,
        callbacks=callbacks,
        verbose=1,
        steps_per_epoch=steps_per_epoch,
        validation_steps=validation_steps,
    )

    # Save label_maps next to model for inference
    maps_path = args.model_dir / "car_classifier_label_maps.json"
    with open(maps_path, "w", encoding="utf-8") as f:
        json.dump(label_maps, f, indent=2)
    logger.info("Saved %s", maps_path)

    # Evaluate on test
    from tensorflow.keras.preprocessing.image import load_img, img_to_array
    from tensorflow.keras.applications.efficientnet import preprocess_input

    test_recs = splits.get("test", [])
    if test_recs:
        # Simple evaluation loop
        correct_m, correct_mo, n = 0, 0, 0
        for r in test_recs:
            p = Path(r["path"])
            if not p.exists():
                continue
            try:
                img = load_img(p, target_size=target, color_mode="rgb")
                arr = img_to_array(img)
                arr = preprocess_input(np.array([arr], dtype=np.float32))
                pred = model.predict(arr, verbose=0)
                pm, pmo = np.argmax(pred[0][0]), np.argmax(pred[1][0])
                if pm == r["make_idx"]:
                    correct_m += 1
                if pmo == r["model_idx"]:
                    correct_mo += 1
                n += 1
            except Exception:
                continue
        test_acc_make = correct_m / n if n else 0.0
        test_acc_model = correct_mo / n if n else 0.0
    else:
        test_acc_make = test_acc_model = 0.0
        n = 0

    # Report
    val_loss = min(hist.history["val_loss"])
    val_acc_m = max(hist.history.get("val_make_accuracy", [0]))
    val_acc_mo = max(hist.history.get("val_model_accuracy", [0]))
    report = f"""Training Report - Car Make/Model Classifier
========================================
Model: EfficientNetB4, two-headed (make + model)
Best val_loss: {val_loss:.4f}
Val make accuracy:  {val_acc_m:.4f}
Val model accuracy: {val_acc_mo:.4f}
Test make accuracy: {test_acc_make:.4f} (n={n})
Test model accuracy: {test_acc_model:.4f} (n={n})
Model saved: {model_path}
Label maps: {maps_path}
"""
    report_path = args.model_dir / "training_report.txt"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    logger.info("%s", report)


if __name__ == "__main__":
    main()
