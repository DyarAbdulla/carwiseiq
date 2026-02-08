"""
Generate image_metadata.csv mapping car images to car data from cleaned_car_data.csv
Maps car_000000.jpg to car_057311.jpg to corresponding car records
"""

import pandas as pd
import os
from pathlib import Path

def normalize_string(s):
    """Normalize string for matching"""
    if pd.isna(s):
        return ''
    return str(s).strip().lower()

def generate_image_metadata():
    """Generate image metadata CSV mapping images to car data"""

    # Read car data
    print("Reading cleaned_car_data.csv...")
    df = pd.read_csv('cleaned_car_data.csv')
    print(f"Loaded {len(df)} car records")

    # Check car_images folder
    car_images_dir = Path('car_images')
    if not car_images_dir.exists():
        print(f"ERROR: car_images folder not found at {car_images_dir.absolute()}")
        return

    # Get all image files
    image_files = sorted([f for f in os.listdir(car_images_dir) if f.endswith('.jpg')])
    print(f"Found {len(image_files)} image files")

    # Create metadata list
    metadata = []

    # Strategy: Map images to cars by index
    # car_000000.jpg -> row 0, car_000001.jpg -> row 1, etc.
    # If we have more images than cars, wrap around
    # If we have more cars than images, use modulo

    max_images = len(image_files)
    max_cars = len(df)

    print(f"Mapping {max_images} images to {max_cars} car records...")

    for idx, image_file in enumerate(image_files):
        # Map image index to car index (wrap around if needed)
        car_idx = idx % max_cars
        car_row = df.iloc[car_idx]

        # Extract car details
        make = normalize_string(car_row.get('make', ''))
        model = normalize_string(car_row.get('model', ''))
        year = int(car_row.get('year', 0)) if pd.notna(car_row.get('year')) else 0
        trim = normalize_string(car_row.get('trim', ''))
        condition = normalize_string(car_row.get('condition', ''))

        # Create metadata entry
        metadata.append({
            'filename': image_file,
            'image_index': idx,
            'car_index': car_idx,
            'make': make,
            'model': model,
            'year': year,
            'trim': trim,
            'condition': condition,
            'full_path': f'/car_images/{image_file}',
            'relative_path': f'car_images/{image_file}'
        })

    # Create DataFrame
    metadata_df = pd.DataFrame(metadata)

    # Save to CSV
    output_file = 'image_metadata.csv'
    metadata_df.to_csv(output_file, index=False)
    print(f"\n[SUCCESS] Generated {output_file} with {len(metadata_df)} entries")

    # Print statistics
    print("\n[STATISTICS]")
    print(f"  Total images mapped: {len(metadata_df)}")
    print(f"  Unique makes: {metadata_df['make'].nunique()}")
    print(f"  Unique models: {metadata_df['model'].nunique()}")
    print(f"  Year range: {int(metadata_df['year'].min())} - {int(metadata_df['year'].max())}")

    # Show sample entries
    print("\n[SAMPLE ENTRIES]")
    print(metadata_df.head(10).to_string())

    # Show distribution by make
    print("\n[TOP 10 MAKES BY IMAGE COUNT]")
    make_counts = metadata_df['make'].value_counts().head(10)
    for make, count in make_counts.items():
        print(f"  {make}: {count} images")

    return metadata_df

if __name__ == '__main__':
    try:
        metadata_df = generate_image_metadata()
        print("\n[SUCCESS] Image metadata generation complete!")
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
