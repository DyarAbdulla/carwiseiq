import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
import json

# Load features and metadata
features = np.load('data/image_features_optimized.npy')
df = pd.read_csv('data/final_dataset_with_images.csv')

# Load metadata to get valid car IDs
with open('cache/image_features_metadata.json', 'r') as f:
    metadata = json.load(f)
    valid_car_ids = metadata['car_ids']

# Filter dataframe to only cars with features
df_valid = df[df.index.isin(valid_car_ids)].reset_index(drop=True)

print(f'Loaded {len(features)} car features')
print(f'Dataset has {len(df_valid)} cars with features')

# Function to get recommendations
def get_recommendations(car_id, top_n=10):
    # Find car index
    idx = df_valid[df_valid['id'] == car_id].index[0]
    
    # Calculate similarity with all cars
    car_features = features[idx].reshape(1, -1)
    similarities = cosine_similarity(car_features, features)[0]
    
    # Get top N similar cars (excluding itself)
    similar_indices = similarities.argsort()[::-1][1:top_n+1]
    
    # Return recommendations
    recommendations = df_valid.iloc[similar_indices][['id', 'make', 'model', 'year', 'price']]
    recommendations['similarity'] = similarities[similar_indices]
    
    return recommendations

# Test with a random car
test_car_id = df_valid.iloc[0]['id']
test_car = df_valid[df_valid['id'] == test_car_id].iloc[0]

print(f'\nTest car: {test_car["year"]} {test_car["make"]} {test_car["model"]}')
print(f'Price: \\n')

print('Top 10 visually similar cars:')
recs = get_recommendations(test_car_id, top_n=10)
print(recs.to_string(index=False))
