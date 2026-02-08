"""
GPU Monitor - Real-time GPU usage tracking during training
Samples GPU utilization and VRAM usage every 0.5s
"""

import subprocess
import time
import threading
from typing import Dict, Optional
from collections import deque


class GPUMonitor:
    """Monitor GPU usage during training"""
    
    def __init__(self, sample_interval: float = 0.5):
        """
        Initialize GPU monitor
        
        Parameters:
        -----------
        sample_interval : float
            Sampling interval in seconds (default: 0.5s)
        """
        self.sample_interval = sample_interval
        self.monitoring = False
        self.monitor_thread = None
        self.gpu_utilization = deque(maxlen=10000)  # Store up to 10000 samples
        self.vram_used = deque(maxlen=10000)
        self.max_gpu_util = 0.0
        self.max_vram_mb = 0.0
        self.samples_collected = 0
        
    def _check_nvidia_smi(self) -> bool:
        """Check if nvidia-smi is available"""
        try:
            result = subprocess.run(
                ['nvidia-smi', '--version'],
                capture_output=True,
                text=True,
                timeout=2
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False
    
    def _sample_gpu(self) -> Optional[Dict[str, float]]:
        """
        Sample GPU utilization and VRAM usage
        
        Returns:
        --------
        dict with 'gpu_util' and 'vram_mb', or None if nvidia-smi unavailable
        """
        if not self._check_nvidia_smi():
            return None
        
        try:
            result = subprocess.run(
                [
                    'nvidia-smi',
                    '--query-gpu=utilization.gpu,memory.used',
                    '--format=csv,noheader,nounits'
                ],
                capture_output=True,
                text=True,
                timeout=2
            )
            
            if result.returncode != 0:
                return None
            
            # Parse output: "utilization.gpu, memory.used"
            lines = result.stdout.strip().split('\n')
            if not lines or not lines[0]:
                return None
            
            # Get first GPU (index 0)
            line = lines[0].strip()
            parts = [p.strip() for p in line.split(',')]
            
            if len(parts) < 2:
                return None
            
            try:
                gpu_util = float(parts[0])
                vram_mb = float(parts[1])
                return {'gpu_util': gpu_util, 'vram_mb': vram_mb}
            except ValueError:
                return None
                
        except Exception:
            return None
    
    def _monitor_loop(self):
        """Monitoring loop (runs in background thread)"""
        while self.monitoring:
            sample = self._sample_gpu()
            if sample:
                self.gpu_utilization.append(sample['gpu_util'])
                self.vram_used.append(sample['vram_mb'])
                
                # Update max values
                if sample['gpu_util'] > self.max_gpu_util:
                    self.max_gpu_util = sample['gpu_util']
                if sample['vram_mb'] > self.max_vram_mb:
                    self.max_vram_mb = sample['vram_mb']
                
                self.samples_collected += 1
            
            time.sleep(self.sample_interval)
    
    def start(self):
        """Start GPU monitoring"""
        if not self._check_nvidia_smi():
            return False
        
        if self.monitoring:
            return True  # Already monitoring
        
        self.monitoring = True
        self.gpu_utilization.clear()
        self.vram_used.clear()
        self.max_gpu_util = 0.0
        self.max_vram_mb = 0.0
        self.samples_collected = 0
        
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()
        return True
    
    def stop(self):
        """Stop GPU monitoring"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=1.0)
    
    def get_stats(self) -> Dict[str, float]:
        """
        Get GPU statistics
        
        Returns:
        --------
        dict with max_gpu_util, max_vram_mb, avg_gpu_util, avg_vram_mb, samples
        """
        stats = {
            'max_gpu_util': self.max_gpu_util,
            'max_vram_mb': self.max_vram_mb,
            'samples': self.samples_collected,
        }
        
        if len(self.gpu_utilization) > 0:
            stats['avg_gpu_util'] = sum(self.gpu_utilization) / len(self.gpu_utilization)
            stats['avg_vram_mb'] = sum(self.vram_used) / len(self.vram_used)
        else:
            stats['avg_gpu_util'] = 0.0
            stats['avg_vram_mb'] = 0.0
        
        return stats
    
    def was_gpu_used(self, threshold_util: float = 5.0, threshold_vram: float = 200.0) -> bool:
        """
        Determine if GPU was actually used
        
        Parameters:
        -----------
        threshold_util : float
            Minimum GPU utilization % to consider GPU used
        threshold_vram : float
            Minimum VRAM MB to consider GPU used
            
        Returns:
        --------
        bool
            True if GPU was used, False otherwise
        """
        return (self.max_gpu_util >= threshold_util) or (self.max_vram_mb >= threshold_vram)


def monitor_gpu_context(sample_interval: float = 0.5):
    """
    Context manager for GPU monitoring
    
    Usage:
    ------
    with monitor_gpu_context() as monitor:
        # Training code here
        pass
    stats = monitor.get_stats()
    """
    monitor = GPUMonitor(sample_interval=sample_interval)
    monitor.start()
    return monitor
