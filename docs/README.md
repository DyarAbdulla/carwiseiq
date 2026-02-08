# 🚗 Car Price Predictor Pro
**AI-Powered Market Value Estimation System**

## 🏆 Key Achievements
- **99.8% Prediction Accuracy** (R² Score: 0.9982)
- **$385.86 Average Error** on 62,181 cars
- **Complete ML Pipeline** from data collection to deployment
- **Interactive Web Application** with real-time predictions

## 📊 Quick Demo
```bash
# Install dependencies
pip install -r requirements.txt

# Run the application
streamlit run app.py
```

## 🎯 Features
- ✅ Single & batch price predictions
- ✅ Side-by-side car comparison
- ✅ Interactive data visualizations
- ✅ Market analysis & statistics
- ✅ Confidence intervals
- ✅ 95%+ prediction accuracy

## 🔬 Technical Details
- **Dataset**: 62,181 car listings
- **Features**: Make, Model, Year, Mileage, Condition, Fuel Type, Engine Size, Cylinders, Location
- **Model**: Stacking Ensemble (Random Forest + XGBoost with Ridge Meta-learner)
- **Evaluation**: 99.8% R² Score, $385.86 RMSE
- **Framework**: Python, Scikit-learn, XGBoost, Streamlit

## 📁 Project Structure
```
Car prices definer program/
├── app.py                          # Main Streamlit application
├── data_cleaning.py                # Data preprocessing
├── data_visualization.py           # EDA and charts
├── model_training.py               # ML model training
├── predict_price.py                # Prediction engine
├── cleaned_car_data.csv            # Processed dataset
├── models/
│   └── best_model_v2.pkl          # Trained model
└── visualizations/                 # Generated charts
```

## 🚀 Usage
1. **Make a Prediction**: Enter car details and get instant price estimate
2. **Compare Cars**: Side-by-side comparison of multiple vehicles
3. **View Analytics**: Explore dataset statistics and trends
4. **Export Results**: Download predictions as CSV/JSON

## 🎓 Educational Value
This project demonstrates:
- Complete data science lifecycle
- Data cleaning & preprocessing techniques
- Exploratory data analysis (EDA)
- Machine learning model development
- Model evaluation & validation
- Web application deployment
- Production-ready code practices

---

**Developed as part of Introduction to Data Science coursework**  
**University of Human Development - 2025**
