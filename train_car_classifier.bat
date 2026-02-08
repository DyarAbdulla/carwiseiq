@echo off
echo ============================================================
echo CAR CLASSIFIER TRAINING - GPU OPTIMIZED
echo ============================================================
echo.

cd /d "%~dp0"

echo Checking GPU...
python -c "import torch; print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"NOT FOUND\"}')"

echo.
echo Step 1: Creating image labels mapping...
python scripts/create_image_labels.py
if errorlevel 1 (
    echo ERROR: Failed to create image labels
    pause
    exit /b 1
)

echo.
echo Step 2: Training CLIP model on GPU (this may take 20-30 minutes)...
echo Using: OPTIMIZED MODE - 20 Epochs, Batch Size 16, Gradient Accumulation 8, Mixed Precision (FP16)
echo Using filtered dataset (brands with ^>=50 images)
echo.
python scripts/train_car_clip.py --epochs 20 --batch_size 16 --gradient_accumulation 8 --num_workers 8 --lr 2e-5
if errorlevel 1 (
    echo ERROR: Training failed
    pause
    exit /b 1
)

echo.
echo Step 3: Evaluating model...
python scripts/test_car_classifier.py
if errorlevel 1 (
    echo WARNING: Evaluation failed, but model may still be usable
)

echo.
echo ============================================================
echo TRAINING COMPLETE!
echo ============================================================
echo.
echo The fine-tuned model has been saved to: models\car_clip_finetuned\
echo.
echo Restart your backend server to use the new model:
echo   cd backend
echo   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
echo.
pause
