"""
============================================================================
AUTOMATED PIPELINE RUNNER
============================================================================

This script runs the complete multi-modal car price prediction pipeline:
1. Data preparation (prepare_data.py)
2. Model training (train_model.py)
3. Example prediction (predict.py)

Run this script to execute the entire pipeline automatically.

Usage:
    python run_all.py

"""

import os
import sys
import subprocess
from pathlib import Path
from datetime import datetime

def run_script(script_name: str, description: str) -> bool:
    """
    Run a Python script and handle errors.

    Parameters:
    -----------
    script_name : str
        Name of script to run
    description : str
        Description of what the script does

    Returns:
    --------
    success : bool
        True if script succeeded, False otherwise
    """
    print("\n" + "=" * 80)
    print(f"STEP: {description}")
    print("=" * 80)
    print(f"Running: {script_name}")
    print("-" * 80)

    try:
        result = subprocess.run(
            [sys.executable, script_name],
            check=True,
            capture_output=False,
            text=True
        )
        print(f"\n✓ {description} completed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n✗ {description} failed with error code {e.returncode}")
        return False
    except FileNotFoundError:
        print(f"\n✗ Script not found: {script_name}")
        return False
    except Exception as e:
        print(f"\n✗ {description} failed with error: {str(e)}")
        return False


def check_prerequisites() -> bool:
    """Check if all prerequisites are met."""
    print("\n" + "=" * 80)
    print("CHECKING PREREQUISITES")
    print("=" * 80)

    # Check Python version
    python_version = sys.version_info
    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 8):
        print("✗ Python 3.8+ required")
        return False
    print(f"✓ Python {python_version.major}.{python_version.minor}.{python_version.micro}")

    # Check required files
    required_files = [
        Path("data/iqcars1.csv"),
        Path("data/iqcars2.csv"),
        Path("data/iqcars3.csv"),
        Path("prepare_data.py"),
        Path("train_model.py"),
        Path("predict.py")
    ]

    missing_files = []
    for file in required_files:
        if not file.exists():
            missing_files.append(str(file))
        else:
            print(f"✓ Found {file}")

    if missing_files:
        print("\n✗ Missing required files:")
        for file in missing_files:
            print(f"  - {file}")
        return False

    # Check if models already exist
    model_files = [
        Path("models/best_model.pkl"),
        Path("models/cnn_feature_extractor.h5")
    ]

    existing_models = [f for f in model_files if f.exists()]
    if existing_models:
        print("\n⚠ Existing models found:")
        for f in existing_models:
            print(f"  - {f}")
        response = input("\nDo you want to retrain? (y/n): ").strip().lower()
        if response != 'y':
            print("Skipping training. Using existing models.")
            return 'skip_training'

    return True


def main():
    """Main pipeline execution."""
    print("\n" + "=" * 80)
    print("MULTI-MODAL CAR PRICE PREDICTION PIPELINE")
    print("=" * 80)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Check prerequisites
    prereq_result = check_prerequisites()
    if prereq_result is False:
        print("\n✗ Prerequisites not met. Please fix the issues above.")
        sys.exit(1)

    skip_training = (prereq_result == 'skip_training')

    # Step 1: Data Preparation
    if not skip_training:
        success = run_script(
            "prepare_data.py",
            "Data Preparation - Merging CSVs, cleaning data, downloading images"
        )
        if not success:
            print("\n✗ Pipeline failed at data preparation step.")
            sys.exit(1)

        # Check if output file was created
        output_file = Path("data/final_dataset_with_images.csv")
        if not output_file.exists():
            print(f"\n✗ Expected output file not found: {output_file}")
            sys.exit(1)
        print(f"✓ Output file created: {output_file}")

    # Step 2: Model Training
    if not skip_training:
        success = run_script(
            "train_model.py",
            "Model Training - Training multi-modal ensemble model"
        )
        if not success:
            print("\n✗ Pipeline failed at model training step.")
            sys.exit(1)

        # Check if model files were created
        model_file = Path("models/best_model.pkl")
        if not model_file.exists():
            print(f"\n✗ Expected model file not found: {model_file}")
            sys.exit(1)
        print(f"✓ Model file created: {model_file}")

    # Step 3: Example Prediction
    print("\n" + "=" * 80)
    print("STEP: Example Prediction")
    print("=" * 80)
    print("Running example prediction in interactive mode...")
    print("(You can also run: python predict.py --interactive)")

    # Try to run interactive prediction
    try:
        # For automated run, we'll just show instructions
        print("\nTo make predictions, run:")
        print("  python predict.py --interactive")
        print("\nOr use command-line arguments:")
        print("  python predict.py --make Toyota --model Camry --year 2020 --mileage 30000 --image_path car_images/car_000001.jpg")
    except Exception as e:
        print(f"\n⚠ Could not run example prediction: {e}")
        print("You can run predictions manually using:")
        print("  python predict.py --interactive")

    # Summary
    print("\n" + "=" * 80)
    print("PIPELINE COMPLETE!")
    print("=" * 80)
    print(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    print("\nNext steps:")
    print("1. Review model performance: models/model_performance.json")
    print("2. Check error analysis: models/error_analysis.csv")
    print("3. Make predictions:")
    print("   - Interactive: python predict.py --interactive")
    print("   - Single: python predict.py --make Toyota --model Camry --year 2020 --mileage 30000 --image_path car_images/car_000001.jpg")
    print("   - Batch: python predict.py --batch_file cars.csv --output predictions.csv")
    print("4. Read documentation: README.md")


if __name__ == "__main__":
    main()
