"""
Comprehensive Pre-Flight Check System
Validates everything before training starts
"""

import sys
import os
import subprocess
import shutil
from pathlib import Path
from datetime import datetime
import json
import traceback

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
IMAGES_DIR = PROJECT_ROOT / "car_images"
MODELS_DIR = PROJECT_ROOT / "models" / "car_clip_finetuned"
LOG_DIR = PROJECT_ROOT / "logs"
RESULTS_DIR = PROJECT_ROOT / "results"
SCRIPTS_DIR = PROJECT_ROOT / "scripts"

# Color codes for terminal
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"

def print_check(name, status, message=""):
    """Print check result with color."""
    if status:
        symbol = f"{GREEN}✓{RESET}"
        print(f"  {symbol} {name}: {message}")
    else:
        symbol = f"{RED}✗{RESET}"
        print(f"  {symbol} {name}: {message}")
    return status

def check_python_version():
    """Check Python version >= 3.8."""
    print("\n1. SYSTEM CHECKS")
    print("=" * 80)
    
    version = sys.version_info
    is_valid = version.major >= 3 and (version.major > 3 or version.minor >= 8)
    msg = f"Python {version.major}.{version.minor}.{version.micro}"
    if not is_valid:
        msg += " (REQUIRES Python 3.8+)"
    return print_check("Python Version", is_valid, msg), is_valid

def check_pytorch_cuda():
    """Check PyTorch and CUDA availability."""
    try:
        import torch
        pytorch_ok = True
        pytorch_version = torch.__version__
        
        cuda_available = torch.cuda.is_available()
        if cuda_available:
            cuda_version = torch.version.cuda
            device_count = torch.cuda.device_count()
            gpu_name = torch.cuda.get_device_name(0) if device_count > 0 else "Unknown"
            msg = f"PyTorch {pytorch_version}, CUDA {cuda_version}, GPU: {gpu_name}"
        else:
            msg = f"PyTorch {pytorch_version} (CUDA NOT AVAILABLE)"
    except ImportError:
        pytorch_ok = False
        cuda_available = False
        msg = "PyTorch NOT INSTALLED"
    
    pytorch_check = print_check("PyTorch & CUDA", pytorch_ok and cuda_available, msg)
    return pytorch_check, pytorch_ok, cuda_available

def check_required_packages():
    """Check all required packages are installed."""
    required_packages = {
        'torch': 'PyTorch',
        'transformers': 'Transformers (HuggingFace)',
        'pandas': 'Pandas',
        'PIL': 'Pillow',
        'numpy': 'NumPy',
        'sklearn': 'Scikit-learn',
        'tqdm': 'tqdm',
    }
    
    optional_packages = {
        'kornia': 'Kornia (GPU augmentation)',
        'psutil': 'psutil (CPU monitoring)',
    }
    
    all_ok = True
    missing = []
    
    print("\n   Required Packages:")
    for package, name in required_packages.items():
        try:
            __import__(package)
            print_check(f"    {name}", True, "Installed")
        except ImportError:
            print_check(f"    {name}", False, "MISSING")
            missing.append(name)
            all_ok = False
    
    print("\n   Optional Packages:")
    for package, name in optional_packages.items():
        try:
            __import__(package)
            print_check(f"    {name}", True, "Installed")
        except ImportError:
            print_check(f"    {name}", False, "Optional (not installed)")
    
    return all_ok, missing

def check_gpu():
    """Check GPU is detected and accessible."""
    try:
        import torch
        if not torch.cuda.is_available():
            return print_check("GPU Detection", False, "CUDA not available"), None
        
        device_count = torch.cuda.device_count()
        if device_count == 0:
            return print_check("GPU Detection", False, "No GPU devices found"), None
        
        gpu_name = torch.cuda.get_device_name(0)
        gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
        
        # Check if it's RTX 4060 (or any GPU with 8GB+)
        is_rtx4060 = "4060" in gpu_name or gpu_memory >= 7.5
        msg = f"{gpu_name} ({gpu_memory:.1f} GB)"
        
        if gpu_memory < 7.5:
            msg += " - WARNING: Less than 8GB VRAM"
        
        return print_check("GPU Detection", True, msg), gpu_name
    except Exception as e:
        return print_check("GPU Detection", False, f"Error: {e}"), None

def check_disk_space():
    """Check available disk space."""
    try:
        stat = shutil.disk_usage(PROJECT_ROOT)
        free_gb = stat.free / (1024**3)
        required_gb = 10
        
        is_ok = free_gb >= required_gb
        msg = f"{free_gb:.1f} GB free (need {required_gb} GB+)"
        
        if not is_ok:
            msg += " - INSUFFICIENT SPACE"
        
        return print_check("Disk Space", is_ok, msg), is_ok
    except Exception as e:
        return print_check("Disk Space", False, f"Error checking: {e}"), False

def check_dataset_folder():
    """Check car_images folder exists and has images."""
    print("\n2. DATASET CHECKS")
    print("=" * 80)
    
    if not IMAGES_DIR.exists():
        return print_check("Images Folder", False, f"NOT FOUND: {IMAGES_DIR}"), 0
    
    image_files = [f for f in IMAGES_DIR.iterdir() 
                   if f.suffix.lower() in ['.jpg', '.jpeg', '.png']]
    count = len(image_files)
    
    is_ok = count >= 1000
    msg = f"{count:,} images found"
    if not is_ok:
        msg += f" (need at least 1,000)"
    
    return print_check("Images Folder", is_ok, msg), count

def check_csv_file():
    """Check CSV label file exists."""
    csv_files = [
        DATA_DIR / "image_labels_cleaned_final.csv",
        DATA_DIR / "image_labels_filtered.csv",
        DATA_DIR / "image_labels_cleaned.csv",
        DATA_DIR / "image_labels.csv"
    ]
    
    found_file = None
    for csv_file in csv_files:
        if csv_file.exists():
            found_file = csv_file
            break
    
    if not found_file:
        return print_check("CSV Labels File", False, "NOT FOUND in data/ folder"), None, None
    
    # Check CSV format
    try:
        try:
            import pandas as pd
        except ImportError:
            return print_check("CSV Format", False, "Pandas not installed"), found_file, None
        
        df = pd.read_csv(found_file)
        
        required_columns = ['image_filename', 'make', 'model']
        missing_cols = [col for col in required_columns if col not in df.columns]
        
        if missing_cols:
            return print_check("CSV Format", False, 
                             f"Missing columns: {', '.join(missing_cols)}"), found_file, None
        
        row_count = len(df)
        is_ok = row_count >= 1000
        msg = f"{row_count:,} labeled images"
        if not is_ok:
            msg += " (need at least 1,000)"
        
        csv_check = print_check("CSV Labels File", is_ok, f"{found_file.name} - {msg}")
        return csv_check, found_file, df
    except Exception as e:
        return print_check("CSV Format", False, f"Error reading CSV: {e}"), found_file, None

def check_image_readability(df, sample_size=100):
    """Check random sample of images are readable."""
    if df is None or len(df) == 0:
        return print_check("Image Readability", False, "No CSV data to check"), False
    
    try:
        import pandas as pd
        from PIL import Image
    except ImportError as e:
        return print_check("Image Readability", False, f"Missing package: {e}"), False
    
    sample_df = df.sample(n=min(sample_size, len(df)), random_state=42)
    corrupted = 0
    missing = 0
    
    for idx, row in sample_df.iterrows():
        img_path = IMAGES_DIR / row['image_filename']
        
        if not img_path.exists():
            missing += 1
            continue
        
        try:
            with Image.open(img_path) as img:
                img.verify()
                img = Image.open(img_path)  # Reopen after verify
                if img.size[0] < 32 or img.size[1] < 32:
                    corrupted += 1
        except Exception:
            corrupted += 1
    
    total_checked = len(sample_df)
    errors = corrupted + missing
    error_rate = errors / total_checked if total_checked > 0 else 1.0
    
    is_ok = error_rate < 0.05  # Less than 5% errors
    msg = f"Checked {total_checked} images: {errors} errors ({error_rate*100:.1f}%)"
    
    if not is_ok:
        msg += " - TOO MANY ERRORS"
    
    return print_check("Image Readability", is_ok, msg), is_ok

def check_paths():
    """Check all required paths exist and are writable."""
    print("\n3. PATH CHECKS")
    print("=" * 80)
    
    paths_to_check = [
        (SCRIPTS_DIR, "Scripts folder", True),
        (DATA_DIR, "Data folder", True),
        (IMAGES_DIR, "Images folder", True),
        (MODELS_DIR, "Models folder", False),  # Will be created
        (LOG_DIR, "Logs folder", False),  # Will be created
        (RESULTS_DIR, "Results folder", False),  # Will be created
    ]
    
    all_ok = True
    for path, name, must_exist in paths_to_check:
        if must_exist:
            exists = path.exists()
            print_check(name, exists, str(path))
            if not exists:
                all_ok = False
        else:
            # Check if can be created
            try:
                path.mkdir(parents=True, exist_ok=True)
                # Test write
                test_file = path / ".write_test"
                test_file.write_text("test")
                test_file.unlink()
                print_check(name, True, f"{path} (writable)")
            except Exception as e:
                print_check(name, False, f"{path} - Cannot create/write: {e}")
                all_ok = False
    
    return all_ok

def check_training_dry_run():
    """Dry-run training: load model, process batches, save checkpoint."""
    print("\n4. TRAINING DRY-RUN")
    print("=" * 80)
    
    try:
        import torch
        import torch.nn as nn
        from torch.utils.data import DataLoader
        from transformers import CLIPProcessor, CLIPModel
        import pandas as pd
        from sklearn.model_selection import train_test_split
        
        # Check GPU is being used
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        if device.type == "cpu":
            return print_check("GPU Usage", False, "Training will use CPU (SLOW)"), False
        
        print_check("GPU Usage", True, f"Will use {torch.cuda.get_device_name(0)}")
        
        # Load CSV
        csv_files = [
            DATA_DIR / "image_labels_cleaned_final.csv",
            DATA_DIR / "image_labels_filtered.csv",
            DATA_DIR / "image_labels_cleaned.csv",
            DATA_DIR / "image_labels.csv"
        ]
        
        df = None
        for csv_file in csv_files:
            if csv_file.exists():
                df = pd.read_csv(csv_file)
                break
        
        if df is None or len(df) < 100:
            return print_check("Dataset Loading", False, "Not enough data"), False
        
        print_check("Dataset Loading", True, f"Loaded {len(df):,} images")
        
        # Create minimal dataset
        makes = sorted(df['make'].unique().tolist())
        make_to_idx = {make: idx for idx, make in enumerate(makes)}
        
        # Sample small dataset for dry-run
        sample_df = df.sample(n=min(100, len(df)), random_state=42)
        
        # Simple dataset class for testing
        class TestDataset:
            def __init__(self, df, processor, make_to_idx):
                self.df = df.reset_index(drop=True)
                self.processor = processor
                self.make_to_idx = make_to_idx
            
            def __len__(self):
                return len(self.df)
            
            def __getitem__(self, idx):
                from PIL import Image
                row = self.df.iloc[idx]
                img_path = IMAGES_DIR / row['image_filename']
                
                try:
                    image = Image.open(img_path).convert('RGB')
                except:
                    image = Image.new('RGB', (224, 224), color='gray')
                
                make = row['make']
                model = row['model']
                text = f"a photo of a {make} {model} car"
                
                inputs = self.processor(
                    text=text,
                    images=image,
                    return_tensors="pt",
                    padding="max_length",
                    truncation=True,
                    max_length=77
                )
                
                make_label = self.make_to_idx.get(make, 0)
                
                return {
                    'pixel_values': inputs['pixel_values'].squeeze(0),
                    'input_ids': inputs['input_ids'].squeeze(0),
                    'attention_mask': inputs['attention_mask'].squeeze(0),
                    'make_label': torch.tensor(make_label, dtype=torch.long),
                }
        
        # Load processor
        processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        print_check("Processor Loading", True, "CLIP processor loaded")
        
        # Create test dataset and loader
        test_dataset = TestDataset(sample_df, processor, make_to_idx)
        test_loader = DataLoader(test_dataset, batch_size=4, shuffle=False, num_workers=0)
        print_check("DataLoader Creation", True, "DataLoader created")
        
        # Load model
        clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        
        class SimpleClassifier(nn.Module):
            def __init__(self, clip_model, num_makes):
                super().__init__()
                self.clip = clip_model
                self.classifier = nn.Linear(clip_model.config.projection_dim, num_makes)
            
            def forward(self, pixel_values, input_ids, attention_mask):
                outputs = self.clip(pixel_values=pixel_values, input_ids=input_ids, attention_mask=attention_mask)
                image_embeds = outputs.image_embeds
                logits = self.classifier(image_embeds)
                return {'logits': logits}
        
        model = SimpleClassifier(clip_model, len(makes))
        model.to(device)
        print_check("Model Loading", True, f"Model loaded on {device}")
        
        # Process one batch
        model.eval()
        with torch.no_grad():
            batch = next(iter(test_loader))
            pixel_values = batch['pixel_values'].to(device)
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            
            outputs = model(pixel_values, input_ids, attention_mask)
            print_check("Batch Processing", True, f"Processed batch of {len(pixel_values)} images")
        
        # Test checkpoint save
        checkpoint = {
            'model_state_dict': model.state_dict(),
            'test': True
        }
        test_checkpoint_file = MODELS_DIR / ".test_checkpoint.pt"
        torch.save(checkpoint, test_checkpoint_file)
        test_checkpoint_file.unlink()  # Clean up
        print_check("Checkpoint Saving", True, "Can save checkpoints")
        
        return True
        
    except Exception as e:
        error_msg = str(e)[:100]
        print_check("Training Dry-Run", False, f"Error: {error_msg}")
        print(f"      Full error: {traceback.format_exc()}")
        return False

def run_preflight_checks():
    """Run all pre-flight checks."""
    print("=" * 80)
    print("PRE-FLIGHT CHECK SYSTEM")
    print("=" * 80)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    results = {
        'timestamp': datetime.now().isoformat(),
        'checks': {},
        'all_passed': True
    }
    
    # System checks
    python_ok, _ = check_python_version()
    results['checks']['python'] = python_ok
    
    pytorch_ok, pytorch_installed, cuda_ok = check_pytorch_cuda()
    results['checks']['pytorch_cuda'] = pytorch_ok
    
    packages_ok, missing = check_required_packages()
    results['checks']['packages'] = packages_ok
    results['checks']['missing_packages'] = missing
    
    gpu_ok, gpu_name = check_gpu()
    results['checks']['gpu'] = gpu_ok
    results['checks']['gpu_name'] = gpu_name
    
    disk_ok, _ = check_disk_space()
    results['checks']['disk_space'] = disk_ok
    
    # Dataset checks
    images_ok, image_count = check_dataset_folder()
    results['checks']['images'] = images_ok
    results['checks']['image_count'] = image_count
    
    csv_ok, csv_file, df = check_csv_file()
    results['checks']['csv'] = csv_ok
    results['checks']['csv_file'] = str(csv_file) if csv_file else None
    
    readability_ok, _ = check_image_readability(df)
    results['checks']['image_readability'] = readability_ok
    
    # Path checks
    paths_ok = check_paths()
    results['checks']['paths'] = paths_ok
    
    # Training dry-run
    training_ok = check_training_dry_run()
    results['checks']['training_dry_run'] = training_ok
    
    # Summary
    print("\n" + "=" * 80)
    print("PRE-FLIGHT CHECK SUMMARY")
    print("=" * 80)
    
    all_checks = [
        ('Python Version', python_ok),
        ('PyTorch & CUDA', pytorch_ok),
        ('Required Packages', packages_ok),
        ('GPU Detection', gpu_ok),
        ('Disk Space', disk_ok),
        ('Images Folder', images_ok),
        ('CSV Labels File', csv_ok),
        ('Image Readability', readability_ok),
        ('Paths', paths_ok),
        ('Training Dry-Run', training_ok),
    ]
    
    passed = sum(1 for _, ok in all_checks if ok)
    total = len(all_checks)
    
    print(f"\nResults: {passed}/{total} checks passed\n")
    
    for name, ok in all_checks:
        status = f"{GREEN}PASS{RESET}" if ok else f"{RED}FAIL{RESET}"
        print(f"  {status} - {name}")
    
    results['all_passed'] = all(passed for _, passed in all_checks)
    results['passed_count'] = passed
    results['total_count'] = total
    
    # Save results
    results_file = LOG_DIR / f"preflight_check_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    results_file.parent.mkdir(parents=True, exist_ok=True)
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nResults saved to: {results_file}")
    
    # Final verdict
    print("\n" + "=" * 80)
    if results['all_passed']:
        print(f"{GREEN}✓ ALL CHECKS PASSED - READY FOR TRAINING{RESET}")
        print("=" * 80)
        return True
    else:
        print(f"{RED}✗ SOME CHECKS FAILED - FIX ERRORS BEFORE TRAINING{RESET}")
        print("=" * 80)
        
        if missing:
            print(f"\n{RED}Missing packages:{RESET}")
            for pkg in missing:
                print(f"  - pip install {pkg.lower()}")
        
        return False

if __name__ == "__main__":
    # Windows multiprocessing support
    if sys.platform == 'win32':
        import multiprocessing
        multiprocessing.freeze_support()
    
    success = run_preflight_checks()
    sys.exit(0 if success else 1)
