"""
GPU Detection Helper
Detects NVIDIA GPU availability for training
"""

import subprocess
import sys


def detect_nvidia_gpu():
    """
    Detect if NVIDIA GPU is available
    
    Returns:
    --------
    bool
        True if NVIDIA GPU detected, False otherwise
    """
    try:
        result = subprocess.run(
            ['nvidia-smi'],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        return False


def get_gpu_info():
    """
    Get GPU information if available
    
    Returns:
    --------
    dict
        GPU info dict with 'available' and optionally 'name'
    """
    info = {'available': False, 'name': None}
    
    if detect_nvidia_gpu():
        try:
            result = subprocess.run(
                ['nvidia-smi', '--query-gpu=name', '--format=csv,noheader'],
                capture_output=True,
                text=True,
                timeout=2
            )
            if result.returncode == 0:
                info['available'] = True
                info['name'] = result.stdout.strip().split('\n')[0]
        except Exception:
            pass
    
    return info


if __name__ == "__main__":
    gpu_info = get_gpu_info()
    if gpu_info['available']:
        print(f"✅ GPU detected: {gpu_info['name']}")
    else:
        print("❌ No GPU detected, will use CPU")
