"""
Verify Model Quality
Loads cleaned dataset, computes metrics, and verifies price predictions are realistic
"""

import pandas as pd
import numpy as np
from pathlib import Path
import sys
import os

# Add core to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from core.predict_price import predict_price
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

def verify_model_quality():
    """Verify model quality and price sanity"""
    print("=" * 80)
    print("MODEL QUALITY VERIFICATION")
    print("=" * 80)
    
    # Load cleaned dataset
    data_path = Path('data/iqcars_cleaned.csv')
    if not data_path.exists():
        print(f"❌ Error: {data_path} not found!")
        return False
    
    print(f"\nLoading dataset from {data_path}...")
    df = pd.read_csv(data_path)
    print(f"Loaded {len(df)} rows")
    
    # Split into features and target
    y_true = df['price'].values
    car_features = df.drop(columns=['price']).to_dict('records')
    
    # Predict on all data (or sample for speed)
    print("\nComputing predictions...")
    sample_size = min(1000, len(df))  # Sample for speed
    sample_indices = np.random.choice(len(df), sample_size, replace=False)
    
    predictions = []
    actuals = []
    errors = []
    
    for idx in sample_indices:
        car_data = car_features[idx]
        actual_price = y_true[idx]
        
        try:
            pred = predict_price(car_data)
            if isinstance(pred, np.ndarray):
                pred_val = float(pred[0])
            else:
                pred_val = float(pred)
            
            predictions.append(pred_val)
            actuals.append(actual_price)
            error_pct = abs(pred_val - actual_price) / (actual_price + 1e-8) * 100
            errors.append(error_pct)
        except Exception as e:
            print(f"  ⚠️ Prediction failed for row {idx}: {e}")
            continue
    
    if len(predictions) == 0:
        print("❌ No successful predictions!")
        return False
    
    predictions = np.array(predictions)
    actuals = np.array(actuals)
    
    # Compute metrics
    mae = mean_absolute_error(actuals, predictions)
    rmse = np.sqrt(mean_squared_error(actuals, predictions))
    r2 = r2_score(actuals, predictions)
    mape = np.mean(np.abs((actuals - predictions) / (actuals + 1e-8))) * 100
    
    print(f"\n{'='*80}")
    print("METRICS")
    print(f"{'='*80}")
    print(f"MAE:  ${mae:,.2f}")
    print(f"RMSE: ${rmse:,.2f}")
    print(f"R²:   {r2:.4f}")
    print(f"MAPE: {mape:.2f}%")
    
    # Verify price sanity
    print(f"\n{'='*80}")
    print("PRICE SANITY CHECK")
    print(f"{'='*80}")
    
    min_price = predictions.min()
    max_price = predictions.max()
    print(f"Predicted price range: ${min_price:,.2f} - ${max_price:,.2f}")
    
    # Check bounds
    price_valid = (predictions >= 500) & (predictions <= 300000)
    valid_count = price_valid.sum()
    invalid_count = len(predictions) - valid_count
    
    print(f"Valid prices (${500:,.0f} - ${300000:,.0f}): {valid_count}/{len(predictions)} ({valid_count/len(predictions)*100:.1f}%)")
    
    if invalid_count > 0:
        print(f"⚠️ {invalid_count} predictions outside valid range!")
        invalid_prices = predictions[~price_valid]
        print(f"   Invalid prices: min=${invalid_prices.min():,.2f}, max=${invalid_prices.max():,.2f}")
    
    # Sample predictions
    print(f"\n{'='*80}")
    print("SAMPLE PREDICTIONS (20 random cars)")
    print(f"{'='*80}")
    print(f"{'Actual':<15} {'Predicted':<15} {'Error %':<12} {'Status'}")
    print("-" * 80)
    
    sample_20 = np.random.choice(len(predictions), min(20, len(predictions)), replace=False)
    for idx in sample_20:
        actual = actuals[idx]
        pred = predictions[idx]
        error = errors[idx]
        status = "✅" if 500 <= pred <= 300000 else "❌"
        print(f"${actual:>12,.0f}  ${pred:>12,.0f}  {error:>10.1f}%  {status}")
    
    # Generate report
    reports_dir = Path('reports')
    reports_dir.mkdir(exist_ok=True)
    
    report_path = reports_dir / 'quality_report.md'
    with open(report_path, 'w') as f:
        f.write("# Model Quality Report\n\n")
        f.write(f"Generated: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("## Metrics\n\n")
        f.write(f"- **MAE**: ${mae:,.2f}\n")
        f.write(f"- **RMSE**: ${rmse:,.2f}\n")
        f.write(f"- **R²**: {r2:.4f}\n")
        f.write(f"- **MAPE**: {mape:.2f}%\n\n")
        f.write("## Price Sanity\n\n")
        f.write(f"- **Min Price**: ${min_price:,.2f}\n")
        f.write(f"- **Max Price**: ${max_price:,.2f}\n")
        f.write(f"- **Valid Range**: ${500:,.0f} - ${300000:,.0f}\n")
        f.write(f"- **Valid Predictions**: {valid_count}/{len(predictions)} ({valid_count/len(predictions)*100:.1f}%)\n\n")
        f.write("## Sample Predictions\n\n")
        f.write("| Actual | Predicted | Error % | Status |\n")
        f.write("|--------|-----------|---------|--------|\n")
        for idx in sample_20:
            actual = actuals[idx]
            pred = predictions[idx]
            error = errors[idx]
            status = "✅" if 500 <= pred <= 300000 else "❌"
            f.write(f"| ${actual:,.0f} | ${pred:,.0f} | {error:.1f}% | {status} |\n")
    
    print(f"\n✅ Report saved to {report_path}")
    
    # Assertions
    assert min_price >= 500, f"❌ Min price too low: ${min_price:,.2f}"
    assert max_price <= 300000, f"❌ Max price too high: ${max_price:,.2f}"
    assert valid_count / len(predictions) >= 0.95, f"❌ Too many invalid predictions: {invalid_count}/{len(predictions)}"
    
    print(f"\n✅ All quality checks passed!")
    return True

if __name__ == "__main__":
    success = verify_model_quality()
    sys.exit(0 if success else 1)
