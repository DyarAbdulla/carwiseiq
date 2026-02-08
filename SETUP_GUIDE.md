# 🚀 Setup Guide - Car Price Predictor Pro

Complete guide to set up and run `streamlit run app.py` on your laptop.

## ✅ Prerequisites

1. **Python 3.8 or higher** installed on your system
   - Check version: `python --version` or `python3 --version`
   - Download from: https://www.python.org/downloads/

2. **All project files** in the correct directory structure

## 📦 Installation Steps

### Step 1: Navigate to Project Directory

Open your terminal/command prompt and navigate to the project folder:

```bash
cd "D:\Car prices definer program"
```

### Step 2: Create Virtual Environment (Recommended)

It's best practice to use a virtual environment to avoid conflicts:

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate
```

### Step 3: Install Dependencies

Install all required Python packages:

```bash
pip install -r requirements.txt
```

This will install:
- streamlit (web framework)
- pandas (data processing)
- numpy (numerical operations)
- scikit-learn (machine learning)
- matplotlib (plotting)
- seaborn (statistical visualization)
- plotly (interactive charts)
- openpyxl (Excel file support)
- python-dateutil (date utilities)

### Step 4: Verify Installation

Check that all packages are installed:

```bash
pip list
```

You should see all the packages from `requirements.txt` listed.

### Step 5: Verify Required Files

Make sure these files exist:

**Required Files:**
- ✅ `app.py` (main application)
- ✅ `models/best_model_v2.pkl` (trained model)
- ✅ `data/cleaned_car_data.csv` (dataset)
- ✅ `app/config.py` (configuration)
- ✅ `translations.py` (translations)
- ✅ `predict_price.py` (prediction module)
- ✅ `utils.py` (utilities)
- ✅ `requirements.txt` (dependencies)

**Optional but Recommended:**
- `models/make_encoder.pkl` (for make encoding)
- `models/model_encoder.pkl` (for model encoding)
- `visualizations/` folder (for visualization tab)

### Step 6: Run the Application

Start the Streamlit app:

```bash
streamlit run app.py
```

The app will automatically open in your default web browser at `http://localhost:8501`

## 🔧 Troubleshooting

### Issue: "pip: command not found"

**Solution:** 
- Make sure Python is installed and added to PATH
- Try `python -m pip install -r requirements.txt` instead
- On Windows, use `py -m pip install -r requirements.txt`

### Issue: "streamlit: command not found"

**Solution:**
- Make sure you activated the virtual environment (if using one)
- Verify installation: `pip show streamlit`
- Reinstall: `pip install streamlit`

### Issue: "ModuleNotFoundError: No module named 'X'"

**Solution:**
- Install the missing module: `pip install X`
- Or reinstall all dependencies: `pip install -r requirements.txt --upgrade`

### Issue: "Model file not found"

**Solution:**
- Ensure `models/best_model_v2.pkl` exists
- If missing, run: `python core/model_training.py` to train the model
- Or use `python model_training.py` if in root directory

### Issue: "Data file not found"

**Solution:**
- Ensure `data/cleaned_car_data.csv` exists
- If missing, run: `python data/data_cleaning.py` to clean the data
- Or use `python data_cleaning.py` if in root directory

### Issue: Port Already in Use

**Solution:**
Run on a different port:

```bash
streamlit run app.py --server.port 8502
```

### Issue: Permission Denied (Windows)

**Solution:**
- Run terminal as Administrator
- Or use `python -m streamlit run app.py`

### Issue: Slow Loading or Crashes

**Solutions:**
- Ensure you have sufficient RAM (4GB+ recommended)
- Close other applications
- Check that data file isn't corrupted
- Try clearing Streamlit cache: `streamlit cache clear`

## 🎯 Quick Start (All-in-One)

For a quick setup, run these commands in order:

```bash
# 1. Navigate to project
cd "D:\Car prices definer program"

# 2. Create and activate virtual environment (optional but recommended)
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the app
streamlit run app.py
```

## 📋 System Requirements

**Minimum:**
- Python 3.8+
- 4GB RAM
- 500MB free disk space
- Internet connection (for first-time package downloads)

**Recommended:**
- Python 3.9 or higher
- 8GB RAM
- 1GB free disk space
- Modern web browser (Chrome, Firefox, Edge, Safari)

## 🔍 Verification Checklist

Before running the app, verify:

- [ ] Python is installed and in PATH
- [ ] All dependencies are installed (`pip list`)
- [ ] Virtual environment is activated (if using one)
- [ ] `app.py` exists in project root
- [ ] `models/best_model_v2.pkl` exists
- [ ] `data/cleaned_car_data.csv` exists
- [ ] No error messages when importing: `python -c "import streamlit; print('OK')"`

## 💡 Tips

1. **First Run:** The first time you run the app, it may take longer to load as Streamlit processes the model and data.

2. **Browser:** The app works best in Chrome, Firefox, or Edge. Safari also works but may have minor rendering differences.

3. **Performance:** For best performance, close unnecessary browser tabs and applications.

4. **Updates:** To update packages: `pip install -r requirements.txt --upgrade`

5. **Virtual Environment:** Always activate your virtual environment before running the app if you're using one.

## 🆘 Still Having Issues?

1. Check the error message carefully - it usually tells you what's missing
2. Verify all files are in the correct locations
3. Ensure Python version is 3.8 or higher
4. Try reinstalling dependencies: `pip install -r requirements.txt --force-reinstall`
5. Check Streamlit documentation: https://docs.streamlit.io/

---

**Ready to go?** Run `streamlit run app.py` and enjoy! 🚗💰




