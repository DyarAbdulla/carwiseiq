"""
Setup Verification Script
Checks if all dependencies and files are ready to run streamlit run app.py
"""

import sys
import os

def check_python_version():
    """Check Python version"""
    print("=" * 60)
    print("Checking Python version...")
    print("=" * 60)
    version = sys.version_info
    if version.major >= 3 and version.minor >= 8:
        print(f"[OK] Python {version.major}.{version.minor}.{version.micro} (OK)")
        return True
    else:
        print(f"[FAIL] Python {version.major}.{version.minor}.{version.micro} (Need 3.8+)")
        return False

def check_package(package_name, import_name=None):
    """Check if a package is installed"""
    if import_name is None:
        import_name = package_name
    
    try:
        __import__(import_name)
        print(f"[OK] {package_name}")
        return True
    except ImportError:
        print(f"[FAIL] {package_name} (NOT INSTALLED)")
        return False

def check_file(filepath, description):
    """Check if a file exists"""
    if os.path.exists(filepath):
        size = os.path.getsize(filepath) / (1024 * 1024)  # MB
        print(f"[OK] {description}: {filepath} ({size:.2f} MB)")
        return True
    else:
        print(f"[FAIL] {description}: {filepath} (NOT FOUND)")
        return False

def check_directory(dirpath, description):
    """Check if a directory exists"""
    if os.path.exists(dirpath) and os.path.isdir(dirpath):
        print(f"[OK] {description}: {dirpath}")
        return True
    else:
        print(f"[FAIL] {description}: {dirpath} (NOT FOUND)")
        return False

def main():
    """Main verification function"""
    print("\n" + "=" * 60)
    print("Car Price Predictor Pro - Setup Verification")
    print("=" * 60 + "\n")
    
    all_ok = True
    
    # Check Python version
    all_ok = check_python_version() and all_ok
    print()
    
    # Check required packages
    print("=" * 60)
    print("Checking required packages...")
    print("=" * 60)
    
    packages = [
        ("streamlit", "streamlit"),
        ("pandas", "pandas"),
        ("numpy", "numpy"),
        ("scikit-learn", "sklearn"),
        ("matplotlib", "matplotlib"),
        ("seaborn", "seaborn"),
        ("plotly", "plotly"),
        ("openpyxl", "openpyxl"),
    ]
    
    for package_name, import_name in packages:
        if not check_package(package_name, import_name):
            all_ok = False
    
    print()
    
    # Check required files
    print("=" * 60)
    print("Checking required files...")
    print("=" * 60)
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    required_files = [
        ("app.py", "Main application file"),
        ("models/best_model_v2.pkl", "Trained model file"),
        ("data/cleaned_car_data.csv", "Cleaned dataset"),
        ("app/config.py", "Configuration file"),
        ("translations.py", "Translations file"),
        ("predict_price.py", "Prediction module"),
        ("utils.py", "Utilities module"),
        ("requirements.txt", "Dependencies file"),
    ]
    
    for filepath, description in required_files:
        full_path = os.path.join(base_dir, filepath)
        if not check_file(full_path, description):
            all_ok = False
    
    print()
    
    # Check optional but recommended files
    print("=" * 60)
    print("Checking optional files (recommended)...")
    print("=" * 60)
    
    optional_files = [
        ("models/make_encoder.pkl", "Make encoder"),
        ("models/model_encoder.pkl", "Model encoder"),
    ]
    
    optional_ok = True
    for filepath, description in optional_files:
        full_path = os.path.join(base_dir, filepath)
        if not check_file(full_path, description):
            optional_ok = False
    
    if optional_ok:
        print("[OK] All optional files found")
    else:
        print("[WARN] Some optional files are missing (app may still work)")
    
    print()
    
    # Check directories
    print("=" * 60)
    print("Checking directories...")
    print("=" * 60)
    
    directories = [
        ("models", "Models directory"),
        ("data", "Data directory"),
        ("app", "App configuration directory"),
        ("core", "Core modules directory"),
    ]
    
    for dirpath, description in directories:
        full_path = os.path.join(base_dir, dirpath)
        if not check_directory(full_path, description):
            all_ok = False
    
    print()
    
    # Final summary
    print("=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    
    if all_ok:
        print("[OK] ALL REQUIRED COMPONENTS ARE READY!")
        print("\nYou can now run the application with:")
        print("  streamlit run app.py")
        print("  OR")
        print("  py -m streamlit run app.py")
        return 0
    else:
        print("[FAIL] SOME REQUIRED COMPONENTS ARE MISSING")
        print("\nPlease:")
        print("  1. Install missing packages: pip install -r requirements.txt")
        print("  2. Ensure all required files are in place")
        print("  3. Run this verification script again")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
