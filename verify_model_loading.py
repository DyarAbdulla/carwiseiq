"""Quick verification script to check which model will be loaded"""
import os
from datetime import datetime

print("=" * 80)
print("MODEL FILE VERIFICATION")
print("=" * 80)

# Check model files in priority order
model_paths = [
    'models/best_model_v2.pkl',
    'models/car_price_model.pkl',
    'models/best_model.pkl'
]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
found_models = []

for model_path in model_paths:
    full_path = os.path.join(BASE_DIR, model_path)
    
    if os.path.exists(full_path):
        mod_time = datetime.fromtimestamp(os.path.getmtime(full_path))
        file_size = os.path.getsize(full_path) / (1024*1024)  # MB
        
        print(f"\n[OK] FOUND: {model_path}")
        print(f"  Full path: {full_path}")
        print(f"  File size: {file_size:.2f} MB")
        print(f"  Modified: {mod_time}")
        print(f"  Priority: {'HIGHEST (WILL LOAD THIS)' if len(found_models) == 0 else 'Fallback'}")
        
        found_models.append({
            'path': model_path,
            'full_path': full_path,
            'size': file_size,
            'modified': mod_time
        })
    else:
        print(f"\n[NOT FOUND] {model_path}")

print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)

if found_models:
    primary = found_models[0]
    print(f"\n[PRIMARY MODEL] (will load first):")
    print(f"   File: {primary['path']}")
    print(f"   Size: {primary['size']:.2f} MB")
    print(f"   Modified: {primary['modified']}")
    
    # Check if it's recent (within last 24 hours)
    from datetime import timedelta
    if datetime.now() - primary['modified'] < timedelta(hours=24):
        print(f"   [OK] File is recent (less than 24 hours old)")
    else:
        print(f"   [WARNING] File is older than 24 hours - may need retraining")
    
    if len(found_models) > 1:
        print(f"\n[FALLBACK MODELS] ({len(found_models)-1}):")
        for model in found_models[1:]:
            print(f"   - {model['path']} ({model['size']:.2f} MB, modified: {model['modified']})")
else:
    print("\n[ERROR] NO MODEL FILES FOUND!")
    print("   Please run: python model_training.py")

print("\n" + "=" * 80)
print("NEXT STEPS")
print("=" * 80)
print("1. Run: streamlit run app.py")
print("2. Check console output for 'LOADING MODEL: ...' message")
print("3. Verify it says: 'models/best_model_v2.pkl'")
print("4. Test prediction with: 2025 Toyota Camry, 0 km, New")
print("=" * 80)

