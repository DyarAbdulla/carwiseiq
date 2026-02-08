"""
============================================================================
QUICK START PIPELINE SCRIPT
============================================================================

This script runs the complete multi-modal pipeline:
1. Data preparation
2. Model training
3. Example predictions

Run this script to execute the entire pipeline end-to-end.

Usage:
    python run_multimodal_pipeline.py

"""

import os
import sys
import subprocess
from pathlib import Path
from datetime import datetime

def run_command(command: str, description: str) -> bool:
    """
    Run a command and handle errors.

    Parameters:
    -----------
    command : str
        Command to run
    description : str
        Description of what the command does

    Returns:
    --------
    success : bool
        True if command succeeded, False otherwise
    """
    print("\n" + "=" * 80)
    print(f"STEP: {description}")
    print("=" * 80)
    print(f"Command: {command}")
    print("-" * 80)

    try:
        result = subprocess.run(
            command,
            shell=True,
            check=True,
            capture_output=False,
            text=True
        )
        print(f"\n✓ {description} completed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n✗ {description} failed with error code {e.returncode}")
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
        Path("prepare_multimodal_dataset.py"),
        Path("train_multimodal_model.py"),
        Path("predict_with_images_advanced.py")
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
        success = run_command(
            "python prepare_multimodal_dataset.py",
            "Data Preparation - Merging and cleaning CSV files"
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
        success = run_command(
            "python train_multimodal_model.py",
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
    print("Running example prediction...")

    example_command = (
        "python predict_with_images_advanced.py "
        "--make Toyota "
        "--model Camry "
        "--year 2020 "
        "--mileage 30000 "
        "--engine_size 2.5 "
        "--cylinders 4 "
        "--condition Good "
        "--fuel_type Gasoline "
        "--location California"
    )

    success = run_command(
        example_command,
        "Example Prediction - Testing the trained model"
    )

    if not success:
        print("\n⚠ Example prediction failed, but models are trained.")
        print("You can run predictions manually using:")
        print("  python predict_with_images_advanced.py --interactive")

    # Summary
    print("\n" + "=" * 80)
    print("PIPELINE COMPLETE!")
    print("=" * 80)
    print(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    print("\nNext steps:")
    print("1. Review model performance: models/model_performance.json")
    print("2. Check error analysis: models/error_analysis.csv")
    print("3. Make predictions:")
    print("   - Interactive: python predict_with_images_advanced.py --interactive")
    print("   - Batch: python predict_with_images_advanced.py --batch_file cars.csv --output predictions.csv")
    print("4. Read documentation: MULTIMODAL_MODEL_README.md")


if __name__ == "__main__":
    main()
