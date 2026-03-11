# Audi Kurdistan Supplementary Data

This document describes how Audi Kurdistan price data is integrated to improve predictions for Audi vehicles in the Kurdistan market.

## Data Location

- **Audi CSV**: `backend/data/audi_kurdistan_prices.csv`
- **Columns**: make, model, trim, year, mileage_km, condition, fuel_type, transmission, engine_size, price_usd

## Column Mapping to Main Dataset

| Audi Column   | Main Dataset Column |
|---------------|---------------------|
| make          | make                |
| model         | model               |
| trim          | trim                |
| year          | year                |
| mileage_km    | mileage             |
| condition     | condition (Used→Good, New→New) |
| fuel_type     | fuel_type           |
| engine_size   | engine_size         |
| price_usd     | price               |
| (derived)     | location = "Kurdistan" |
| (derived)     | cylinders (from engine_size) |

## Integration

### 1. Dataset Loader (Runtime)

The `DatasetLoader` in `app/services/dataset_loader.py` automatically merges Audi data when loading the main dataset. Predictions and dataset-based fallbacks include Audi prices without requiring a separate merge step.

### 2. Merge Script (Training)

To retrain the model with Audi data included:

```bash
# Merge Audi data into main dataset (creates backup of original)
python backend/scripts/merge_audi_dataset.py

# Retrain the model
python model_training.py
```

Or use explicit paths:

```bash
python backend/scripts/merge_audi_dataset.py --main-data cleaned_car_data.csv --output data/merged_car_data.csv
python model_training.py --data-file data/merged_car_data.csv
```

### 3. Restore Original (if needed)

If you need to restore the main dataset before merge:

```bash
copy cleaned_car_data.csv.bak cleaned_car_data.csv
```

## Adding More Supplementary Data

To add more Audi or other brand data:

1. Create a CSV with columns matching the Audi format (or map to it)
2. Place it in `backend/data/` or update the merge script to include it
3. Run the merge script and retrain
