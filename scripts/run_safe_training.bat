@echo off
echo ============================================================
echo SAFE TRAINING PIPELINE - PRE-FLIGHT CHECKS FIRST
echo ============================================================
echo.

cd /d "%~dp0\.."

echo Step 1: Running pre-flight checks...
echo.
python scripts\preflight_check.py
if errorlevel 1 (
    echo.
    echo ============================================================
    echo PRE-FLIGHT CHECKS FAILED!
    echo ============================================================
    echo.
    echo Please fix the errors above before training.
    echo Check the error messages for specific fixes needed.
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo ALL PRE-FLIGHT CHECKS PASSED!
echo ============================================================
echo.
echo Starting training pipeline...
echo.

echo Step 2: Diagnosing dataset...
python scripts\diagnose_dataset.py
if errorlevel 1 (
    echo WARNING: Diagnostics had issues, but continuing...
)

echo.
echo Step 3: Cleaning dataset...
python scripts\clean_dataset.py --apply --min_samples 100 --max_samples 2000
if errorlevel 1 (
    echo ERROR: Dataset cleaning failed
    pause
    exit /b 1
)

echo.
echo Step 4: Starting optimized training...
echo.
echo Training will run with maximum CPU + GPU utilization.
echo Monitor progress in logs\training_optimized_*.log
echo.
echo You can safely leave your computer now.
echo Training will auto-save checkpoints every epoch.
echo.
pause

python scripts\train_optimized.py
if errorlevel 1 (
    echo.
    echo ERROR: Training failed!
    echo Check logs\training_optimized_*.log for details
    pause
    exit /b 1
)

echo.
echo Step 5: Comprehensive evaluation...
python scripts\evaluate_comprehensive.py
if errorlevel 1 (
    echo WARNING: Evaluation failed, but model may still be usable
)

echo.
echo ============================================================
echo TRAINING PIPELINE COMPLETE!
echo ============================================================
echo.
echo Results:
echo   - Model: models\car_clip_finetuned\best_model.pt
echo   - Evaluation: results\evaluation_report_*.txt
echo   - Logs: logs\training_optimized_*.log
echo.
pause
