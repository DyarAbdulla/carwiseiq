SAMPLE DATASET FOR TEACHER REVIEW
==================================

File: sample_dataset_for_teacher.xlsx

DESCRIPTION:
------------
This is a representative sample of the full dataset used for training the 
Car Price Predictor Pro model. The full dataset contains 62,181 car listings,
and this sample contains 250 records selected to show variety across different
vehicle makes, years, conditions, and fuel types.

DATASET INFORMATION:
--------------------
- Total Records in Sample: 250 (out of 62,181 in full dataset)
- Total Columns: 18 (all columns from original dataset)
- Year Range: 1991 - 2025
- Price Range: $0 - $79,000
- Unique Makes: 26 different car manufacturers
- Conditions: New, Used
- Fuel Types: Gasoline, Hybrid, EV (Electric Vehicle), Diesel

COLUMNS INCLUDED:
-----------------
1. scraped_date         - Date when data was collected
2. title                - Full vehicle title/name
3. make                 - Car manufacturer (e.g., Toyota, BMW)
4. model                - Car model name
5. trim                 - Trim level/variant
6. year                 - Model year
7. price                - Vehicle price in USD
8. mileage              - Vehicle mileage/odometer reading
9. mileage_unit         - Unit of mileage (km)
10. location            - Geographic location
11. condition           - Vehicle condition (New/Used)
12. fuel_type           - Fuel type (Gasoline/Hybrid/EV/Diesel)
13. engine_size         - Engine displacement
14. cylinders           - Number of engine cylinders
15. condition_encoded   - Encoded condition (numeric)
16. fuel_type_encoded   - Encoded fuel type (numeric)
17. location_encoded    - Encoded location (numeric)
18. age_of_car          - Calculated age (2025 - year)

NOTE:
-----
This sample dataset is provided for educational and review purposes only.
It represents a small subset of the full dataset used for model training.
The full dataset and trained model files are not included for proprietary reasons.

PROJECT INFORMATION:
--------------------
Project: Car Price Predictor Pro
Model Accuracy: 99.96% (R² Score: 0.9996)
Algorithm: Stacking Ensemble (Random Forest + XGBoost + LightGBM with Ridge meta-learner)

