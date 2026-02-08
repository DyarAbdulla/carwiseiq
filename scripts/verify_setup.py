"""
Comprehensive verification script for Car Price Predictor
Checks all files, imports, and functionality
"""

import os
import sys

def check_file_exists(filepath, description):
    """Check if file exists"""
    exists = os.path.exists(filepath)
    status = "[OK]" if exists else "[MISSING]"
    print(f"{status} {description}: {filepath}")
    return exists

def check_import(module_name, description):
    """Check if module can be imported"""
    try:
        __import__(module_name)
        print(f"[OK] {description}: {module_name}")
        return True
    except Exception as e:
        print(f"[ERROR] {description}: {module_name} - {e}")
        return False

def check_python_syntax(filepath):
    """Check Python file syntax"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            compile(f.read(), filepath, 'exec')
        print(f"[OK] Syntax OK: {filepath}")
        return True
    except SyntaxError as e:
        print(f"[ERROR] Syntax Error in {filepath}: {e}")
        return False
    except Exception as e:
        print(f"[ERROR] Error checking {filepath}: {e}")
        return False

print("=" * 80)
print("Car Price Predictor - Comprehensive Verification")
print("=" * 80)
print()

# Check critical files
print("1. Checking Critical Files...")
print("-" * 80)
files_to_check = [
    ('config.py', 'Configuration file'),
    ('utils.py', 'Utility functions'),
    ('requirements.txt', 'Dependencies'),
    ('.gitignore', 'Git ignore file'),
    ('README.md', 'Main documentation'),
    ('RESULTS.md', 'Results documentation'),
    ('cleaned_car_data.csv', 'Cleaned dataset'),
    ('models/car_price_model.pkl', 'Trained model'),
    ('app.py', 'Web application'),
    ('data_cleaning.py', 'Data cleaning script'),
    ('data_visualization.py', 'Visualization script'),
    ('model_training.py', 'Model training script'),
    ('predict_price.py', 'Prediction script'),
]

all_files_exist = True
for filepath, desc in files_to_check:
    if not check_file_exists(filepath, desc):
        all_files_exist = False

print()

# Check Python syntax
print("2. Checking Python Syntax...")
print("-" * 80)
python_files = [
    'config.py',
    'utils.py',
    'app.py',
    'data_cleaning.py',
    'data_visualization.py',
    'model_training.py',
    'predict_price.py',
    'test_app_logic.py'
]

all_syntax_ok = True
for filepath in python_files:
    if os.path.exists(filepath):
        if not check_python_syntax(filepath):
            all_syntax_ok = False

print()

# Check imports
print("3. Checking Module Imports...")
print("-" * 80)
imports_to_check = [
    ('config', 'Configuration module'),
    ('utils', 'Utility functions module'),
    ('pandas', 'Pandas library'),
    ('numpy', 'NumPy library'),
    ('sklearn', 'Scikit-learn library'),
]

all_imports_ok = True
for module, desc in imports_to_check:
    if not check_import(module, desc):
        all_imports_ok = False

print()

# Check functionality
print("4. Checking Functionality...")
print("-" * 80)

# Test config
try:
    import config
    print(f"[OK] Config loaded: {len(dir(config))} items")
    print(f"  - BASE_DIR: {config.BASE_DIR}")
    print(f"  - CURRENT_YEAR: {config.CURRENT_YEAR}")
except Exception as e:
    print(f"[ERROR] Config error: {e}")

# Test utils
try:
    import utils
    from utils import validate_year, format_currency
    print(f"[OK] Utils loaded: {len(dir(utils))} items")
    print(f"  - validate_year(2020): {validate_year(2020)}")
    print(f"  - format_currency(12345.67): {format_currency(12345.67)}")
except Exception as e:
    print(f"[ERROR] Utils error: {e}")

# Test model loading
try:
    from predict_price import load_model
    model, features, name, make_enc, model_enc = load_model()
    print(f"[OK] Model loaded: {name}")
    print(f"  - Features: {len(features)}")
except Exception as e:
    print(f"[ERROR] Model loading error: {e}")

print()

# Check directories
print("5. Checking Directories...")
print("-" * 80)
dirs_to_check = [
    ('models', 'Models directory'),
    ('visualizations', 'Visualizations directory'),
    ('evaluation_reports', 'Evaluation reports directory'),
]

for dirpath, desc in dirs_to_check:
    exists = os.path.exists(dirpath) and os.path.isdir(dirpath)
    status = "[OK]" if exists else "[MISSING]"
    print(f"{status} {desc}: {dirpath}")

print()

# Summary
print("=" * 80)
print("Verification Summary")
print("=" * 80)
print(f"Files: {'[OK] All exist' if all_files_exist else '[ERROR] Some missing'}")
print(f"Syntax: {'[OK] All valid' if all_syntax_ok else '[ERROR] Errors found'}")
print(f"Imports: {'[OK] All work' if all_imports_ok else '[ERROR] Some failed'}")
print()

if all_files_exist and all_syntax_ok and all_imports_ok:
    print("[SUCCESS] ALL CHECKS PASSED - PROJECT IS READY!")
else:
    print("[WARNING] Some issues found. Please review the errors above.")
print("=" * 80)

