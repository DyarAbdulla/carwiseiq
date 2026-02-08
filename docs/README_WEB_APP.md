# Car Price Predictor - Web Application

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Web Application
```bash
streamlit run app.py
```

The app will automatically open in your default web browser at `http://localhost:8501`

## 📋 Prerequisites

Before running the web app, make sure you have:

1. ✅ Trained the model by running `model_training.py`
2. ✅ Generated visualizations by running `data_visualization.py` (optional)
3. ✅ Installed all required packages from `requirements.txt`

## 🎯 Features

### Prediction Tab
- Interactive form to input car details
- Real-time price prediction
- Confidence intervals (95%)
- Similar cars comparison table
- Model accuracy metrics

### Statistics Tab
- Dataset overview metrics
- Price distribution charts
- Top car makes analysis
- Fuel type distribution
- Price trends by year
- Condition-based price analysis

### Visualizations Tab
- Embedded static visualizations from data analysis
- Interactive dashboard link

### About Tab
- Project information
- Model details
- Performance metrics
- Usage instructions

## 🎨 Customization

The app uses custom CSS for styling. You can modify the styles in the `st.markdown()` section at the top of `app.py`.

## 🔧 Troubleshooting

### Model Not Found
If you see "Model not loaded" error:
- Run `python model_training.py` first to train and save the model

### Data Not Found
If visualizations are missing:
- Run `python data_visualization.py` to generate visualizations

### Port Already in Use
If port 8501 is busy:
```bash
streamlit run app.py --server.port 8502
```

## 📱 Usage Tips

1. **Make Selection**: Choose a car make from the dropdown
2. **Model Selection**: Models are automatically filtered by the selected make
3. **Year Slider**: Adjust from 2000 to 2025
4. **Mileage**: Enter in kilometers
5. **Condition**: Select from New to Poor
6. **Click Predict**: Get instant price prediction with confidence interval

## 🌐 Deployment

To deploy this app:

1. **Streamlit Cloud**: Push to GitHub and deploy via Streamlit Cloud
2. **Heroku**: Use the Procfile and deploy as a web app
3. **Docker**: Containerize the application
4. **Local Network**: Access from other devices using your local IP

Enjoy predicting car prices! 🚗💰










