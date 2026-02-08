# Advanced Model Training Guide
## Target: 95-100% R² Score (0.95-1.00)

This guide documents the advanced training strategy implemented to achieve 95-100% accuracy for car price prediction.

## Overview

The current Random Forest model achieves R² = 0.5316 (53% accuracy). This advanced training script implements comprehensive improvements to reach 95-100% accuracy.

## Key Improvements Implemented

### 1. Advanced Feature Engineering

#### Luxury & Premium Brand Indicators
- **Luxury brands**: Mercedes-Benz, BMW, Audi, Porsche, Lexus, Jaguar, Land Rover, Tesla, Genesis, Infiniti, Acura, Cadillac
- **Premium brands**: Volvo, Lincoln, Buick, Chrysler
- Binary indicators (`is_luxury_brand`, `is_premium_brand`) capture brand value

#### Age-Based Depreciation Tiers
- `age_tier_0_3`: Cars 0-3 years old (highest value retention)
- `age_tier_3_5`: Cars 3-5 years old
- `age_tier_5_10`: Cars 5-10 years old
- `age_tier_10_plus`: Cars 10+ years old (lowest value)

#### Mileage Categories
- `mileage_low`: <30,000 km
- `mileage_medium`: 30,000-60,000 km
- `mileage_high`: 60,000+ km

#### Brand-Specific Depreciation Curves
- Calculates average depreciation rate per brand based on historical data
- `brand_depreciation_rate`: Annual depreciation rate by brand
- `estimated_depreciation`: Age × depreciation rate

#### Market Demand Scores
- Based on frequency of model in dataset
- Normalized to 0-1 scale
- Higher demand = higher price

#### Seasonal Factors
- Extracts month/quarter from `scraped_date`
- `seasonal_premium`: Spring/Summer months (3-8) typically have higher prices

#### Location-Based Premiums
- Identifies top 20% locations by average price
- `is_premium_location`: Binary indicator for high-value markets

#### External Market Data Features
- **Brand Reliability Ratings** (1-10 scale):
  - Toyota/Lexus: 9.0-9.5
  - Honda/Acura: 8.5
  - Premium brands: 7.0-8.5
  - Default: 7.0

- **Fuel Efficiency Ratings**:
  - Electric: 100
  - Hybrid: 50 - engine_size × 5
  - Plug-in Hybrid: 60 - engine_size × 5
  - Gasoline/Diesel: max(10, 35 - engine_size × 3)

- **Safety Ratings** (based on year):
  - 2020+: 9.0
  - 2015-2019: 8.0
  - 2010-2014: 7.0
  - <2010: 6.0
  - +0.5 boost for luxury brands

#### Market Segment Classification
- **Truck**: F-150, Silverado, Tundra, Ram, etc.
- **SUV**: X5, Q5, CR-V, RAV4, Highlander, Pilot, etc.
- **Sports**: Camaro, Mustang, Corvette, Challenger, etc.
- **Sedan**: Camry, Accord, Altima, Sonata, etc.
- **Other**: Default category

#### Interaction Features
- `year_mileage_interaction`: Year × Mileage / 1000
- `engine_cylinders_interaction`: Engine Size × Cylinders
- `luxury_age_interaction`: Luxury Brand × Age
- `mileage_age_interaction`: Mileage × Age / 1000

### 2. Advanced Models

#### CatBoost
- **Why**: Specifically designed for categorical data (make, model, condition, etc.)
- **Parameters**:
  - iterations: 1000
  - depth: 8
  - learning_rate: 0.05
  - Categorical features handled natively

#### LightGBM
- **Why**: Fast gradient boosting with excellent performance
- **Parameters**:
  - n_estimators: 1000
  - max_depth: 10
  - num_leaves: 100
  - Early stopping enabled

#### XGBoost
- **Why**: Robust gradient boosting algorithm
- **Parameters**:
  - n_estimators: 1000
  - max_depth: 8
  - learning_rate: 0.05
  - Early stopping enabled

#### Neural Network (MLP)
- **Architecture**: 4 hidden layers (200, 150, 100, 50 neurons)
- **Activation**: ReLU
- **Solver**: Adam
- **Regularization**: L2 (alpha=0.001)
- **Early stopping**: Enabled

#### Random Forest (Improved)
- **Parameters**:
  - n_estimators: 500
  - max_depth: 40
  - min_samples_split: 2
  - min_samples_leaf: 1

### 3. Hyperparameter Optimization

#### GridSearchCV (Not RandomizedSearchCV)
- **Why**: Exhaustive search for best parameters
- **Cross-validation**: 10-fold KFold
- **Scoring**: R² score

#### Parameter Grids

**Random Forest**:
- n_estimators: [500, 1000, 1500]
- max_depth: [40, 50, None]
- min_samples_split: [2, 5]
- min_samples_leaf: [1, 2]

**CatBoost**:
- iterations: [500, 1000, 1500]
- depth: [6, 8, 10]
- learning_rate: [0.03, 0.05, 0.1]

**LightGBM**:
- n_estimators: [500, 1000, 1500]
- max_depth: [8, 10, 12]
- learning_rate: [0.03, 0.05, 0.1]
- num_leaves: [50, 100, 150]

### 4. Data Quality Improvements

#### Outlier Removal
- **Method**: Isolation Forest
- **Contamination**: 5% (removes top 5% outliers)
- **Why**: More sophisticated than IQR, handles multivariate outliers

#### Missing Value Imputation
- **Method**: KNN Imputer (k=5)
- **Why**: Uses similar cars to impute missing values
- **Features imputed**: year, mileage, engine_size, cylinders, age_of_car

#### Price Range Filtering
- Removes prices < $100 or > $200,000
- Ensures realistic price range

### 5. Separate Models for Price Ranges

#### Price Range Categories
- **Budget**: < $15,000
- **Mid**: $15,000 - $35,000
- **Luxury**: > $35,000

#### Why Separate Models?
- Different factors affect different price ranges
- Luxury cars: brand, features, condition matter more
- Budget cars: mileage, age, reliability matter more
- Better accuracy for each segment

### 6. Validation Strategy

#### Time-Based Split
- **Training**: Older data (80%)
- **Testing**: Newer data (20%)
- **Why**: Tests model on future data (more realistic)

#### K-Fold Cross-Validation
- **Folds**: 10-fold
- **Shuffle**: Yes
- **Random State**: 42 (reproducibility)

#### Learning Curves
- Monitor training vs validation performance
- Detect overfitting early
- Early stopping enabled for all models

### 7. Stacked Ensemble

#### Meta-Learner
- **Algorithm**: Ridge Regression
- **Alpha**: 1.0 (L2 regularization)

#### Base Models
- Top 5 models by R² score
- Combines predictions using meta-learner
- 10-fold CV for meta-learner training

## Expected Results

### Target Metrics
- **R² Score**: 0.95-1.00 (95-100%)
- **RMSE**: < $1,500
- **MAE**: < $800
- **MAPE**: < 5%

### Why This Should Work

1. **Rich Feature Set**: 30+ engineered features capture complex relationships
2. **Categorical Handling**: CatBoost excels at make/model/condition features
3. **Ensemble Power**: Stacking combines strengths of multiple models
4. **Price-Specific Models**: Separate models for different price ranges
5. **Data Quality**: Outlier removal and imputation improve signal-to-noise ratio

## Running the Training

```bash
python advanced_model_training.py
```

## Output Files

- `models/advanced_car_price_model.pkl`: Best model
- `models/car_price_model.pkl`: Default model (same as advanced)
- `evaluation_reports/advanced_model_comparison.csv`: Model comparison
- `evaluation_reports/advanced_evaluation_report.txt`: Detailed report

## Model Usage

The trained model includes:
- Best model (highest R²)
- Feature encoders (make, model, location, etc.)
- Price range models (budget, mid, luxury)
- Brand reliability mappings
- All feature engineering logic

## Notes

- **No Data Leakage**: All features are derived from input data only
- **Reproducible**: Random state set to 42
- **Scalable**: Models handle 62K+ car records efficiently
- **Production-Ready**: Includes all encoders and preprocessing logic

## Troubleshooting

### If R² < 0.95:
1. Check feature importance - may need more domain-specific features
2. Try increasing model complexity (more trees, deeper networks)
3. Consider feature selection to remove noise
4. Check for remaining outliers or data quality issues

### If Training Takes Too Long:
1. Reduce GridSearchCV parameter grid size
2. Use RandomizedSearchCV instead (faster)
3. Reduce number of folds (5 instead of 10)
4. Train fewer models

### If Overfitting:
1. Increase regularization (alpha for Ridge, min_samples_split for RF)
2. Reduce model complexity
3. Add more training data
4. Use early stopping (already enabled)
