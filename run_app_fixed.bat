@echo off
echo Starting Car Price Predictor Web App...
echo.
cd /d "%~dp0\.."
streamlit run app/app.py
pause

