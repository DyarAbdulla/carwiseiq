"""
Setup script to add project root to Python path
This ensures all imports work correctly
"""
import os
import sys

# Get the project root directory (parent of this script)
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

# Add project root to Python path if not already there
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Also add app, core, data to path for easier imports
for folder in ['app', 'core', 'data']:
    folder_path = os.path.join(PROJECT_ROOT, folder)
    if folder_path not in sys.path and os.path.exists(folder_path):
        sys.path.insert(0, folder_path)

