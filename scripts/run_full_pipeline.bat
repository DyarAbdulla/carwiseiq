@echo off
echo ============================================================
echo FULL PIPELINE: DIAGNOSE, CLEAN, TRAIN, EVALUATE
echo ============================================================
echo.

cd /d "%~dp0\.."

echo Step 1: Running diagnostics...
python scripts\diagnose_dataset.py
if errorlevel 1 (
    echo ERROR: Diagnostics failed
    pause
    exit /b 1
)

echo.
echo Step 2: Cleaning dataset...
python scripts\clean_dataset.py --apply --min_samples 100 --max_samples 2000
if errorlevel 1 (
    echo ERROR: Dataset cleaning failed
    pause
    exit /b 1
)

echo.
echo Step 3: Training optimized model...
python scripts\train_optimized.py
if errorlevel 1 (
    echo ERROR: Training failed
    pause
    exit /b 1
)

echo.
echo Step 4: Comprehensive evaluation...
python scripts\evaluate_comprehensive.py
if errorlevel 1 (
    echo WARNING: Evaluation failed
)

echo.
echo ============================================================
echo PIPELINE COMPLETE!
echo ============================================================
echo.
echo Check results in:
echo   - diagnostics\diagnostic_report_*.json
echo   - data\image_labels_cleaned_final.csv
echo   - models\car_clip_finetuned\best_model.pt
echo   - results\evaluation_report_*.txt
echo.
pause
