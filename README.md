# 🚗 Car Price Predictor Pro

**AI-Powered Market Value Estimation System**

A comprehensive machine learning application that predicts car prices with 99.96% accuracy using advanced ensemble methods. Features a modern Streamlit web interface with multilingual support (English/Kurdish Sorani), interactive visualizations, and real-time predictions.

## 🏆 Key Achievements

- **99.96% Prediction Accuracy** (R² Score: 0.9996)
- **$180.43 RMSE** on 62,181 car listings
- **Complete ML Pipeline** from data collection to deployment
- **Interactive Web Application** with premium UI design
- **Multilingual Support** (English & Kurdish Sorani)

## 🚀 Quick Start

This project consists of multiple components:
- **Frontend**: Next.js application (see `frontend/README.md`)
- **Backend**: Python FastAPI ML service
- **Auth Backend**: Node.js Express authentication service

### Frontend (Next.js)

**After Reboot - Complete Setup:**

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies (use `npm ci` for exact versions from package-lock.json):**
   ```bash
   npm ci
   ```
   If `npm ci` fails, use `npm install` instead.

3. **Clean cache if needed (if experiencing build issues):**
   ```bash
   # Windows PowerShell:
   npm run clean:win

   # Or manually delete .next folder:
   # rmdir /s /q .next
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3002`

5. **If you need to set up environment variables:**
   ```bash
   # Copy env.example to .env.local (if not already exists)
   copy env.example .env.local
   # Edit .env.local with your backend URLs if different from defaults
   ```

**Troubleshooting:**
- **"Module not found" errors:** Delete `node_modules` and reinstall: `rmdir /s /q node_modules && npm ci`
- **Build fails:** Clean cache: `npm run clean:win && npm run build`
- **Port 3002 in use:** Stop other Node.js processes or change port in `package.json`

See `frontend/README.md` for detailed setup and troubleshooting.

### Backend (Python FastAPI)

**Prerequisites:**
- Python 3.8 or higher
- Trained model file (`models/best_model_v2.pkl`)
- Dataset (`data/cleaned_car_data.csv`)

**Installation:**

1. **Install dependencies:**
```bash
pip install -r requirements.txt
```

2. **Run the application:**
```bash
streamlit run app.py
```

The app will automatically open in your default web browser at `http://localhost:8501`

**🔍 Verify Setup:**
```bash
python verify_setup.py
```

**📚 Need detailed instructions?** See `SETUP_GUIDE.md` for comprehensive setup guide.

## 📋 Project Structure

```
Car prices definer program/
├── app.py                          # Main Streamlit application
├── translations.py                 # Translation module (English/Kurdish)
├── requirements.txt                # Python dependencies
├── README.md                       # This file
├── app/
│   └── config.py                  # Configuration and file paths
├── core/
│   ├── predict_price.py           # Prediction engine
│   ├── model_training.py          # ML model training
│   └── utils.py                   # Utility functions
├── data/
│   ├── cleaned_car_data.csv       # Processed dataset
│   ├── data_cleaning.py           # Data preprocessing
│   └── data_visualization.py      # EDA and charts
├── models/
│   └── best_model_v2.pkl          # Trained model
├── visualizations/                 # Generated charts
└── docs/                           # Documentation
```

## 🎯 Features

### Prediction Features
- ✅ **Single Prediction**: Enter car details and get instant price estimate with confidence intervals
- ✅ **Batch Prediction**: Upload CSV file to predict prices for multiple cars at once
- ✅ **Car Comparison**: Compare up to 5 cars side-by-side with interactive visualizations
- ✅ **Market Comparison**: See how predicted price compares to market average
- ✅ **Similar Cars**: View similar cars from the dataset

### Analytics & Visualization
- ✅ **Dataset Statistics**: KPI cards showing total cars, average price, median price, year range
- ✅ **Price Distribution**: Interactive histogram of car prices
- ✅ **Top Makes Analysis**: Bar chart of most popular car makes
- ✅ **Fuel Type Distribution**: Pie chart of fuel types
- ✅ **Price Trends**: Line chart showing price trends by year
- ✅ **Condition Analysis**: Bar chart of average prices by condition
- ✅ **Advanced Visualizations**: Interactive HTML visualizations with zoom and pan

### User Experience
- ✅ **Premium UI**: Dark theme with glassmorphism effects and smooth animations
- ✅ **Multilingual**: English and Kurdish (Sorani) language support
- ✅ **RTL Support**: Right-to-left layout for Kurdish
- ✅ **Responsive Design**: Works on different screen sizes
- ✅ **Export Options**: Download predictions as CSV or JSON
- ✅ **Share Functionality**: Copy prediction details to clipboard

## 🔬 Technical Details

### Dataset
- **Size**: 62,181 car listings
- **Features**: Make, Model, Year, Mileage, Condition, Fuel Type, Engine Size, Cylinders, Location
- **Target**: Price (USD)

### Model Architecture
- **Algorithm**: Stacking Ensemble
  - Base models: Random Forest, XGBoost, LightGBM
  - Meta-learner: Ridge Regression
- **Performance Metrics**:
  - R² Score: 0.9996 (99.96%)
  - RMSE: $180.43
  - MAE: $91.02
  - Coverage: 96.36%

### Technology Stack
- **Frontend**: Streamlit with custom CSS
- **Machine Learning**: Scikit-learn, XGBoost, LightGBM
- **Data Processing**: Pandas, NumPy
- **Visualization**: Plotly, Matplotlib, Seaborn
- **File Handling**: openpyxl, python-dateutil

## 📱 Usage Guide

### Making a Prediction

1. **Select Language**: Choose English or Kurdish from the sidebar
2. **Navigate to Predict Tab**: Click on "Predict" in the main navigation
3. **Enter Car Details**:
   - Select Make and Model from dropdowns
   - Adjust Year using the slider (2000-2025)
   - Enter Mileage in kilometers
   - Set Engine Size (L) and Number of Cylinders
   - Choose Condition and Fuel Type
   - Select Location
4. **Click "Predict Price"**: Get instant prediction with confidence interval

### Batch Prediction

1. Go to **Batch** subtab under Predict
2. Upload a CSV file with columns: `make`, `model`, `year`, `mileage`, `condition`, `fuel_type`, `engine_size`, `cylinders`, `location`
3. Click **"Predict All Prices"**
4. Download results as CSV

### Comparing Cars

1. Go to **Compare** subtab under Predict
2. Select number of cars to compare (2-5)
3. Enter details for each car
4. Click **"Compare Prices"** to see side-by-side comparison with bar chart

### Viewing Statistics

1. Navigate to **Statistics** tab
2. View KPI cards and interactive charts
3. Explore price distributions, trends, and market analysis

### Exploring Visualizations

1. Navigate to **Visualizations** tab
2. Select interactive visualizations from dropdown (lazy loading)
3. View static PNG visualizations
4. Use expander to show additional visualizations

## 🛠️ Development

### Training the Model

If you need to retrain the model:

```bash
python core/model_training.py
```

This will:
- Load and preprocess the data
- Train multiple models with hyperparameter tuning
- Evaluate models and select the best one
- Save the trained model to `models/best_model_v2.pkl`

### Generating Visualizations

To generate or regenerate visualizations:

```bash
python data/data_visualization.py
```

This creates interactive HTML and static PNG files in the `visualizations/` folder.

### Data Cleaning

To clean and preprocess raw data:

```bash
python data/data_cleaning.py
```

## 🔧 Configuration

All configuration settings are in `app/config.py`:
- File paths for data, models, and visualizations
- Model parameters
- Feature configuration
- Validation ranges

## 🌐 Deployment

### Streamlit Cloud

1. Push code to GitHub repository
2. Go to [share.streamlit.io](https://share.streamlit.io)
3. Connect your GitHub account
4. Select repository and main file (`app.py`)
5. Deploy!

### Local Network

Access from other devices on your network:

```bash
streamlit run app.py --server.address 0.0.0.0
```

Then access via `http://YOUR_IP_ADDRESS:8501`

### Docker (Future)

Containerization support coming soon.

## 🐛 Troubleshooting

### Model Not Found Error
- Ensure `models/best_model_v2.pkl` exists
- Run `python core/model_training.py` to train the model

### Data Not Found Error
- Ensure `data/cleaned_car_data.csv` exists
- Run `python data/data_cleaning.py` to process the data

### Visualizations Not Loading
- Ensure `visualizations/` folder exists with visualization files
- Run `python data/data_visualization.py` to generate visualizations

### Port Already in Use
```bash
streamlit run app.py --server.port 8502
```

### Import Errors
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Check that all files are in correct locations according to project structure

## 📊 Model Performance

The model achieves excellent performance on the test set:

| Metric | Value |
|--------|-------|
| R² Score | 0.9996 (99.96%) |
| RMSE | $180.43 |
| MAE | $91.02 |
| Coverage | 96.36% |

## 🎓 Educational Value

This project demonstrates:
- Complete data science lifecycle
- Data cleaning & preprocessing techniques
- Exploratory data analysis (EDA)
- Feature engineering
- Machine learning model development
- Model evaluation & validation
- Hyperparameter tuning
- Ensemble methods
- Web application development
- Production-ready code practices
- Multilingual application support

## 📄 License

This project is part of educational coursework at the University of Human Development.

## 👥 Credits

**Developed as part of Introduction to Data Science coursework**
**University of Human Development - 2025**

---

**Enjoy predicting car prices! 🚗💰**




