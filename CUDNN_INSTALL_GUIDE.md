# cuDNN Installation Guide

## The Problem
When you run the cuDNN installer (`cudnn_9.17.1_windows_x86_64.exe`), it extracts files but **doesn't automatically install them**. You need to manually copy the extracted files to your CUDA directory.

## Solution

### Option 1: Use the Find Script (Recommended)
If you already extracted cuDNN somewhere:

1. Run: `.\find_and_install_cudnn.ps1`
2. When prompted for admin rights, click "Yes"
3. The script will search for extracted cuDNN files
4. If found, it will ask you to confirm
5. If not found, it will ask you to provide the path manually
6. The script will copy all files to CUDA automatically

### Option 2: Manual Installation

1. **Find where you extracted cuDNN:**
   - Common locations:
     - `C:\cudnn`
     - `C:\Users\Darin Game\Downloads\cudnn*`
     - `C:\Users\Darin Game\Desktop\cudnn*`
   - The folder should contain three subfolders: `bin`, `include`, and `lib`

2. **Copy files manually:**
   - Open File Explorer as Administrator
   - Navigate to your CUDA directory: `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4`
   - Copy files from extracted cuDNN folder:
     - `bin\*` → `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin\`
     - `include\*` → `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\include\`
     - `lib\x64\*` → `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\lib\x64\`

3. **Restart your computer**

4. **Verify installation:**
   ```powershell
   python -c "import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))"
   ```

### Option 3: Re-extract and Install

1. Run: `.\extract_and_install_cudnn.ps1`
2. When the installer opens, extract to: `C:\cudnn_temp_extract`
3. The script will automatically find and install the files

## Quick Check: Where did you extract cuDNN?

When you ran the installer, where did you choose to extract the files?
- Check your Downloads folder
- Check your Desktop
- Check if you created a `C:\cudnn` folder
- Check the folder you selected in the installer

Once you know the location, run `.\find_and_install_cudnn.ps1` and provide that path when asked.
