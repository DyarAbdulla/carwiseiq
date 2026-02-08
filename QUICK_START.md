# ⚡ Quick Start Guide

**Get the app running in 3 steps!**

## 🚀 For Windows Users

### Method 1: Automated Installation (Easiest)

1. **Double-click `INSTALL.bat`** - This installs all dependencies
2. **Double-click `RUN_APP.bat`** - This starts the app

### Method 2: Manual Installation

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the app
streamlit run app.py
```

## 🐧 For Mac/Linux Users

```bash
# 1. Make scripts executable (first time only)
chmod +x install.sh run_app.sh

# 2. Install dependencies
./install.sh

# 3. Run the app
./run_app.sh
```

Or manually:
```bash
pip install -r requirements.txt
streamlit run app.py
```

## ✅ Verify Setup

Run the verification script to check if everything is ready:

```bash
python verify_setup.py
```

## 📋 What You Need

- ✅ Python 3.8 or higher
- ✅ All files from the project
- ✅ Internet connection (for first-time installation)

## 🔍 Troubleshooting

**Issue: Command not found**
- Use `python` instead of `python3` on Windows
- Use `python3` on Mac/Linux
- Try `py -m pip install -r requirements.txt` on Windows

**Issue: Module not found**
- Run: `pip install -r requirements.txt`
- Make sure you're in the project directory

**Issue: Model file missing**
- Run: `python core/model_training.py` (if needed)

**Need more help?** See `SETUP_GUIDE.md` for detailed instructions.

---

**Ready?** Run `streamlit run app.py` now! 🚗💰




