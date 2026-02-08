"""
Batch Prediction Script - Predict prices for multiple cars from CSV
"""

import pandas as pd
from predict_manual import predict_price, load_model_components
import sys

def predict_from_csv(csv_file, output_file='predictions.csv'):
    """
    Predict prices for cars in CSV file

    CSV should have columns:
    - year, mileage, engine_size, cylinders, make, model, condition, fuel_type
    - image_path (optional)
    """
    print(f"Loading CSV: {csv_file}")
    df = pd.read_csv(csv_file)

    print(f"Found {len(df)} cars")

    # Load model once (for efficiency)
    print("\nLoading model...")
    ensemble_model, encoders, scaler, feature_info, cnn_model, preprocess_func = load_model_components()

    predictions = []

    for idx, row in df.iterrows():
        try:
            car_data = {
                'year': int(row['year']),
                'mileage': float(row['mileage']),
                'engine_size': float(row['engine_size']),
                'cylinders': int(row['cylinders']),
                'make': str(row['make']),
                'model': str(row['model']),
                'condition': str(row['condition']),
                'fuel_type': str(row['fuel_type'])
            }

            image_path = row.get('image_path', None)
            if pd.isna(image_path):
                image_path = None

            # Import prediction function components
            from predict_manual import create_tabular_features, extract_image_features
            import numpy as np

            # Create features
            tabular_features = create_tabular_features(car_data, encoders)

            if image_path:
                image_features = extract_image_features(image_path, cnn_model, preprocess_func)
            else:
                image_features = np.zeros(2048)

            # Combine and scale
            combined_features = np.hstack([tabular_features, image_features])
            combined_features_scaled = scaler.transform([combined_features])

            # Predict
            price = ensemble_model.predict(combined_features_scaled)[0]
            price = max(0, price)

            predictions.append({
                'make': car_data['make'],
                'model': car_data['model'],
                'year': car_data['year'],
                'predicted_price': price
            })

            print(f"  [{idx+1}/{len(df)}] {car_data['make']} {car_data['model']} ({car_data['year']}): ${price:,.2f}")

        except Exception as e:
            print(f"  [{idx+1}/{len(df)}] Error: {e}")
            predictions.append({
                'make': row.get('make', 'Unknown'),
                'model': row.get('model', 'Unknown'),
                'year': row.get('year', 'Unknown'),
                'predicted_price': None,
                'error': str(e)
            })

    # Save results
    results_df = pd.DataFrame(predictions)
    results_df.to_csv(output_file, index=False)
    print(f"\n✓ Saved predictions to {output_file}")

    return results_df

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python predict_batch.py <input.csv> [output.csv]")
        print("\nExample:")
        print("  python predict_batch.py cars.csv predictions.csv")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'predictions.csv'

    predict_from_csv(input_file, output_file)
