@echo off
echo ============================================================
echo OVERNIGHT CAR CLASSIFIER TRAINING - 15 HOURS
echo ============================================================
echo.
echo This script will train for up to 15 hours with early stopping
echo Target: 42-65%% Top-1 accuracy
echo.
echo Start time: %date% %time%
echo.

cd /d "%~dp0\.."

echo Checking GPU...
python -c "import torch; print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"NOT FOUND\"}')"
if errorlevel 1 (
    echo ERROR: GPU check failed
    pause
    exit /b 1
)

echo.
echo ============================================================
echo STEP 1: STARTING OVERNIGHT TRAINING
echo ============================================================
echo.
echo Configuration:
echo   - Epochs: 100 (or until early stopping)
echo   - Batch Size: 128
echo   - Learning Rate: 2e-5
echo   - Early Stopping: Patience 15 epochs
echo   - Checkpoints: Every 5 epochs
echo   - Mixed Precision: FP16
echo   - Strong Data Augmentation: MixUp + AutoAugment
echo   - Label Smoothing: 0.1
echo   - GPU Temp Monitoring: Enabled (auto-stop at 85C)
echo   - Progress Monitoring: Every 10 minutes
echo.
echo Training logs will be saved to: logs\training_*.log
echo.

python scripts\train_overnight.py --epochs 100 --batch_size 128 --lr 2e-5 --num_workers 12 --patience 15 --label_smoothing 0.1 --mixup_alpha 0.2 --gpu_temp_threshold 85
if errorlevel 1 (
    echo.
    echo ERROR: Training failed!
    echo Check logs\training_*.log for details
    pause
    exit /b 1
)

echo.
echo ============================================================
echo STEP 2: FINAL EVALUATION
echo ============================================================
echo.

python scripts\evaluate_final.py
if errorlevel 1 (
    echo WARNING: Evaluation failed, but model may still be usable
)

echo.
echo ============================================================
echo OVERNIGHT TRAINING COMPLETE!
echo ============================================================
echo.
echo End time: %date% %time%
echo.
echo Results saved to:
echo   - models\car_clip_finetuned\best_model_overnight.pt
echo   - results\final_report_*.txt
echo   - results\final_results_*.json
echo.
echo Training logs: logs\training_*.log
echo.
echo Restart your backend server to use the new model:
echo   cd backend
echo   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
echo.
pause
