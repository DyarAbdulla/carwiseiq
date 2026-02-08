"""
Car Price Dataset - Exploratory Data Analysis and Visualization
Comprehensive EDA with multiple visualizations and statistical summaries
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend (no GUI required)
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import os
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Set style for better-looking plots
try:
    plt.style.use('seaborn-v0_8-darkgrid')
except:
    try:
        plt.style.use('seaborn-darkgrid')
    except:
        plt.style.use('ggplot')
sns.set_palette("husl")

# Setup paths
import sys
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

# Create visualizations directory if it doesn't exist
VISUALIZATIONS_DIR = os.path.join(BASE_DIR, 'visualizations')
os.makedirs(VISUALIZATIONS_DIR, exist_ok=True)

# ============================================================================
# STEP 1: Load Cleaned Dataset
# ============================================================================
print("=" * 80)
print("Loading cleaned car dataset...")
print("=" * 80)

CLEANED_DATA_PATH = os.path.join(BASE_DIR, 'data', 'cleaned_car_data.csv')
if not os.path.exists(CLEANED_DATA_PATH):
    print(f"ERROR: {CLEANED_DATA_PATH} not found!")
    print("Please run data/data_cleaning.py first to generate the cleaned dataset.")
    exit(1)

df = pd.read_csv(CLEANED_DATA_PATH)
print(f"Dataset loaded: {df.shape[0]} rows, {df.shape[1]} columns")
print(f"Columns: {list(df.columns)}")

# ============================================================================
# STEP 2: Data Preparation for Visualization
# ============================================================================
print("\n" + "=" * 80)
print("Preparing data for visualization...")
print("=" * 80)

# Ensure numeric columns are properly typed
numeric_cols = ['price', 'year', 'mileage', 'engine_size', 'cylinders', 'age_of_car']
for col in numeric_cols:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')

# Remove any remaining infinite or extremely large values for visualization
df = df.replace([np.inf, -np.inf], np.nan)
df = df.dropna(subset=['price'])  # Remove rows with missing price

print(f"Data prepared: {df.shape[0]} rows after cleaning")

# ============================================================================
# VISUALIZATION 1: Price Distribution (Histogram with KDE)
# ============================================================================
print("\nGenerating Visualization 1: Price Distribution...")

fig, ax = plt.subplots(figsize=(12, 6))
sns.histplot(df['price'], bins=50, kde=True, ax=ax, color='steelblue', alpha=0.7)
ax.set_title('Car Price Distribution', fontsize=16, fontweight='bold', pad=20)
ax.set_xlabel('Price ($)', fontsize=12)
ax.set_ylabel('Frequency', fontsize=12)
ax.grid(True, alpha=0.3)

# Add statistics text
mean_price = df['price'].mean()
median_price = df['price'].median()
ax.axvline(mean_price, color='red', linestyle='--', linewidth=2, label=f'Mean: ${mean_price:,.0f}')
ax.axvline(median_price, color='green', linestyle='--', linewidth=2, label=f'Median: ${median_price:,.0f}')
ax.legend(fontsize=10)

plt.tight_layout()
plt.savefig(os.path.join(VISUALIZATIONS_DIR, '1_price_distribution.png'), dpi=300, bbox_inches='tight')
plt.close()
print("  [OK] Saved: visualizations/1_price_distribution.png")

# ============================================================================
# VISUALIZATION 2: Price vs Year (Scatter Plot with Trend Line)
# ============================================================================
print("\nGenerating Visualization 2: Price vs Year...")

fig, ax = plt.subplots(figsize=(14, 7))
scatter = ax.scatter(df['year'], df['price'], alpha=0.5, s=20, c=df['year'], 
                     cmap='viridis', edgecolors='black', linewidth=0.1)

# Add trend line
z = np.polyfit(df['year'], df['price'], 1)
p = np.poly1d(z)
ax.plot(df['year'].sort_values(), p(df['year'].sort_values()), 
        "r--", linewidth=3, label=f'Trend: y = {z[0]:.0f}x + {z[1]:.0f}')

ax.set_title('Car Price vs Year with Trend Line', fontsize=16, fontweight='bold', pad=20)
ax.set_xlabel('Year', fontsize=12)
ax.set_ylabel('Price ($)', fontsize=12)
ax.grid(True, alpha=0.3)
ax.legend(fontsize=10)
plt.colorbar(scatter, ax=ax, label='Year')

plt.tight_layout()
plt.savefig(os.path.join(VISUALIZATIONS_DIR, '2_price_vs_year.png'), dpi=300, bbox_inches='tight')
plt.close()
print("  [OK] Saved: visualizations/2_price_vs_year.png")

# ============================================================================
# VISUALIZATION 3: Price by Make (Top 10 Brands - Bar Chart)
# ============================================================================
print("\nGenerating Visualization 3: Price by Make (Top 10)...")

if 'make' in df.columns:
    top_makes = df.groupby('make')['price'].mean().sort_values(ascending=False).head(10)
    
    fig, ax = plt.subplots(figsize=(14, 7))
    bars = ax.barh(range(len(top_makes)), top_makes.values, color=sns.color_palette("husl", len(top_makes)))
    ax.set_yticks(range(len(top_makes)))
    ax.set_yticklabels(top_makes.index, fontsize=10)
    ax.set_xlabel('Average Price ($)', fontsize=12)
    ax.set_title('Average Car Price by Make (Top 10 Brands)', fontsize=16, fontweight='bold', pad=20)
    ax.grid(True, alpha=0.3, axis='x')
    
    # Add value labels on bars
    for i, (idx, val) in enumerate(zip(top_makes.index, top_makes.values)):
        ax.text(val, i, f'${val:,.0f}', va='center', fontsize=9, fontweight='bold')
    
    plt.tight_layout()
    plt.savefig(os.path.join(VISUALIZATIONS_DIR, '3_price_by_make.png'), dpi=300, bbox_inches='tight')
    plt.close()
    print("  [OK] Saved: visualizations/3_price_by_make.png")

# ============================================================================
# VISUALIZATION 4: Price by Fuel Type (Box Plot)
# ============================================================================
print("\nGenerating Visualization 4: Price by Fuel Type...")

if 'fuel_type' in df.columns:
    fig, ax = plt.subplots(figsize=(14, 7))
    fuel_order = df.groupby('fuel_type')['price'].median().sort_values(ascending=False).index
    sns.boxplot(data=df, x='fuel_type', y='price', order=fuel_order, ax=ax, palette='Set2')
    ax.set_title('Car Price Distribution by Fuel Type', fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel('Fuel Type', fontsize=12)
    ax.set_ylabel('Price ($)', fontsize=12)
    ax.tick_params(axis='x', rotation=45)
    ax.grid(True, alpha=0.3, axis='y')
    
    plt.tight_layout()
    plt.savefig(os.path.join(VISUALIZATIONS_DIR, '4_price_by_fuel_type.png'), dpi=300, bbox_inches='tight')
    plt.close()
    print("  [OK] Saved: visualizations/4_price_by_fuel_type.png")

# ============================================================================
# VISUALIZATION 5: Price by Condition (Violin Plot)
# ============================================================================
print("\nGenerating Visualization 5: Price by Condition...")

if 'condition' in df.columns:
    fig, ax = plt.subplots(figsize=(14, 7))
    condition_order = df.groupby('condition')['price'].median().sort_values(ascending=False).index
    sns.violinplot(data=df, x='condition', y='price', order=condition_order, ax=ax, palette='muted')
    ax.set_title('Car Price Distribution by Condition', fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel('Condition', fontsize=12)
    ax.set_ylabel('Price ($)', fontsize=12)
    ax.tick_params(axis='x', rotation=45)
    ax.grid(True, alpha=0.3, axis='y')
    
    plt.tight_layout()
    plt.savefig(os.path.join(VISUALIZATIONS_DIR, '5_price_by_condition.png'), dpi=300, bbox_inches='tight')
    plt.close()
    print("  [OK] Saved: visualizations/5_price_by_condition.png")

# ============================================================================
# VISUALIZATION 6: Mileage vs Price (Scatter with Color by Year)
# ============================================================================
print("\nGenerating Visualization 6: Mileage vs Price...")

if 'mileage' in df.columns and 'year' in df.columns:
    fig, ax = plt.subplots(figsize=(14, 7))
    scatter = ax.scatter(df['mileage'], df['price'], c=df['year'], 
                        cmap='coolwarm', alpha=0.6, s=30, edgecolors='black', linewidth=0.1)
    ax.set_title('Mileage vs Price (Colored by Year)', fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel('Mileage (km)', fontsize=12)
    ax.set_ylabel('Price ($)', fontsize=12)
    ax.grid(True, alpha=0.3)
    cbar = plt.colorbar(scatter, ax=ax)
    cbar.set_label('Year', fontsize=10)
    
    plt.tight_layout()
    plt.savefig(os.path.join(VISUALIZATIONS_DIR, '6_mileage_vs_price.png'), dpi=300, bbox_inches='tight')
    plt.close()
    print("  [OK] Saved: visualizations/6_mileage_vs_price.png")

# ============================================================================
# VISUALIZATION 7: Correlation Heatmap (All Numeric Features)
# ============================================================================
print("\nGenerating Visualization 7: Correlation Heatmap...")

numeric_df = df.select_dtypes(include=[np.number])
# Remove encoded columns if they exist (keep original categorical)
if 'condition_encoded' in numeric_df.columns:
    numeric_df = numeric_df.drop(columns=['condition_encoded', 'fuel_type_encoded', 'location_encoded'], errors='ignore')

correlation_matrix = numeric_df.corr()

fig, ax = plt.subplots(figsize=(12, 10))
mask = np.triu(np.ones_like(correlation_matrix, dtype=bool))  # Mask upper triangle
sns.heatmap(correlation_matrix, mask=mask, annot=True, fmt='.2f', cmap='RdYlBu_r', 
            center=0, square=True, linewidths=1, cbar_kws={"shrink": 0.8}, ax=ax)
ax.set_title('Correlation Heatmap of Numeric Features', fontsize=16, fontweight='bold', pad=20)

plt.tight_layout()
plt.savefig(os.path.join(VISUALIZATIONS_DIR, '7_correlation_heatmap.png'), dpi=300, bbox_inches='tight')
plt.close()
print("  [OK] Saved: visualizations/7_correlation_heatmap.png")

# ============================================================================
# VISUALIZATION 8: Geographic Distribution (Price by Location)
# ============================================================================
print("\nGenerating Visualization 8: Price by Location...")

if 'location' in df.columns:
    location_price = df.groupby('location')['price'].mean().sort_values(ascending=False).head(15)
    
    fig, ax = plt.subplots(figsize=(14, 8))
    bars = ax.barh(range(len(location_price)), location_price.values, 
                   color=sns.color_palette("coolwarm", len(location_price)))
    ax.set_yticks(range(len(location_price)))
    ax.set_yticklabels(location_price.index, fontsize=9)
    ax.set_xlabel('Average Price ($)', fontsize=12)
    ax.set_title('Average Car Price by Location (Top 15)', fontsize=16, fontweight='bold', pad=20)
    ax.grid(True, alpha=0.3, axis='x')
    
    # Add value labels
    for i, (idx, val) in enumerate(zip(location_price.index, location_price.values)):
        ax.text(val, i, f'${val:,.0f}', va='center', fontsize=8, fontweight='bold')
    
    plt.tight_layout()
    plt.savefig(os.path.join(VISUALIZATIONS_DIR, '8_price_by_location.png'), dpi=300, bbox_inches='tight')
    plt.close()
    print("  [OK] Saved: visualizations/8_price_by_location.png")

# ============================================================================
# VISUALIZATION 9: Engine Size vs Price Relationship
# ============================================================================
print("\nGenerating Visualization 9: Engine Size vs Price...")

if 'engine_size' in df.columns:
    # Remove NaN values for engine_size
    engine_df = df[df['engine_size'].notna()].copy()
    
    if len(engine_df) > 0:
        fig, ax = plt.subplots(figsize=(14, 7))
        
        # Create bins for engine size
        try:
            engine_df['engine_size_bin'] = pd.cut(engine_df['engine_size'], bins=min(20, len(engine_df.unique())), precision=1)
            engine_price = engine_df.groupby('engine_size_bin')['price'].mean()
            
            ax.plot(range(len(engine_price)), engine_price.values, marker='o', 
                    linewidth=2, markersize=8, color='steelblue', markerfacecolor='red')
            ax.set_xticks(range(len(engine_price)))
            ax.set_xticklabels([f'{interval.left:.1f}-{interval.right:.1f}L' 
                                for interval in engine_price.index], rotation=45, ha='right', fontsize=9)
            ax.set_title('Average Price by Engine Size', fontsize=16, fontweight='bold', pad=20)
            ax.set_xlabel('Engine Size (Liters)', fontsize=12)
            ax.set_ylabel('Average Price ($)', fontsize=12)
            ax.grid(True, alpha=0.3)
            
            plt.tight_layout()
            plt.savefig(os.path.join(VISUALIZATIONS_DIR, '9_engine_size_vs_price.png'), dpi=300, bbox_inches='tight')
            plt.close()
            print("  [OK] Saved: visualizations/9_engine_size_vs_price.png")
        except Exception as e:
            # Fallback to scatter plot if binning fails
            ax.scatter(engine_df['engine_size'], engine_df['price'], alpha=0.5, s=20)
            ax.set_title('Engine Size vs Price', fontsize=16, fontweight='bold', pad=20)
            ax.set_xlabel('Engine Size (Liters)', fontsize=12)
            ax.set_ylabel('Price ($)', fontsize=12)
            ax.grid(True, alpha=0.3)
            plt.tight_layout()
            plt.savefig(os.path.join(VISUALIZATIONS_DIR, '9_engine_size_vs_price.png'), dpi=300, bbox_inches='tight')
            plt.close()
            print("  [OK] Saved: visualizations/9_engine_size_vs_price.png (scatter plot)")

# ============================================================================
# VISUALIZATION 10: Interactive Dashboard (Plotly)
# ============================================================================
print("\nGenerating Visualization 10: Interactive Dashboard...")

# Create subplots for interactive dashboard
fig = make_subplots(
    rows=2, cols=2,
    subplot_titles=('Price Distribution', 'Price vs Year', 
                   'Price by Fuel Type', 'Mileage vs Price'),
    specs=[[{"type": "histogram"}, {"type": "scatter"}],
           [{"type": "box"}, {"type": "scatter"}]]
)

# 1. Price Distribution
fig.add_trace(
    go.Histogram(x=df['price'], nbinsx=50, name='Price Distribution',
                 marker_color='steelblue', opacity=0.7),
    row=1, col=1
)

# 2. Price vs Year
fig.add_trace(
    go.Scatter(x=df['year'], y=df['price'], mode='markers',
               marker=dict(size=4, color=df['year'], colorscale='viridis', 
                          showscale=True, colorbar=dict(x=1.15, title="Year")),
               name='Price vs Year', opacity=0.6),
    row=1, col=2
)

# 3. Price by Fuel Type
if 'fuel_type' in df.columns:
    fuel_types = df['fuel_type'].dropna().unique()[:10]  # Limit to top 10 for readability
    for fuel in fuel_types:
        fuel_data = df[df['fuel_type'] == fuel]['price'].dropna()
        if len(fuel_data) > 0:
            fig.add_trace(
                go.Box(y=fuel_data, name=str(fuel), boxmean='sd'),
                row=2, col=1
            )

# 4. Mileage vs Price
if 'mileage' in df.columns:
    fig.add_trace(
        go.Scatter(x=df['mileage'], y=df['price'], mode='markers',
                   marker=dict(size=4, color=df['year'], colorscale='RdBu',
                              showscale=True, colorbar=dict(x=1.15, title="Year")),
                   name='Mileage vs Price', opacity=0.6),
        row=2, col=2
    )

# Update layout
fig.update_layout(
    title_text="Interactive Car Price Analysis Dashboard",
    title_x=0.5,
    height=900,
    showlegend=False
)

# Update axes labels
fig.update_xaxes(title_text="Price ($)", row=1, col=1)
fig.update_xaxes(title_text="Year", row=1, col=2)
fig.update_xaxes(title_text="Fuel Type", row=2, col=1)
fig.update_xaxes(title_text="Mileage (km)", row=2, col=2)

fig.update_yaxes(title_text="Frequency", row=1, col=1)
fig.update_yaxes(title_text="Price ($)", row=1, col=2)
fig.update_yaxes(title_text="Price ($)", row=2, col=1)
fig.update_yaxes(title_text="Price ($)", row=2, col=2)

# Save interactive dashboard
fig.write_html(os.path.join(VISUALIZATIONS_DIR, '10_interactive_dashboard.html'))
print("  [OK] Saved: visualizations/10_interactive_dashboard.html")

# ============================================================================
# STEP 3: Generate Statistical Summary Report
# ============================================================================
print("\n" + "=" * 80)
print("Generating Statistical Summary Report...")
print("=" * 80)

report = []
report.append("=" * 80)
report.append("CAR PRICE DATASET - STATISTICAL SUMMARY REPORT")
report.append("=" * 80)
report.append(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
report.append("")

# Dataset Overview
report.append("DATASET OVERVIEW")
report.append("-" * 80)
report.append(f"Total Records: {len(df):,}")
report.append(f"Total Features: {len(df.columns)}")
report.append(f"Date Range: {df['year'].min() if 'year' in df.columns else 'N/A'} - {df['year'].max() if 'year' in df.columns else 'N/A'}")
report.append("")

# Price Statistics
report.append("PRICE STATISTICS")
report.append("-" * 80)
report.append(f"Mean Price: ${df['price'].mean():,.2f}")
report.append(f"Median Price: ${df['price'].median():,.2f}")
report.append(f"Standard Deviation: ${df['price'].std():,.2f}")
report.append(f"Minimum Price: ${df['price'].min():,.2f}")
report.append(f"Maximum Price: ${df['price'].max():,.2f}")
report.append(f"25th Percentile: ${df['price'].quantile(0.25):,.2f}")
report.append(f"75th Percentile: ${df['price'].quantile(0.75):,.2f}")
report.append("")

# Year Statistics
if 'year' in df.columns:
    report.append("YEAR STATISTICS")
    report.append("-" * 80)
    report.append(f"Mean Year: {df['year'].mean():.1f}")
    report.append(f"Median Year: {df['year'].median():.0f}")
    report.append(f"Year Range: {df['year'].min()} - {df['year'].max()}")
    report.append("")

# Mileage Statistics
if 'mileage' in df.columns:
    report.append("MILEAGE STATISTICS")
    report.append("-" * 80)
    report.append(f"Mean Mileage: {df['mileage'].mean():,.0f} km")
    report.append(f"Median Mileage: {df['mileage'].median():,.0f} km")
    report.append(f"Minimum Mileage: {df['mileage'].min():,.0f} km")
    report.append(f"Maximum Mileage: {df['mileage'].max():,.0f} km")
    report.append("")

# Categorical Distributions
if 'make' in df.columns:
    report.append("TOP 10 CAR MAKES")
    report.append("-" * 80)
    top_makes = df['make'].value_counts().head(10)
    for i, (make, count) in enumerate(top_makes.items(), 1):
        report.append(f"{i}. {make}: {count:,} ({count/len(df)*100:.2f}%)")
    report.append("")

if 'fuel_type' in df.columns:
    report.append("FUEL TYPE DISTRIBUTION")
    report.append("-" * 80)
    fuel_dist = df['fuel_type'].value_counts()
    for fuel, count in fuel_dist.items():
        report.append(f"{fuel}: {count:,} ({count/len(df)*100:.2f}%)")
    report.append("")

if 'condition' in df.columns:
    report.append("CONDITION DISTRIBUTION")
    report.append("-" * 80)
    condition_dist = df['condition'].value_counts()
    for condition, count in condition_dist.items():
        report.append(f"{condition}: {count:,} ({count/len(df)*100:.2f}%)")
    report.append("")

# Correlation Insights
report.append("KEY CORRELATIONS")
report.append("-" * 80)
if 'year' in df.columns:
    corr_year = df['price'].corr(df['year'])
    report.append(f"Price vs Year: {corr_year:.3f}")
if 'mileage' in df.columns:
    corr_mileage = df['price'].corr(df['mileage'])
    report.append(f"Price vs Mileage: {corr_mileage:.3f}")
if 'engine_size' in df.columns:
    corr_engine = df['price'].corr(df['engine_size'])
    report.append(f"Price vs Engine Size: {corr_engine:.3f}")
if 'age_of_car' in df.columns:
    corr_age = df['price'].corr(df['age_of_car'])
    report.append(f"Price vs Age of Car: {corr_age:.3f}")
report.append("")

# Price by Category
if 'make' in df.columns:
    report.append("AVERAGE PRICE BY TOP 5 MAKES")
    report.append("-" * 80)
    top_makes_price = df.groupby('make')['price'].mean().sort_values(ascending=False).head(5)
    for make, price in top_makes_price.items():
        report.append(f"{make}: ${price:,.2f}")
    report.append("")

if 'location' in df.columns:
    report.append("AVERAGE PRICE BY TOP 5 LOCATIONS")
    report.append("-" * 80)
    top_locations_price = df.groupby('location')['price'].mean().sort_values(ascending=False).head(5)
    for location, price in top_locations_price.items():
        report.append(f"{location}: ${price:,.2f}")
    report.append("")

report.append("=" * 80)
report.append("END OF REPORT")
report.append("=" * 80)

# Save report
report_text = "\n".join(report)
print(report_text)

with open(os.path.join(VISUALIZATIONS_DIR, 'statistical_summary_report.txt'), 'w', encoding='utf-8') as f:
    f.write(report_text)

print(f"\n[OK] Statistical summary report saved to: visualizations/statistical_summary_report.txt")

# ============================================================================
# ADVANCED INTERACTIVE VISUALIZATIONS
# ============================================================================
print("\n" + "=" * 80)
print("Generating Advanced Interactive Visualizations...")
print("=" * 80)

# Professional color palette
PROFESSIONAL_COLORS = {
    'primary': '#667eea',
    'secondary': '#764ba2',
    'accent': '#f093fb',
    'success': '#10b981',
    'warning': '#f59e0b',
    'error': '#ef4444',
    'info': '#3b82f6'
}

COLOR_SCHEME = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b', '#fa709a']

# ============================================================================
# VISUALIZATION 11: 3D Scatter Plot (Year vs Mileage vs Price)
# ============================================================================
print("\nGenerating Visualization 11: 3D Scatter Plot...")

if all(col in df.columns for col in ['year', 'mileage', 'price']):
    # Sample data for performance (if dataset is too large)
    sample_size = min(5000, len(df))
    df_sample = df.sample(n=sample_size, random_state=42) if len(df) > sample_size else df
    
    fig_3d = go.Figure(data=[go.Scatter3d(
        x=df_sample['year'],
        y=df_sample['mileage'],
        z=df_sample['price'],
        mode='markers',
        marker=dict(
            size=4,
            color=df_sample['price'],
            colorscale='Viridis',
            showscale=True,
            colorbar=dict(title="Price ($)", x=1.15),
            line=dict(width=0.5, color='rgba(0,0,0,0.1)')
        ),
        text=[f"Year: {y}<br>Mileage: {m:,.0f} km<br>Price: ${p:,.2f}" 
              for y, m, p in zip(df_sample['year'], df_sample['mileage'], df_sample['price'])],
        hovertemplate='<b>Car Details</b><br>%{text}<extra></extra>'
    )])
    
    fig_3d.update_layout(
        title=dict(
            text='3D Scatter: Year vs Mileage vs Price',
            x=0.5,
            font=dict(size=20, color='#333')
        ),
        scene=dict(
            xaxis=dict(title='Year', backgroundcolor='rgba(255,255,255,0.9)'),
            yaxis=dict(title='Mileage (km)', backgroundcolor='rgba(255,255,255,0.9)'),
            zaxis=dict(title='Price ($)', backgroundcolor='rgba(255,255,255,0.9)'),
            bgcolor='rgba(240,240,240,0.5)'
        ),
        width=1000,
        height=800,
        template='plotly_white',
        font=dict(family="Inter, sans-serif", size=12)
    )
    
    fig_3d.write_html(os.path.join(VISUALIZATIONS_DIR, '11_3d_scatter.html'))
    print("  [OK] Saved: visualizations/11_3d_scatter.html")

# ============================================================================
# VISUALIZATION 12: Animated Price Trends Over Decades
# ============================================================================
print("\nGenerating Visualization 12: Animated Price Trends...")

if 'year' in df.columns and 'price' in df.columns:
    # Create decade bins
    df['decade'] = (df['year'] // 10) * 10
    decade_avg = df.groupby('decade')['price'].mean().reset_index()
    decade_count = df.groupby('decade').size().reset_index(name='count')
    decade_data = pd.merge(decade_avg, decade_count, on='decade')
    
    fig_animated = px.bar(
        decade_data,
        x='decade',
        y='price',
        animation_frame='decade',
        animation_group='decade',
        title='Average Car Price by Decade (Animated)',
        labels={'price': 'Average Price ($)', 'decade': 'Decade'},
        color='price',
        color_continuous_scale='Viridis',
        text='price'
    )
    
    fig_animated.update_traces(
        texttemplate='$%{text:,.0f}',
        textposition='outside',
        marker_line_color='rgba(0,0,0,0.2)',
        marker_line_width=1
    )
    
    fig_animated.update_layout(
        height=600,
        template='plotly_white',
        font=dict(family="Inter, sans-serif", size=12),
        xaxis=dict(title='Decade', tickmode='linear'),
        yaxis=dict(title='Average Price ($)'),
        coloraxis_colorbar=dict(title="Price ($)")
    )
    
    # Also create a line chart version
    fig_line_animated = px.line(
        decade_data,
        x='decade',
        y='price',
        markers=True,
        title='Price Trend Over Decades',
        labels={'price': 'Average Price ($)', 'decade': 'Decade'},
        color_discrete_sequence=[PROFESSIONAL_COLORS['primary']]
    )
    
    fig_line_animated.update_traces(
        line=dict(width=3),
        marker=dict(size=10)
    )
    
    fig_line_animated.update_layout(
        height=500,
        template='plotly_white',
        font=dict(family="Inter, sans-serif", size=12),
        hovermode='x unified'
    )
    
    fig_animated.write_html(os.path.join(VISUALIZATIONS_DIR, '12_animated_decades.html'))
    fig_line_animated.write_html(os.path.join(VISUALIZATIONS_DIR, '12_animated_trends.html'))
    print("  [OK] Saved: visualizations/12_animated_decades.html")
    print("  [OK] Saved: visualizations/12_animated_trends.html")

# ============================================================================
# VISUALIZATION 13: Geographic Heat Map by Location
# ============================================================================
print("\nGenerating Visualization 13: Geographic Heat Map...")

if 'location' in df.columns:
    location_stats = df.groupby('location').agg({
        'price': ['mean', 'count', 'median'],
        'year': 'mean'
    }).reset_index()
    location_stats.columns = ['location', 'avg_price', 'count', 'median_price', 'avg_year']
    location_stats = location_stats.sort_values('avg_price', ascending=False)
    
    # Create heatmap-style bar chart
    fig_heatmap = go.Figure(data=go.Bar(
        x=location_stats['location'].head(20),
        y=location_stats['avg_price'],
        marker=dict(
            color=location_stats['avg_price'],
            colorscale='Viridis',
            showscale=True,
            colorbar=dict(title="Avg Price ($)", x=1.15),
            line=dict(color='rgba(0,0,0,0.2)', width=1)
        ),
        text=[f"${p:,.0f}<br>Count: {c}" for p, c in zip(location_stats['avg_price'], location_stats['count'])],
        textposition='outside',
        hovertemplate='<b>%{x}</b><br>Average Price: $%{y:,.2f}<br>Total Cars: %{customdata}<extra></extra>',
        customdata=location_stats['count']
    ))
    
    fig_heatmap.update_layout(
        title=dict(
            text='Geographic Price Heat Map (Top 20 Locations)',
            x=0.5,
            font=dict(size=20, color='#333')
        ),
        xaxis=dict(title='Location', tickangle=-45),
        yaxis=dict(title='Average Price ($)'),
        height=600,
        template='plotly_white',
        font=dict(family="Inter, sans-serif", size=12),
        hovermode='closest'
    )
    
    fig_heatmap.write_html(os.path.join(VISUALIZATIONS_DIR, '13_geographic_heatmap.html'))
    print("  [OK] Saved: visualizations/13_geographic_heatmap.html")

# ============================================================================
# VISUALIZATION 14: Feature Importance Waterfall Chart
# ============================================================================
print("\nGenerating Visualization 14: Feature Importance Waterfall...")

# Calculate feature importance based on correlations
numeric_df = df.select_dtypes(include=[np.number])
if 'price' in numeric_df.columns:
    correlations = numeric_df.corr()['price'].abs().sort_values(ascending=False)
    correlations = correlations[correlations.index != 'price'].head(10)
    
    # Create waterfall chart
    fig_waterfall = go.Figure(go.Waterfall(
        orientation="v",
        measure=["relative"] * len(correlations),
        x=correlations.index,
        textposition="outside",
        text=[f"{v:.3f}" for v in correlations.values],
        y=correlations.values,
        connector={"line": {"color": "rgb(63, 63, 63)"}},
        increasing={"marker": {"color": PROFESSIONAL_COLORS['primary']}},
        decreasing={"marker": {"color": PROFESSIONAL_COLORS['secondary']}},
        totals={"marker": {"color": PROFESSIONAL_COLORS['accent']}}
    ))
    
    fig_waterfall.update_layout(
        title=dict(
            text='Feature Importance (Correlation with Price)',
            x=0.5,
            font=dict(size=20, color='#333')
        ),
        xaxis=dict(title='Feature'),
        yaxis=dict(title='Absolute Correlation'),
        height=600,
        template='plotly_white',
        font=dict(family="Inter, sans-serif", size=12),
        showlegend=False
    )
    
    fig_waterfall.write_html(os.path.join(VISUALIZATIONS_DIR, '14_feature_importance_waterfall.html'))
    print("  [OK] Saved: visualizations/14_feature_importance_waterfall.html")

# ============================================================================
# VISUALIZATION 15: Prediction Accuracy Gauge Chart
# ============================================================================
print("\nGenerating Visualization 15: Prediction Accuracy Gauge...")

# Model accuracy metrics (from model training)
r2_score = 0.9996  # From model training
mape = 0.74  # Approximate from model

# Create gauge chart for R² Score
fig_gauge_r2 = go.Figure(go.Indicator(
    mode="gauge+number+delta",
    value=r2_score * 100,
    domain={'x': [0, 1], 'y': [0, 1]},
    title={'text': "R² Score (%)"},
    delta={'reference': 90, 'position': "top"},
    gauge={
        'axis': {'range': [None, 100]},
        'bar': {'color': PROFESSIONAL_COLORS['primary']},
        'steps': [
            {'range': [0, 70], 'color': "lightgray"},
            {'range': [70, 90], 'color': "gray"},
            {'range': [90, 100], 'color': PROFESSIONAL_COLORS['success']}
        ],
        'threshold': {
            'line': {'color': "red", 'width': 4},
            'thickness': 0.75,
            'value': 90
        }
    }
))

fig_gauge_r2.update_layout(
    title=dict(
        text='Model Accuracy: R² Score',
        x=0.5,
        font=dict(size=20, color='#333')
    ),
    height=400,
    template='plotly_white',
    font=dict(family="Inter, sans-serif", size=12)
)

# Create gauge for MAPE (lower is better)
fig_gauge_mape = go.Figure(go.Indicator(
    mode="gauge+number",
    value=mape,
    domain={'x': [0, 1], 'y': [0, 1]},
    title={'text': "MAPE (%)"},
    gauge={
        'axis': {'range': [None, 20]},
        'bar': {'color': PROFESSIONAL_COLORS['success']},
        'steps': [
            {'range': [0, 5], 'color': PROFESSIONAL_COLORS['success']},
            {'range': [5, 10], 'color': PROFESSIONAL_COLORS['warning']},
            {'range': [10, 20], 'color': PROFESSIONAL_COLORS['error']}
        ],
        'threshold': {
            'line': {'color': "red", 'width': 4},
            'thickness': 0.75,
            'value': 10
        }
    }
))

fig_gauge_mape.update_layout(
    title=dict(
        text='Model Accuracy: MAPE',
        x=0.5,
        font=dict(size=20, color='#333')
    ),
    height=400,
    template='plotly_white',
    font=dict(family="Inter, sans-serif", size=12)
)

fig_gauge_r2.write_html(os.path.join(VISUALIZATIONS_DIR, '15_gauge_r2.html'))
fig_gauge_mape.write_html(os.path.join(VISUALIZATIONS_DIR, '15_gauge_mape.html'))
print("  [OK] Saved: visualizations/15_gauge_r2.html")
print("  [OK] Saved: visualizations/15_gauge_mape.html")

# ============================================================================
# Summary
# ============================================================================
print("\n" + "=" * 80)
print("VISUALIZATION COMPLETE!")
print("=" * 80)
print(f"\nAll visualizations saved to 'visualizations/' folder:")
print("  1. Price Distribution (Histogram)")
print("  2. Price vs Year (Scatter)")
print("  3. Price by Make (Bar Chart)")
print("  4. Price by Fuel Type (Box Plot)")
print("  5. Price by Condition (Violin Plot)")
print("  6. Mileage vs Price (Scatter)")
print("  7. Correlation Heatmap")
print("  8. Price by Location (Bar Chart)")
print("  9. Engine Size vs Price")
print("  10. Interactive Dashboard (HTML)")
print("  11. 3D Scatter Plot (Year vs Mileage vs Price) - INTERACTIVE")
print("  12. Animated Price Trends Over Decades - ANIMATED")
print("  13. Geographic Heat Map by Location - INTERACTIVE")
print("  14. Feature Importance Waterfall Chart - INTERACTIVE")
print("  15. Prediction Accuracy Gauge Charts - INTERACTIVE")
print("\nStatistical Summary Report generated!")
print("=" * 80)

