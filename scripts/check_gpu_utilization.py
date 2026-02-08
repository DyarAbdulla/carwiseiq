"""
Quick script to check GPU utilization and batch size during training
Run this while training is running to diagnose GPU usage issues
"""

import torch
import subprocess
import time

def check_gpu_utilization():
    """Check current GPU utilization."""
    
    print("=" * 80)
    print("GPU UTILIZATION CHECK")
    print("=" * 80)
    
    if not torch.cuda.is_available():
        print("❌ CUDA/GPU not available!")
        return
    
    device = torch.device("cuda")
    gpu_name = torch.cuda.get_device_name(0)
    gpu_memory_total = torch.cuda.get_device_properties(0).total_memory / 1024**3
    
    print(f"\nGPU: {gpu_name}")
    print(f"Total Memory: {gpu_memory_total:.2f} GB")
    
    # PyTorch memory stats
    allocated = torch.cuda.memory_allocated(device) / 1024**3
    reserved = torch.cuda.memory_reserved(device) / 1024**3
    max_allocated = torch.cuda.max_memory_allocated(device) / 1024**3
    
    print(f"\nPyTorch Memory:")
    print(f"  Allocated: {allocated:.2f} GB ({allocated/gpu_memory_total*100:.1f}%)")
    print(f"  Reserved: {reserved:.2f} GB ({reserved/gpu_memory_total*100:.1f}%)")
    print(f"  Peak Allocated: {max_allocated:.2f} GB ({max_allocated/gpu_memory_total*100:.1f}%)")
    
    # Try nvidia-smi if available
    try:
        result = subprocess.run(['nvidia-smi', '--query-gpu=utilization.gpu,memory.used,memory.total', '--format=csv,noheader'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            gpu_util, mem_used, mem_total = result.stdout.strip().split('\n')[0].split(', ')
            print(f"\nnvidia-smi Stats:")
            print(f"  GPU Utilization: {gpu_util}")
            print(f"  Memory Used: {mem_used}")
            print(f"  Memory Total: {mem_total}")
    except:
        print("\n⚠️  nvidia-smi not available (install NVIDIA drivers)")
    
    # Recommendations
    print("\n" + "=" * 80)
    print("RECOMMENDATIONS")
    print("=" * 80)
    
    if allocated < gpu_memory_total * 0.1:
        print("⚠️  GPU memory usage is VERY LOW (<10%)")
        print("   Possible issues:")
        print("   1. Batch size too small")
        print("   2. Data loading bottleneck (GPU waiting for CPU)")
        print("   3. Model too small for GPU")
        print("\n   Solutions:")
        print("   - Increase batch_size: --batch_size 128 or higher")
        print("   - Increase num_workers: --num_workers 12-16")
        print("   - Add gradient accumulation: --gradient_accumulation 2-4")
    elif allocated < gpu_memory_total * 0.3:
        print("⚠️  GPU memory usage is LOW (<30%)")
        print("   Consider increasing batch_size or gradient_accumulation")
    elif allocated < gpu_memory_total * 0.7:
        print("✅ GPU memory usage is GOOD (30-70%)")
    else:
        print("✅ GPU memory usage is HIGH (>70%) - good utilization!")
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    check_gpu_utilization()
