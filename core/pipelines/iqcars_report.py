"""
IQCars Visualization Report Generator
Creates plots and markdown report for cleaned dataset
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

# Set style
sns.set_style("whitegrid")
plt.rcParams['figure.figsize'] = (12, 6)
plt.rcParams['font.size'] = 10


def generate_plots(df, output_dir='reports/plots'):
    """
    Generate visualization plots
    
    Parameters:
    -----------
    df : pd.DataFrame
        Cleaned dataset
    output_dir : str or Path
        Output directory for plots
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("Generating visualizations...")
    
    # 1. Price distribution (raw vs cleaned)
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    
    axes[0].hist(df['price'], bins=50, edgecolor='black', alpha=0.7)
    axes[0].set_xlabel('Price (USD)')
    axes[0].set_ylabel('Frequency')
    axes[0].set_title('Price Distribution')
    axes[0].grid(True, alpha=0.3)
    
    # Log scale for better visualization
    axes[1].hist(np.log1p(df['price']), bins=50, edgecolor='black', alpha=0.7, color='green')
    axes[1].set_xlabel('Log(Price + 1)')
    axes[1].set_ylabel('Frequency')
    axes[1].set_title('Price Distribution (Log Scale)')
    axes[1].grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(output_dir / '1_price_distribution.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("  ✓ Price distribution")
    
    # 2. Price vs Year scatter
    fig, ax = plt.subplots(figsize=(12, 6))
    scatter = ax.scatter(df['year'], df['price'], alpha=0.5, s=20)
    ax.set_xlabel('Year')
    ax.set_ylabel('Price (USD)')
    ax.set_title('Price vs Year')
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_dir / '2_price_vs_year.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("  ✓ Price vs Year")
    
    # 3. Price vs Mileage scatter
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.scatter(df['mileage'], df['price'], alpha=0.5, s=20)
    ax.set_xlabel('Mileage (km)')
    ax.set_ylabel('Price (USD)')
    ax.set_title('Price vs Mileage')
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_dir / '3_price_vs_mileage.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("  ✓ Price vs Mileage")
    
    # 4. Boxplot price by top 10 makes
    top_makes = df['make'].value_counts().head(10).index
    df_top = df[df['make'].isin(top_makes)]
    
    fig, ax = plt.subplots(figsize=(14, 6))
    df_top.boxplot(column='price', by='make', ax=ax, rot=45)
    ax.set_xlabel('Make')
    ax.set_ylabel('Price (USD)')
    ax.set_title('Price Distribution by Top 10 Makes')
    plt.suptitle('')  # Remove default title
    plt.tight_layout()
    plt.savefig(output_dir / '4_price_by_make.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("  ✓ Price by Make")
    
    # 5. Correlation heatmap (if numeric columns exist)
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) > 1:
        fig, ax = plt.subplots(figsize=(10, 8))
        corr = df[numeric_cols].corr()
        sns.heatmap(corr, annot=True, fmt='.2f', cmap='coolwarm', center=0, ax=ax)
        ax.set_title('Feature Correlation Matrix')
        plt.tight_layout()
        plt.savefig(output_dir / '5_correlation_heatmap.png', dpi=150, bbox_inches='tight')
        plt.close()
        print("  ✓ Correlation heatmap")
    
    print(f"\nAll plots saved to {output_dir}")


def generate_markdown_report(df, output_path='reports/data_report.md'):
    """
    Generate markdown report
    
    Parameters:
    -----------
    df : pd.DataFrame
        Cleaned dataset
    output_path : str or Path
        Output path for markdown report
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    report = []
    report.append("# IQCars Dataset Report\n")
    report.append(f"Generated: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
    
    report.append("## Dataset Overview\n\n")
    report.append(f"- **Total Rows**: {len(df):,}\n")
    report.append(f"- **Total Columns**: {len(df.columns)}\n")
    report.append(f"- **Missing Values**: {df.isnull().sum().sum()}\n\n")
    
    report.append("## Price Statistics\n\n")
    report.append(f"- **Min Price**: ${df['price'].min():,.2f}\n")
    report.append(f"- **Max Price**: ${df['price'].max():,.2f}\n")
    report.append(f"- **Mean Price**: ${df['price'].mean():,.2f}\n")
    report.append(f"- **Median Price**: ${df['price'].median():,.2f}\n")
    report.append(f"- **Std Price**: ${df['price'].std():,.2f}\n\n")
    
    report.append("## Year Statistics\n\n")
    report.append(f"- **Min Year**: {int(df['year'].min())}\n")
    report.append(f"- **Max Year**: {int(df['year'].max())}\n")
    report.append(f"- **Mean Year**: {df['year'].mean():.1f}\n\n")
    
    report.append("## Mileage Statistics\n\n")
    report.append(f"- **Min Mileage**: {int(df['mileage'].min()):,} km\n")
    report.append(f"- **Max Mileage**: {int(df['mileage'].max()):,} km\n")
    report.append(f"- **Mean Mileage**: {df['mileage'].mean():,.0f} km\n")
    report.append(f"- **Median Mileage**: {df['mileage'].median():,.0f} km\n\n")
    
    report.append("## Top 10 Makes\n\n")
    top_makes = df['make'].value_counts().head(10)
    for make, count in top_makes.items():
        report.append(f"- **{make}**: {count:,} cars\n")
    report.append("\n")
    
    report.append("## Top 10 Models\n\n")
    top_models = df['model'].value_counts().head(10)
    for model, count in top_models.items():
        report.append(f"- **{model}**: {count:,} cars\n")
    report.append("\n")
    
    if 'condition' in df.columns:
        report.append("## Condition Distribution\n\n")
        condition_counts = df['condition'].value_counts()
        for condition, count in condition_counts.items():
            report.append(f"- **{condition}**: {count:,} cars\n")
        report.append("\n")
    
    if 'fuel_type' in df.columns:
        report.append("## Fuel Type Distribution\n\n")
        fuel_counts = df['fuel_type'].value_counts()
        for fuel, count in fuel_counts.items():
            report.append(f"- **{fuel}**: {count:,} cars\n")
        report.append("\n")
    
    report.append("## Visualizations\n\n")
    report.append("The following plots are available in `reports/plots/`:\n\n")
    report.append("1. `1_price_distribution.png` - Price distribution (linear and log scale)\n")
    report.append("2. `2_price_vs_year.png` - Price vs Year scatter plot\n")
    report.append("3. `3_price_vs_mileage.png` - Price vs Mileage scatter plot\n")
    report.append("4. `4_price_by_make.png` - Boxplot of prices by top 10 makes\n")
    report.append("5. `5_correlation_heatmap.png` - Correlation matrix of numeric features\n\n")
    
    report.append("## Data Quality\n\n")
    report.append("### Missing Values by Column\n\n")
    missing = df.isnull().sum()
    missing = missing[missing > 0]
    if len(missing) > 0:
        for col, count in missing.items():
            pct = (count / len(df)) * 100
            report.append(f"- **{col}**: {count:,} ({pct:.1f}%)\n")
    else:
        report.append("No missing values in critical columns.\n")
    report.append("\n")
    
    # Write report
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(''.join(report))
    
    print(f"Report saved to {output_path}")


def generate_report(df, output_dir='reports'):
    """
    Generate complete report with plots and markdown
    
    Parameters:
    -----------
    df : pd.DataFrame
        Cleaned dataset
    output_dir : str or Path
        Output directory
    """
    output_dir = Path(output_dir)
    
    print("=" * 80)
    print("GENERATING DATA REPORT")
    print("=" * 80)
    
    generate_plots(df, output_dir / 'plots')
    generate_markdown_report(df, output_dir / 'data_report.md')
    
    print("\n✅ Report generation complete!")


if __name__ == "__main__":
    # Load cleaned dataset
    data_dir = Path(__file__).parent.parent.parent / 'data'
    cleaned_path = data_dir / 'iqcars_cleaned.csv'
    
    if not cleaned_path.exists():
        print(f"Error: {cleaned_path} not found. Run pipeline first!")
    else:
        df = pd.read_csv(cleaned_path)
        generate_report(df)
