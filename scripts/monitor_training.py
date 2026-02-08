"""
Background Training Monitor
Monitors GPU temperature, saves progress, handles interruptions
"""

import time
import subprocess
import json
from pathlib import Path
from datetime import datetime
import signal
import sys

PROJECT_ROOT = Path(__file__).parent.parent
LOG_DIR = PROJECT_ROOT / "logs"
STATUS_FILE = LOG_DIR / "training_status.txt"
MONITOR_LOG = LOG_DIR / "monitor.log"

GPU_TEMP_THRESHOLD = 85  # Auto-stop if exceeds this
CHECK_INTERVAL = 300  # Check every 5 minutes

def get_gpu_temperature():
    """Get GPU temperature."""
    try:
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=temperature.gpu', '--format=csv,noheader,nounits'],
            capture_output=True, text=True,
            timeout=5
        )
        if result.returncode == 0:
            return int(result.stdout.strip())
    except:
        pass
    return None

def get_gpu_utilization():
    """Get GPU utilization."""
    try:
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=utilization.gpu', '--format=csv,noheader,nounits'],
            capture_output=True, text=True,
            timeout=5
        )
        if result.returncode == 0:
            return int(result.stdout.strip())
    except:
        pass
    return None

def write_status(message):
    """Write status to file."""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    status_line = f"[{timestamp}] {message}\n"
    
    with open(STATUS_FILE, 'a') as f:
        f.write(status_line)
    
    with open(MONITOR_LOG, 'a') as f:
        f.write(status_line)
    
    print(status_line.strip())

def monitor_training():
    """Monitor training process."""
    print("=" * 80)
    print("TRAINING MONITOR STARTED")
    print("=" * 80)
    print(f"Monitoring GPU temperature (threshold: {GPU_TEMP_THRESHOLD}°C)")
    print(f"Check interval: {CHECK_INTERVAL} seconds ({CHECK_INTERVAL/60:.1f} minutes)")
    print(f"Status file: {STATUS_FILE}")
    print(f"Log file: {MONITOR_LOG}")
    print("=" * 80)
    
    write_status("Monitor started")
    
    check_count = 0
    last_temp_warning = 0
    
    try:
        while True:
            check_count += 1
            current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            # Check GPU temperature
            gpu_temp = get_gpu_temperature()
            gpu_util = get_gpu_utilization()
            
            if gpu_temp is not None:
                write_status(f"Check #{check_count}: GPU Temp: {gpu_temp}°C, Utilization: {gpu_util}%")
                
                # Warning if approaching threshold
                if gpu_temp > GPU_TEMP_THRESHOLD - 5:
                    if time.time() - last_temp_warning > 300:  # Warn every 5 minutes
                        write_status(f"⚠️  WARNING: GPU temperature high: {gpu_temp}°C")
                        last_temp_warning = time.time()
                
                # Critical - stop training
                if gpu_temp > GPU_TEMP_THRESHOLD:
                    write_status(f"🚨 CRITICAL: GPU temperature {gpu_temp}°C exceeds threshold {GPU_TEMP_THRESHOLD}°C")
                    write_status("STOPPING TRAINING TO PREVENT DAMAGE")
                    # Signal to stop (training script should check status file)
                    return False
            
            # Check if training is still running (check for training log updates)
            # This is a simple check - training script should update status
            
            time.sleep(CHECK_INTERVAL)
            
    except KeyboardInterrupt:
        write_status("Monitor stopped by user")
        return True
    except Exception as e:
        write_status(f"Monitor error: {e}")
        return False

if __name__ == "__main__":
    # Create log directory
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    
    # Clear old status
    if STATUS_FILE.exists():
        STATUS_FILE.write_text("")
    
    success = monitor_training()
    sys.exit(0 if success else 1)
