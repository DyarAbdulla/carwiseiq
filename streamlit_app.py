"""
Car Price Prediction Web Application - Premium Design
Modern Streamlit interface with animations, glassmorphism, and professional UX
"""

import streamlit as st
import pandas as pd
import numpy as np
import pickle
import os
import json
import base64
import sys
# time import removed - no longer needed

# ============================================================================
# PAGE CONFIGURATION - MUST BE AT THE TOP
# ============================================================================
st.set_page_config(
    page_title="Car Price Predictor Pro",
    page_icon="🚗",
    layout="wide",
    initial_sidebar_state="expanded",
    menu_items={
        'Get Help': None,
        'Report a bug': None,
        'About': "AI-Powered Car Price Prediction System"
    }
)

# Add project directories to path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Add core and app directories to path
core_dir = os.path.join(current_dir, 'core')
app_dir = os.path.join(current_dir, 'app')
if core_dir not in sys.path:
    sys.path.insert(0, core_dir)
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

from predict_price import load_model, prepare_features, predict_price
import plotly.express as px
import plotly.graph_objects as go
import config
from translations import t

# ============================================================================
# IOS DETECTION AND HELPER FUNCTIONS
# ============================================================================
import streamlit.components.v1 as components

def add_ios_detection_component():
    """Add JavaScript component to detect iOS and show banner"""
    # Check if iOS is detected via query params (set by JavaScript)
    query_params = st.query_params
    is_ios = False
    
    if 'ios' in query_params:
        is_ios = True
        # Store in session state for persistence
        st.session_state.ios_detected = True
    
    # Check session state
    if st.session_state.get('ios_detected', False):
        is_ios = True
    
    # Add JavaScript to detect iOS and set query param
    if 'ios_detection_added' not in st.session_state:
        components.html("""
        <script>
        (function() {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (isIOS) {
                // Set query param to indicate iOS
                if (!window.location.search.includes('ios=true')) {
                    const url = new URL(window.location);
                    url.searchParams.set('ios', 'true');
                    // Use history API to update URL without reload
                    window.history.replaceState({}, '', url);
                }
                // Also store in sessionStorage for next page load
                sessionStorage.setItem('ios_detected', 'true');
            }
        })();
        </script>
        """, height=0)
        st.session_state.ios_detection_added = True
    
    return is_ios

def create_refresh_link_button(key_prefix):
    """Create a small link-style refresh button after dropdowns"""
    button_key = f"refresh_{key_prefix}"
    # Use columns to align the button like a link (left-aligned, small)
    col1, col2, col3 = st.columns([1, 15, 1])
    with col2:
        if st.button("Refresh Options ↻", key=button_key, help="Refresh dropdown options", use_container_width=False, type="secondary"):
            st.rerun()

# ============================================================================
# BACKGROUND IMAGE SETUP - Convert to base64 for reliable embedding
# ============================================================================
@st.cache_data(ttl=3600, show_spinner=False)
def get_base64_image(image_path):
    """Convert image to base64 string for embedding in CSS - cached for performance"""
    try:
        if os.path.exists(image_path):
            with open(image_path, "rb") as img_file:
                return base64.b64encode(img_file.read()).decode()
    except Exception:
        pass
    return None

@st.cache_data(ttl=3600, show_spinner=False)
def load_background_image():
    """Load background image - cached for performance"""
    bg_image_paths = [
        os.path.join(os.path.dirname(__file__), "assets", "52ac6ccf-f99e-404a-9919-68c780f77ec2-md.jpeg"),
        os.path.join(os.path.dirname(__file__), "52ac6ccf-f99e-404a-9919-68c780f77ec2-md.jpeg"),
    ]
    
    for path in bg_image_paths:
        bg_image_base64 = get_base64_image(path)
        if bg_image_base64:
            return bg_image_base64
    return None

# Get base64 encoded background image
bg_image_base64 = load_background_image()

# ============================================================================
# PREMIUM CSS STYLING
# ============================================================================
# Build CSS with background image
css_template = """
<style>
    /* Import Google Fonts */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    
    /* ========================================================================
       PREMIUM SAAS DESIGN SYSTEM
       Colors: Background #0F1419, Cards #1A1F2E, Accent #6366F1
       ======================================================================== */
    
    /* Global Styles */
    * {
        font-family: 'Inter', sans-serif;
    }
    
    /* Premium Car-Themed Background */
    .main {
        background: #0F1419;
        min-height: 100vh;
        padding: 0;
        position: relative;
    }
    
    /* Streamlit App Container with Background Image */
    .stApp {
        background: #0F1419;
        position: relative;
    }
    
    /* Background Image Layer - Car Street Background */
    .stApp::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
        background-image: url('BACKGROUND_IMAGE_PLACEHOLDER');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        background-attachment: fixed;
        filter: blur(3px) brightness(0.8);
        -webkit-filter: blur(3px) brightness(0.8);
        transform: scale(1.05);
    }
    
    /* Dark Overlay - Reduced to 30% opacity for maximum car visibility */
    .stApp::after {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
        background: rgba(0, 0, 0, 0.3);
        pointer-events: none;
    }
    
    /* Fix selectbox dropdowns - ensure they appear above all content */
    [data-baseweb="select"],
    [data-baseweb="popover"],
    [data-baseweb="menu"] {
        z-index: 9999 !important;
    }
    
    /* Ensure dropdown options are visible */
    [role="listbox"] {
        z-index: 10000 !important;
        position: fixed !important;
        overflow: visible !important;
    }
    
    /* Ensure all content is above background */
    .stApp > div,
    .main > div,
    [data-testid="stAppViewContainer"],
    [data-testid="stHeader"],
    [data-testid="stSidebar"] {
        position: relative;
        z-index: 2;
    }
    
    /* Header Styles - Centered, Clean - Premium Hero Section */
    .premium-header {
        background: transparent;
        padding: 32px 24px 24px 24px;
        margin-bottom: 32px;
        text-align: center;
    }
    
    .header-title {
        font-size: 42px;
        font-weight: 800;
        color: #F9FAFB;
        text-align: center;
        margin-bottom: 12px;
        line-height: 1.1;
        letter-spacing: -0.5px;
        background: linear-gradient(135deg, #F9FAFB 0%, #E5E7EB 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }
    
    .header-subtitle {
        font-size: 18px;
        color: #9CA3AF;
        text-align: center;
        font-weight: 400;
        line-height: 1.6;
        margin-bottom: 8px;
    }
    
    /* Hero Badge - Premium Accent */
    .hero-badge {
        display: inline-block;
        background: rgba(99, 102, 241, 0.15);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 20px;
        padding: 6px 16px;
        font-size: 13px;
        color: #818CF8;
        font-weight: 500;
        margin-top: 8px;
    }
    
    /* Premium Cards - Semi-transparent with backdrop blur */
    .premium-card {
        background: rgba(26, 31, 46, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
        margin-bottom: 24px;
    }
    
    /* PRIORITY 1: Prediction Card - Hero Element - ENHANCED */
    .prediction-box-premium {
        background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
        border-radius: 20px;
        padding: 48px 32px;
        color: #F9FAFB;
        text-align: center;
        margin: 40px 0 32px 0;
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: 0 20px 40px -12px rgba(99, 102, 241, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
        position: relative;
        overflow: hidden;
    }
    
    /* Enhanced glow effect */
    .prediction-box-premium::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%);
        animation: glow 4s ease-in-out infinite;
    }
    
    @keyframes glow {
        0%, 100% { opacity: 0.4; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.05); }
    }
    
    .price-display-premium {
        font-size: 64px;
        font-weight: 800;
        margin: 20px 0;
        color: #FFFFFF;
        line-height: 1.1;
        position: relative;
        z-index: 1;
        letter-spacing: -1px;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    
    .price-label-premium {
        font-size: 16px;
        color: rgba(255, 255, 255, 0.9);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 8px;
        position: relative;
        z-index: 1;
    }
    
    .confidence-interval-premium {
        font-size: 15px;
        color: rgba(255, 255, 255, 0.85);
        margin-top: 16px;
        font-weight: 400;
        line-height: 1.6;
        position: relative;
        z-index: 1;
        opacity: 0.95;
    }
    
    /* Buttons - Modern Purple Accent - Mobile-friendly */
    .stButton>button {
        width: 100%;
        background: #6366F1;
        color: #F9FAFB;
        font-size: 14px;
        font-weight: 600;
        padding: 12px 24px;
        border-radius: 8px;
        border: none;
        transition: all 0.2s ease;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        min-height: 44px; /* Minimum touch target size */
        -webkit-tap-highlight-color: rgba(99, 102, 241, 0.3);
    }
    
    .stButton>button:hover {
        background: #4F46E5;
        transform: translateY(-1px);
        box-shadow: 0 6px 8px -1px rgba(0, 0, 0, 0.15);
    }
    
    .stButton>button:active {
        transform: translateY(0);
    }
    
    /* Predict Button - Big, Red, Full Width */
    .predict-button-container .stButton>button {
        width: 100% !important;
        background: #FF4B4B !important;
        color: #FFFFFF !important;
        font-size: 20px !important;
        font-weight: 700 !important;
        padding: 18px 32px !important;
        border-radius: 12px !important;
        border: none !important;
        transition: all 0.3s ease !important;
        box-shadow: 0 6px 12px -2px rgba(255, 75, 75, 0.4) !important;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    .predict-button-container .stButton>button:hover {
        background: #FF3333 !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 8px 16px -2px rgba(255, 75, 75, 0.5) !important;
    }
    
    .predict-button-container .stButton>button:active {
        transform: translateY(0) !important;
        box-shadow: 0 4px 8px -2px rgba(255, 75, 75, 0.3) !important;
    }
    
    /* Form Inputs - Grouped Sections with backdrop blur */
    .form-section {
        background: rgba(26, 31, 46, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    }
    
    .form-section-title {
        font-size: 18px;
        font-weight: 600;
        color: #F9FAFB;
        margin-bottom: 16px;
        line-height: 1.6;
    }
    
    /* Input Labels - Mobile-friendly */
    .stSelectbox label, .stSlider label, .stNumberInput label, .stRadio label {
        font-weight: 500;
        color: #F9FAFB;
        font-size: 14px;
        line-height: 1.6;
        margin-bottom: 6px;
        display: block;
    }
    
    /* Input Fields - Semi-transparent - Mobile-friendly */
    .stSelectbox>div>div, .stNumberInput>div>div>input {
        background: rgba(15, 20, 25, 0.7);
        backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        color: #F9FAFB;
        min-height: 44px; /* Minimum touch target size */
        -webkit-tap-highlight-color: rgba(99, 102, 241, 0.2);
    }
    
    .stSelectbox>div>div:hover, .stNumberInput>div>div>input:hover {
        background: rgba(15, 20, 25, 0.85);
        border-color: rgba(99, 102, 241, 0.5);
    }
    
    .stSelectbox>div>div:focus, .stNumberInput>div>div>input:focus {
        background: rgba(15, 20, 25, 0.9);
        border-color: #6366F1;
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
    }
    
    /* Sliders - Purple Accent */
    .stSlider>div>div>div {
        background: #6366F1;
    }
    
    /* Sidebar - Semi-transparent with backdrop blur */
    [data-testid="stSidebar"] {
        background: rgba(26, 31, 46, 0.9);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-right: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    }
    
    [data-testid="stSidebar"] [class*="css"] {
        color: #F9FAFB;
    }
    
    /* Tabs - Modern Style with Enhanced Active State */
    .stTabs [data-baseweb="tab-list"] {
        gap: 4px;
        background: rgba(26, 31, 46, 0.7);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.15);
        padding: 4px;
        border-radius: 12px 12px 0 0;
    }
    
    .stTabs [data-baseweb="tab"] {
        color: #9CA3AF;
        font-size: 15px;
        font-weight: 500;
        padding: 14px 28px;
        border-bottom: 3px solid transparent;
        border-radius: 8px;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        background: transparent;
        min-height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .stTabs [data-baseweb="tab"]:hover {
        color: #F9FAFB;
        background: rgba(99, 102, 241, 0.15);
        transform: translateY(-1px);
    }
    
    .stTabs [data-baseweb="tab"][aria-selected="true"] {
        color: #FFFFFF;
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(79, 70, 229, 0.3) 100%);
        border-bottom: 3px solid #6366F1;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
    }
    
    /* Metrics - KPI Cards */
    [data-testid="stMetricValue"] {
        font-size: 24px;
        font-weight: 700;
        color: #F9FAFB;
        line-height: 1.2;
    }
    
    [data-testid="stMetricLabel"] {
        font-size: 12px;
        color: #9CA3AF;
        font-weight: 500;
        line-height: 1.6;
    }
    
    [data-testid="stMetricDelta"] {
        font-size: 12px;
        font-weight: 500;
    }
    
    /* Metric Container Cards - Semi-transparent */
    [data-testid="metric-container"] {
        background: rgba(26, 31, 46, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    }
    
    /* Success/Error Messages - Semi-transparent with backdrop blur */
    .stSuccess {
        background: rgba(16, 185, 129, 0.15);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-left: 3px solid #10B981;
        border-radius: 8px;
        padding: 16px;
        color: #10B981;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    }
    
    .stError {
        background: rgba(239, 68, 68, 0.15);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-left: 3px solid #EF4444;
        border-radius: 8px;
        padding: 16px;
        color: #EF4444;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    }
    
    .stWarning {
        background: rgba(245, 158, 11, 0.15);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-left: 3px solid #F59E0B;
        border-radius: 8px;
        padding: 16px;
        color: #F59E0B;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    }
    
    .stInfo {
        background: rgba(99, 102, 241, 0.15);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-left: 3px solid #6366F1;
        border-radius: 8px;
        padding: 16px;
        color: #6366F1;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    }
    
    /* Text Colors */
    h1, h2, h3, h4, h5, h6 {
        color: #F9FAFB;
    }
    
    p, span, div {
        color: #F9FAFB;
    }
    
    /* Markdown Text */
    .stMarkdown {
        color: #F9FAFB;
    }
    
    .stMarkdown p {
        color: #9CA3AF;
        font-size: 14px;
        line-height: 1.6;
    }
    
    /* Dataframe Styling - Semi-transparent */
    .stDataFrame {
        background: rgba(26, 31, 46, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    }
    
    /* Footer - Semi-transparent */
    .premium-footer {
        background: rgba(26, 31, 46, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-top: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 0;
        padding: 24px;
        margin-top: 48px;
        text-align: center;
        box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.3);
    }
    
    .footer-text {
        color: #9CA3AF;
        font-size: 12px;
        margin: 0;
        line-height: 1.6;
    }
    
    /* Section Spacing */
    .section-spacer {
        margin: 48px 0;
    }
    
    /* Collapsible Sections - Premium Design */
    .collapsible-section {
        background: rgba(26, 31, 46, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
    }
    
    .collapsible-section:hover {
        border-color: rgba(99, 102, 241, 0.3);
        box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.4);
    }
    
    .collapsible-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        padding: 12px 0;
        font-size: 18px;
        font-weight: 600;
        color: #F9FAFB;
        user-select: none;
    }
    
    .collapsible-content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease, padding 0.3s ease;
        padding: 0 0;
    }
    
    .collapsible-content.expanded {
        max-height: 5000px;
        padding: 16px 0 0 0;
    }
    
    /* Loading States - Premium Spinner */
    .premium-spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 3px solid rgba(99, 102, 241, 0.2);
        border-top-color: #6366F1;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-right: 8px;
        vertical-align: middle;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    /* Disabled States */
    .stButton>button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none !important;
    }
    
    .stSelectbox:has(select:disabled),
    .stNumberInput:has(input:disabled) {
        opacity: 0.6;
    }
    
    /* Form Group Improvements */
    .form-group {
        margin-bottom: 24px;
    }
    
    .form-group:last-child {
        margin-bottom: 0;
    }
    
    /* Form Field Importance Labels */
    .field-importance {
        display: inline-block;
        font-size: 11px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 4px;
        margin-left: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    .field-importance.most-important {
        background: rgba(99, 102, 241, 0.2);
        color: #818CF8;
        border: 1px solid rgba(99, 102, 241, 0.3);
    }
    
    .field-importance.important {
        background: rgba(59, 130, 246, 0.2);
        color: #60A5FA;
        border: 1px solid rgba(59, 130, 246, 0.3);
    }
    
    .field-importance.optional {
        background: rgba(107, 114, 128, 0.2);
        color: #9CA3AF;
        border: 1px solid rgba(107, 114, 128, 0.3);
    }
    
    /* Helper Text - Subtle */
    .helper-text {
        font-size: 12px;
        color: #6B7280;
        margin-top: 4px;
        margin-bottom: 8px;
        line-height: 1.4;
        font-style: italic;
    }
    
    /* Emotional Feedback Badges */
    .feedback-badge {
        display: inline-block;
        font-size: 13px;
        font-weight: 600;
        padding: 6px 12px;
        border-radius: 6px;
        margin: 8px 4px 0 0;
    }
    
    .feedback-badge.positive {
        background: rgba(16, 185, 129, 0.15);
        color: #10B981;
        border: 1px solid rgba(16, 185, 129, 0.3);
    }
    
    .feedback-badge.neutral {
        background: rgba(59, 130, 246, 0.15);
        color: #3B82F6;
        border: 1px solid rgba(59, 130, 246, 0.3);
    }
    
    .feedback-badge.warning {
        background: rgba(245, 158, 11, 0.15);
        color: #F59E0B;
        border: 1px solid rgba(245, 158, 11, 0.3);
    }
    
    /* Trust Signal Cards */
    .trust-signal {
        background: rgba(26, 31, 46, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 8px;
        font-size: 13px;
    }
    
    .trust-signal-label {
        color: #9CA3AF;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
    }
    
    .trust-signal-value {
        color: #F9FAFB;
        font-weight: 600;
        font-size: 14px;
    }
    
    /* Market Comparison Cards - Compact */
    .market-comparison-card {
        background: rgba(26, 31, 46, 0.6);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 16px;
        text-align: center;
        transition: all 0.2s ease;
    }
    
    .market-comparison-card:hover {
        border-color: rgba(99, 102, 241, 0.3);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
    
    /* Expander Styling - Premium Design */
    .streamlit-expanderHeader {
        background: rgba(26, 31, 46, 0.6) !important;
        backdrop-filter: blur(10px) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-radius: 8px !important;
        padding: 12px 16px !important;
        font-size: 16px !important;
        font-weight: 600 !important;
        color: #F9FAFB !important;
        transition: all 0.2s ease !important;
    }
    
    .streamlit-expanderHeader:hover {
        background: rgba(99, 102, 241, 0.15) !important;
        border-color: rgba(99, 102, 241, 0.3) !important;
    }
    
    .streamlit-expanderContent {
        background: rgba(26, 31, 46, 0.4) !important;
        border-radius: 0 0 8px 8px !important;
        padding: 20px !important;
        margin-top: 8px !important;
    }
    
    /* Enhanced Loading Spinner */
    .stSpinner > div {
        border-color: rgba(99, 102, 241, 0.2) !important;
        border-top-color: #6366F1 !important;
    }
    
    /* Better spacing for form sections on mobile */
    @media (max-width: 768px) {
        .form-section {
            margin-bottom: 20px !important;
        }
        
        .form-section-title {
            margin-bottom: 16px !important;
        }
        
        /* Stack form columns on mobile */
        [data-testid="column"] {
            margin-bottom: 0 !important;
        }
    }
    
    /* ========================================================================
       MOBILE: DISABLE ALL BACKDROP-FILTER FOR SELECTBOX COMPATIBILITY
       ========================================================================
       On mobile, disable all backdrop-filter and blur effects.
       Use solid backgrounds instead to preserve selectbox functionality.
    */
    @media (max-width: 768px) {
        /* Hero Badge - Solid background */
        .hero-badge {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(99, 102, 241, 0.25) !important;
        }
        
        /* Premium Cards - Solid background */
        .premium-card {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(26, 31, 46, 0.95) !important;
        }
        
        /* Form Sections - Solid background */
        .form-section {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(26, 31, 46, 0.95) !important;
        }
        
        /* Input Fields - Solid background */
        .stSelectbox>div>div, 
        .stNumberInput>div>div>input {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(15, 20, 25, 0.9) !important;
        }
        
        /* Sidebar - Solid background */
        [data-testid="stSidebar"] {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(26, 31, 46, 0.98) !important;
        }
        
        /* Tabs - Solid background */
        .stTabs [data-baseweb="tab-list"] {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(26, 31, 46, 0.95) !important;
        }
        
        /* Metric Container Cards - Solid background */
        [data-testid="metric-container"] {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(26, 31, 46, 0.95) !important;
        }
        
        /* Success/Error Messages - Solid background */
        .stSuccess {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(16, 185, 129, 0.2) !important;
        }
        
        .stError {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(239, 68, 68, 0.2) !important;
        }
        
        .stWarning {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(245, 158, 11, 0.2) !important;
        }
        
        .stInfo {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(99, 102, 241, 0.2) !important;
        }
        
        /* Dataframe - Solid background */
        .stDataFrame {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(26, 31, 46, 0.95) !important;
        }
        
        /* Footer - Solid background */
        .premium-footer {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(26, 31, 46, 0.95) !important;
        }
        
        /* Collapsible Sections - Solid background */
        .collapsible-section {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(26, 31, 46, 0.95) !important;
        }
        
        /* Market Comparison Cards - Solid background */
        .market-comparison-card {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(26, 31, 46, 0.85) !important;
        }
        
        /* Expander Header - Solid background */
        .streamlit-expanderHeader {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(26, 31, 46, 0.95) !important;
        }
        
        /* Expander Content - Solid background */
        .streamlit-expanderContent {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(26, 31, 46, 0.9) !important;
        }
        
        /* Language Buttons - Solid background */
        button[key="lang_en_main"], 
        button[key="lang_ku_main"], 
        button[key="lang_ar_main"] {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(26, 31, 46, 0.95) !important;
        }
        
        button[type="secondary"][key="lang_en_main"],
        button[type="secondary"][key="lang_ku_main"],
        button[type="secondary"][key="lang_ar_main"] {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(26, 31, 46, 0.8) !important;
        }
        
        button[type="primary"][key="lang_en_main"],
        button[type="primary"][key="lang_ku_main"],
        button[type="primary"][key="lang_ar_main"] {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(99, 102, 241, 0.4) !important;
        }
    }
    
    /* Chart Titles */
    .chart-title {
        font-size: 18px;
        font-weight: 600;
        color: #F9FAFB;
        margin-bottom: 16px;
        line-height: 1.6;
    }
    
    /* RTL Support for Kurdish */
    [dir="rtl"] {
        direction: rtl;
        text-align: right;
    }
    
    [dir="rtl"] .premium-header {
        text-align: right;
    }
    
    [dir="rtl"] .stSidebar {
        text-align: right;
    }
    
    /* Responsive Design - Mobile Optimization */
    @media (max-width: 768px) {
        /* Stack columns vertically on mobile */
        [data-testid="column"] {
            width: 100% !important;
            flex: 1 1 100% !important;
            min-width: 100% !important;
            margin-bottom: 0 !important;
        }
        
        /* Make all columns stack */
        .element-container > div[data-testid="column"] {
            width: 100% !important;
        }
        
        /* Form sections - full width on mobile */
        .form-section {
            width: 100% !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
        }
        
        /* Header adjustments */
        .header-title {
            font-size: 32px !important;
            line-height: 1.2 !important;
        }
        
        .header-subtitle {
            font-size: 16px !important;
        }
        
        .hero-badge {
            font-size: 12px !important;
            padding: 5px 12px !important;
        }
        
        /* Price display - Mobile optimized */
        .price-display-premium {
            font-size: 48px !important;
        }
        
        .prediction-box-premium {
            padding: 36px 24px !important;
            margin: 24px 0 !important;
        }
        
        .price-label-premium {
            font-size: 14px !important;
        }
        
        .confidence-interval-premium {
            font-size: 14px !important;
        }
        
        /* Cards */
        .premium-card {
            padding: 20px !important;
            margin-bottom: 16px !important;
        }
        
        .form-section {
            padding: 20px !important;
            margin-bottom: 16px !important;
        }
        
        /* Larger fonts for mobile readability */
        body {
            font-size: 16px !important;
        }
        
        .form-section-title {
            font-size: 20px !important;
            margin-bottom: 12px !important;
        }
        
        .chart-title {
            font-size: 20px !important;
        }
        
        /* Buttons - Larger for touch screens */
        .stButton>button {
            padding: 15px 24px !important;
            font-size: 16px !important;
            min-height: 48px !important;
            width: 100% !important;
        }
        
        /* Predict button - Even larger on mobile */
        .predict-button-container .stButton>button {
            padding: 20px 32px !important;
            font-size: 18px !important;
            min-height: 56px !important;
        }
        
        /* Input fields - Larger touch targets */
        .stSelectbox>div>div,
        .stNumberInput>div>div>input,
        .stSlider>div>div>div,
        .stRadio>div>div>label {
            min-height: 44px !important;
            font-size: 16px !important;
            padding: 12px !important;
        }
        
        /* Selectbox dropdowns */
        .stSelectbox label {
            font-size: 16px !important;
            margin-bottom: 8px !important;
        }
        
        /* Number inputs */
        .stNumberInput label {
            font-size: 16px !important;
            margin-bottom: 8px !important;
        }
        
        input[type="number"] {
            font-size: 16px !important;
            padding: 12px !important;
            min-height: 44px !important;
        }
        
        /* Sliders */
        .stSlider label {
            font-size: 16px !important;
            margin-bottom: 8px !important;
        }
        
        /* Radio buttons */
        .stRadio label {
            font-size: 16px !important;
            padding: 12px 8px !important;
            min-height: 44px !important;
        }
        
        /* Text inputs */
        .stTextInput>div>div>input {
            font-size: 16px !important;
            padding: 12px !important;
            min-height: 44px !important;
        }
        
        /* Sidebar adjustments */
        [data-testid="stSidebar"] {
            width: 100% !important;
        }
        
        /* Tabs - Larger on mobile with better spacing */
        .stTabs [data-baseweb="tab"] {
            padding: 16px 20px !important;
            font-size: 16px !important;
            min-height: 52px !important;
            margin: 2px !important;
        }
        
        .stTabs [data-baseweb="tab-list"] {
            gap: 2px !important;
            padding: 2px !important;
        }
        
        /* Metrics */
        [data-testid="stMetricValue"] {
            font-size: 28px !important;
        }
        
        [data-testid="stMetricLabel"] {
            font-size: 14px !important;
        }
        
        /* Spacing adjustments */
        .section-spacer {
            margin: 24px 0 !important;
        }
        
        /* Better spacing between form elements */
        .stSelectbox,
        .stNumberInput,
        .stSlider,
        .stRadio {
            margin-bottom: 20px !important;
        }
        
        /* Fix selectbox dropdowns on mobile - ensure they appear above everything */
        .stSelectbox [data-baseweb="select"] {
            z-index: 9999 !important;
            position: relative !important;
        }
        
        .stSelectbox [data-baseweb="popover"] {
            z-index: 10000 !important;
            position: fixed !important;
        }
        
        /* Ensure dropdown menu is visible */
        [data-baseweb="menu"],
        [data-baseweb="popover"] {
            z-index: 10001 !important;
            position: fixed !important;
            overflow: visible !important;
        }
        
        /* Fix for Streamlit selectbox dropdown container */
        div[data-baseweb="select"] > div {
            z-index: 9999 !important;
        }
        
        /* Ensure dropdown options are clickable and visible */
        [role="listbox"],
        [role="option"] {
            z-index: 10002 !important;
            position: relative !important;
        }
    }
    
    /* Extra small devices (phones in portrait) */
    @media (max-width: 480px) {
        .header-title {
            font-size: 24px !important;
        }
        
        .price-display-premium {
            font-size: 40px !important;
        }
        
        .prediction-box-premium {
            padding: 32px 20px !important;
        }
        
        .form-section-title {
            font-size: 18px !important;
        }
        
        .stButton>button {
            padding: 16px 20px !important;
            font-size: 16px !important;
        }
        
        .predict-button-container .stButton>button {
            padding: 18px 24px !important;
            font-size: 17px !important;
        }
    }
    
    /* Hide Streamlit default elements - Enhanced */
    #MainMenu {visibility: hidden !important;}
    footer {visibility: hidden !important;}
    header {visibility: hidden !important;}
    .stDeployButton {display: none !important;}
    #stDecoration {display: none !important;}
    [data-testid="stToolbar"] {visibility: hidden !important;}
    [data-testid="stHeader"] {visibility: hidden !important;}
    
    /* Mobile viewport and touch optimizations */
    * {
        -webkit-tap-highlight-color: rgba(99, 102, 241, 0.2);
        -webkit-touch-callout: none;
    }
    
    /* Ensure proper scrolling on mobile */
    .main {
        -webkit-overflow-scrolling: touch;
    }
    
    /* Link-style refresh buttons - style all refresh buttons */
    button[key*="refresh_"] {
        background: none !important;
        border: none !important;
        color: #6366F1 !important;
        font-size: 0.85rem !important;
        padding: 4px 0 !important;
        margin: 0 0 8px 0 !important;
        text-decoration: underline !important;
        cursor: pointer !important;
        box-shadow: none !important;
        font-weight: 400 !important;
        min-height: auto !important;
        height: auto !important;
        line-height: 1.4 !important;
        width: auto !important;
    }
    
    button[key*="refresh_"]:hover {
        background: none !important;
        border: none !important;
        color: #4F46E5 !important;
        text-decoration: underline !important;
        transform: none !important;
        box-shadow: none !important;
    }
    
    button[key*="refresh_"]:active {
        background: none !important;
        transform: none !important;
    }
    
    /* Critical: Fix selectbox dropdowns on mobile - prevent clipping */
    [data-baseweb="select"] {
        z-index: 9999 !important;
    }
    
    [data-baseweb="popover"] {
        z-index: 10000 !important;
        position: fixed !important;
        overflow: visible !important;
        max-height: none !important;
    }
    
    /* Ensure dropdown menu container is visible */
    [data-baseweb="menu"] {
        z-index: 10001 !important;
        position: fixed !important;
        overflow: visible !important;
        max-height: 80vh !important;
        overflow-y: auto !important;
    }
    
    /* Fix for mobile - ensure dropdowns are not clipped by parent containers */
    .stSelectbox,
    .stSelectbox > div {
        overflow: visible !important;
        position: relative !important;
    }
    
    /* Mobile-specific: Make sure dropdowns appear above everything */
    @media (max-width: 768px) {
        [data-baseweb="select"],
        [data-baseweb="popover"],
        [data-baseweb="menu"] {
            z-index: 99999 !important;
        }
        
        /* Prevent parent containers from clipping dropdowns */
        .main,
        [data-testid="stAppViewContainer"],
        [data-testid="block-container"] {
            overflow: visible !important;
        }
        
        /* Ensure selectbox dropdowns work on touch devices */
        .stSelectbox [data-baseweb="select"] {
            touch-action: manipulation !important;
        }
    }
    
    /* Better spacing for mobile */
    @media (max-width: 768px) {
        .main .block-container {
            padding: 1rem !important;
        }
    }
    
    /* Radio Buttons */
    .stRadio label {
        color: #F9FAFB;
        font-size: 14px;
    }
    
    /* Number Input - Mobile-friendly */
    input[type="number"] {
        background: #0F1419;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: #F9FAFB;
        min-height: 44px; /* Minimum touch target size */
        font-size: 16px; /* Prevents zoom on iOS */
        -webkit-tap-highlight-color: rgba(99, 102, 241, 0.2);
    }
    
    /* Prevent zoom on input focus (iOS) */
    @media screen and (max-width: 768px) {
        input, select, textarea {
            font-size: 16px !important;
        }
    }
    
    /* ============================================================================
       MOBILE SELECTBOX FIX - Complete Reset to Streamlit Defaults
       ============================================================================
       On mobile devices, completely disable ALL custom styling for selectboxes,
       multiselects, and dropdowns to ensure native Streamlit behavior works.
       Desktop styling remains completely unchanged.
       This MUST be at the end to override all previous mobile selectbox styles.
    */
    @media (max-width: 768px) {
        /* Reset ALL selectbox styling to Streamlit defaults - Override everything */
        .stSelectbox,
        .stSelectbox > div,
        .stSelectbox > div > div,
        .stSelectbox > div > div > div,
        .stSelectbox [data-baseweb="select"],
        .stSelectbox [data-baseweb="select"] > div,
        .stSelectbox [data-baseweb="select"] > div > div {
            background: initial !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border: initial !important;
            border-radius: initial !important;
            box-shadow: initial !important;
            overflow: initial !important;
            position: initial !important;
            z-index: auto !important;
            min-height: initial !important;
            padding: initial !important;
            margin: initial !important;
            color: initial !important;
        }
        
        /* Reset selectbox input field and all states */
        .stSelectbox > div > div,
        .stSelectbox > div > div:hover,
        .stSelectbox > div > div:focus,
        .stSelectbox > div > div:active {
            background: initial !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border: initial !important;
            border-color: initial !important;
            color: initial !important;
            box-shadow: initial !important;
        }
        
        /* Reset selectbox labels */
        .stSelectbox label {
            font-weight: initial !important;
            color: initial !important;
            font-size: initial !important;
            line-height: initial !important;
            margin-bottom: initial !important;
            display: initial !important;
        }
        
        /* Reset ALL BaseWeb select components - Override previous z-index hacks */
        [data-baseweb="select"],
        [data-baseweb="select"] > div,
        [data-baseweb="select"] > div > div,
        div[data-baseweb="select"],
        div[data-baseweb="select"] > div {
            background: initial !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border: initial !important;
            border-radius: initial !important;
            box-shadow: initial !important;
            overflow: initial !important;
            position: initial !important;
            z-index: auto !important;
        }
        
        /* Reset popover/dropdown menu - Override previous fixed positioning */
        [data-baseweb="popover"],
        [data-baseweb="popover"] > div,
        .stSelectbox [data-baseweb="popover"] {
            background: initial !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border: initial !important;
            border-radius: initial !important;
            box-shadow: initial !important;
            overflow: initial !important;
            position: initial !important;
            z-index: auto !important;
            max-height: initial !important;
        }
        
        /* Reset menu/listbox - Override previous z-index and positioning */
        [data-baseweb="menu"],
        [data-baseweb="menu"] > div,
        [role="listbox"],
        [role="option"],
        .stSelectbox [data-baseweb="menu"] {
            background: initial !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border: initial !important;
            border-radius: initial !important;
            box-shadow: initial !important;
            overflow: initial !important;
            position: initial !important;
            z-index: auto !important;
            max-height: initial !important;
        }
        
        /* Reset multiselect components */
        .stMultiSelect,
        .stMultiSelect > div,
        .stMultiSelect > div > div,
        .stMultiSelect [data-baseweb="select"] {
            background: initial !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border: initial !important;
            border-radius: initial !important;
            box-shadow: initial !important;
            overflow: initial !important;
            position: initial !important;
            z-index: auto !important;
        }
        
        /* Reset any parent containers that might clip dropdowns */
        .stSelectbox,
        .stMultiSelect {
            overflow: visible !important;
        }
        
        /* Remove ALL custom z-index - Let Streamlit handle it natively */
        [data-baseweb="select"],
        [data-baseweb="popover"],
        [data-baseweb="menu"],
        [role="listbox"],
        [role="option"] {
            z-index: auto !important;
        }
        
        /* Remove touch-action restrictions - Use native behavior */
        .stSelectbox [data-baseweb="select"],
        .stMultiSelect [data-baseweb="select"],
        [data-baseweb="select"] {
            touch-action: auto !important;
        }
    }
</style>
"""

# Replace placeholder with actual base64 image or fallback
if bg_image_base64:
    css_content = css_template.replace("BACKGROUND_IMAGE_PLACEHOLDER", f"data:image/jpeg;base64,{bg_image_base64}")
else:
    # Fallback to relative path if base64 conversion failed
    css_content = css_template.replace("BACKGROUND_IMAGE_PLACEHOLDER", "52ac6ccf-f99e-404a-9919-68c780f77ec2-md.jpeg")

st.markdown(css_content, unsafe_allow_html=True)

# Initialize session state
if 'model_loaded' not in st.session_state:
    st.session_state.model_loaded = False
if 'data_loaded' not in st.session_state:
    st.session_state.data_loaded = False
if 'model_data' not in st.session_state:
    st.session_state.model_data = None
if 'df' not in st.session_state:
    st.session_state.df = None
if 'predictions_history' not in st.session_state:
    st.session_state.predictions_history = []
if 'form_reset' not in st.session_state:
    st.session_state.form_reset = False
if 'language' not in st.session_state:
    st.session_state.language = 'en'
if 'sample_car_loaded' not in st.session_state:
    st.session_state.sample_car_loaded = False
if 'sample_car_data' not in st.session_state:
    st.session_state.sample_car_data = None

# ============================================================================
# PROFESSIONAL HEADER - Title and Subtitle
# ============================================================================
# Set text direction based on language
text_dir = "rtl" if st.session_state.language in ["ku", "ar"] else "ltr"

# ============================================================================
# HEADER WITH TITLE AND SUBTITLE
# ============================================================================
# Title and subtitle - Enhanced Hero Section
st.markdown(f"""
<div class="premium-header">
    <h1 class="header-title">🚗 {t('app_title')}</h1>
    <p class="header-subtitle">{t('app_subtitle')}</p>
    <div class="hero-badge">⚡ 99.96% Accuracy • AI-Powered</div>
</div>
""", unsafe_allow_html=True)

# ============================================================================
# LANGUAGE SWITCHER - Elegant Design Below Subtitle
# ============================================================================
st.markdown("""
<style>
/* Elegant Language Switcher Container */
.language-switcher-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    margin: 1.5rem auto;
    padding: 0.5rem;
    max-width: 500px;
}

/* Modern Language Button - Minimalist Design */
button[key="lang_en_main"], button[key="lang_ku_main"], button[key="lang_ar_main"] {
    min-width: 110px !important;
    height: 42px !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 8px !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    background: rgba(26, 31, 46, 0.6) !important;
    backdrop-filter: blur(12px) !important;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    font-size: 0.875rem !important;
    font-weight: 500 !important;
    color: #D1D5DB !important;
    margin: 0 !important;
    position: relative !important;
    overflow: hidden !important;
}

/* Inactive Language Button - Subtle */
button[type="secondary"][key="lang_en_main"],
button[type="secondary"][key="lang_ku_main"],
button[type="secondary"][key="lang_ar_main"] {
    background: rgba(26, 31, 46, 0.4) !important;
    border-color: rgba(255, 255, 255, 0.05) !important;
    color: #6B7280 !important;
}

/* Active Language Button - Elegant Highlight */
button[type="primary"][key="lang_en_main"],
button[type="primary"][key="lang_ku_main"],
button[type="primary"][key="lang_ar_main"] {
    background: rgba(99, 102, 241, 0.25) !important;
    border-color: rgba(99, 102, 241, 0.5) !important;
    color: #FFFFFF !important;
    font-weight: 600 !important;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
}

/* Smooth Hover Effects */
button[key="lang_en_main"]:hover,
button[key="lang_ku_main"]:hover,
button[key="lang_ar_main"]:hover {
    border-color: rgba(99, 102, 241, 0.4) !important;
    background: rgba(99, 102, 241, 0.15) !important;
    color: #E5E7EB !important;
    transform: translateY(-1px) !important;
}

button[type="primary"][key="lang_en_main"]:hover,
button[type="primary"][key="lang_ku_main"]:hover,
button[type="primary"][key="lang_ar_main"]:hover {
    background: rgba(99, 102, 241, 0.35) !important;
    border-color: rgba(99, 102, 241, 0.7) !important;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
}

/* Remove default button focus outline */
button[key="lang_en_main"]:focus,
button[key="lang_ku_main"]:focus,
button[key="lang_ar_main"]:focus {
    outline: none !important;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3) !important;
}
</style>
""", unsafe_allow_html=True)

# Center the language buttons using columns with better spacing
lang_col1, lang_col2, lang_col3, lang_col4, lang_col5 = st.columns([2, 1.2, 1.2, 1.2, 2])

# Current language
current_lang = st.session_state.language

# Language options - clean format
language_options = [
    ("English", "en"),
    ("کوردی", "ku"),
    ("العربية", "ar")
]

# Create elegant buttons in centered columns
with lang_col2:
    name, code = language_options[0]
    if st.button(f"{name}", key="lang_en_main", use_container_width=True,
                 type="primary" if current_lang == code else "secondary"):
        st.session_state.language = code
        st.rerun()

with lang_col3:
    name, code = language_options[1]
    if st.button(f"{name}", key="lang_ku_main", use_container_width=True,
                 type="primary" if current_lang == code else "secondary"):
        st.session_state.language = code
        st.rerun()

with lang_col4:
    name, code = language_options[2]
    if st.button(f"{name}", key="lang_ar_main", use_container_width=True,
                 type="primary" if current_lang == code else "secondary"):
        st.session_state.language = code
        st.rerun()

st.markdown("<br>", unsafe_allow_html=True)

# Keep the premium header for styling consistency (optional, can be hidden)
# st.markdown(f"""
# <div class="premium-header" dir="{text_dir}" style="display: none;">
#     <h1 class="header-title">{t('app_title')}</h1>
#     <p class="header-subtitle">{t('app_subtitle')}</p>
# </div>
# """, unsafe_allow_html=True)

# ============================================================================
# HELPER FUNCTION: Convert numpy types to Python native types
# ============================================================================
def to_python_float(value):
    """Convert numpy float32/float64 to Python float for JSON serialization"""
    if isinstance(value, (np.integer, np.floating)):
        return float(value.item())
    elif isinstance(value, (np.ndarray,)):
        return float(value.item()) if value.size == 1 else [to_python_float(v) for v in value]
    elif isinstance(value, (list, tuple)):
        return [to_python_float(v) for v in value]
    return float(value) if isinstance(value, (int, float)) else value

# ============================================================================
# LOAD MODEL AND DATA - OPTIMIZED WITH CACHING
# ============================================================================
@st.cache_resource
def load_model_cached():
    """Load the trained model - cached as resource for performance"""
    try:
        # Clear predict_price.py module cache to force reload of new model
        import predict_price
        predict_price._model_cache = None
        predict_price._features_cache = None
        predict_price._poly_transformer_cache = None
        predict_price._numeric_cols_for_poly_cache = None
        predict_price._original_features_cache = None
        predict_price._make_popularity_map_cache = None
        
        model, features, model_name, make_encoder, model_encoder, target_transform, transform_offset, poly_transformer, numeric_cols_for_poly, original_features, make_popularity_map = load_model()
        
        # Validate model has required keys (warning removed per user request)
        
        return {
            'model': model,
            'features': features,
            'model_name': model_name,
            'make_encoder': make_encoder,
            'model_encoder': model_encoder,
            'target_transform': target_transform,
            'transform_offset': transform_offset,
            'poly_transformer': poly_transformer,
            'numeric_cols_for_poly': numeric_cols_for_poly,
            'original_features': original_features,
            'make_popularity_map': make_popularity_map
        }
    except Exception as e:
        st.error(f"Error loading model: {e}")
        return None

@st.cache_data(ttl=3600, show_spinner=False)
def load_data_cached():
    """Load the dataset - cached for performance"""
    try:
        df = pd.read_csv(config.CLEANED_DATA_FILE)
        return df
    except Exception as e:
        st.error(f"Error loading data: {e}")
        return None

@st.cache_data(ttl=3600, show_spinner=False)
def get_chart_data(df, max_rows=10000):
    """Get sampled data for charts to improve performance"""
    if len(df) > max_rows:
        return df.sample(n=max_rows, random_state=42).copy()
    return df.copy()

@st.cache_data(ttl=3600, show_spinner=False)
def create_mini_sparkline(df, sample_size=100):
    """Create cached mini sparkline chart"""
    if 'price' not in df.columns or len(df) == 0:
        return None
    price_sample = df['price'].sample(min(sample_size, len(df)), random_state=42).sort_index()
    fig = go.Figure(go.Scatter(
        x=list(range(len(price_sample))),
        y=price_sample.values,
        mode='lines',
        line=dict(color='#667eea', width=2),
        showlegend=False,
        hoverinfo='skip'
    ))
    fig.update_layout(
        height=60,
        margin=dict(l=0, r=0, t=0, b=0),
        xaxis=dict(showgrid=False, showticklabels=False),
        yaxis=dict(showgrid=False, showticklabels=False),
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)'
    )
    return fig

# Load model and data efficiently using session state to avoid reloading
if not st.session_state.model_loaded:
    with st.spinner("Loading model..."):
        try:
            model_data = load_model_cached()
            if model_data:
                st.session_state.model_data = model_data
                st.session_state.model_loaded = True
            else:
                st.error("Failed to load model. Please ensure model_training.py has been run.")
        except Exception as e:
            st.error(f"Error loading model: {e}")
            st.session_state.model_loaded = False

if not st.session_state.data_loaded:
    with st.spinner("Loading data..."):
        try:
            df = load_data_cached()
            if df is not None:
                st.session_state.df = df
                st.session_state.data_loaded = True
            else:
                st.error("Failed to load data. Please ensure data file exists.")
        except Exception as e:
            st.error(f"Error loading data: {e}")
            st.session_state.data_loaded = False

# Show success message only once when both are loaded
if st.session_state.model_loaded and st.session_state.data_loaded and 'init_success_shown' not in st.session_state:
    st.success(f"✅ {t('system_ready')}")
    st.session_state.init_success_shown = True

# ============================================================================
# SIDEBAR NAVIGATION - Enhanced with App Info and Instructions
# ============================================================================
with st.sidebar:
    st.markdown("## 📱 App Information")
    st.markdown("""
    **Car Price Predictor Pro** is an AI-powered tool that estimates car prices using advanced machine learning.
    
    ### 🎯 How to Use:
    1. **Fill in car details** in the form
    2. **Click "Try Sample Car"** to see an example
    3. **Click "🚀 Predict Price"** to get your estimate
    4. **View results** with confidence intervals
    
    ### 💡 Tips:
    - Use realistic values for best results
    - Check the Data tab for market insights
    - Compare multiple cars using the Compare tab
    """)
    
    st.markdown("---")
    
    # Language Selector
    lang_options = {"English": "en", "Kurdish (Sorani)": "ku", "Arabic / العربية": "ar"}
    selected_lang = st.selectbox(
        "🌐 Language / زمان / اللغة",
        options=list(lang_options.keys()),
        index=list(lang_options.values()).index(st.session_state.language) if st.session_state.language in lang_options.values() else 0,
        key="lang_selector"
    )
    if lang_options[selected_lang] != st.session_state.language:
        st.session_state.language = lang_options[selected_lang]
        # Streamlit will automatically rerun on selectbox change, no need for explicit rerun
    
    st.markdown("---")
    st.markdown("## 📊 Quick Stats")
    
    # Quick stats
    if st.session_state.data_loaded and st.session_state.df is not None:
        df = st.session_state.df
        st.metric(t("total_cars"), f"{len(df):,}")
        if 'price' in df.columns:
            st.metric(t("avg_price"), f"${df['price'].mean():,.0f}")
    else:
        st.info("Data loading...")
    
    st.markdown("---")
    st.markdown("## 🤖 Model Information")
    if st.session_state.model_data:
        model_name = st.session_state.model_data.get('model_name', 'Unknown')
        st.info(f"**{t('model')}:** {model_name}\n\n**{t('r2_score')}:** 0.9996 (99.96%)")
    else:
        st.warning("Model not loaded")
    
    st.markdown("---")
    st.markdown("## 🛡️ Trust & Transparency")
    
    # Trust signals
    if st.session_state.model_data and st.session_state.data_loaded:
        model_name = st.session_state.model_data.get('model_name', 'Unknown')
        df = st.session_state.df
        
        # Model version
        st.markdown("""
        <div class="trust-signal">
            <div class="trust-signal-label">Model Version</div>
            <div class="trust-signal-value">v2.0 (Production)</div>
        </div>
        """, unsafe_allow_html=True)
        
        # Dataset size
        dataset_size = len(df) if df is not None else 0
        st.markdown(f"""
        <div class="trust-signal">
            <div class="trust-signal-label">Training Dataset</div>
            <div class="trust-signal-value">{dataset_size:,} vehicles</div>
        </div>
        """, unsafe_allow_html=True)
        
        # Model accuracy
        st.markdown("""
        <div class="trust-signal">
            <div class="trust-signal-label">Model Accuracy</div>
            <div class="trust-signal-value">99.96% (R² = 0.9996)</div>
        </div>
        """, unsafe_allow_html=True)
        
        # Last update (using file modification time if available)
        import os
        from datetime import datetime
        try:
            model_path = os.path.join(os.path.dirname(__file__), "models", "best_model_v2.pkl")
            if os.path.exists(model_path):
                mod_time = os.path.getmtime(model_path)
                last_update = datetime.fromtimestamp(mod_time).strftime("%B %Y")
                st.markdown(f"""
                <div class="trust-signal">
                    <div class="trust-signal-label">Last Model Update</div>
                    <div class="trust-signal-value">{last_update}</div>
                </div>
                """, unsafe_allow_html=True)
        except:
            pass
    
    st.markdown("---")
    st.markdown("## ⚡ Quick Actions")
    
    # Reset button
    if st.button(f"🔄 {t('reset_all_inputs')}", use_container_width=True, help="Clear all form inputs"):
        # Clear all form-related session state
        st.session_state.form_reset = True
        st.session_state.sample_car_loaded = False
        st.session_state.sample_car_data = None
        # Streamlit will automatically rerun on button click, no need for explicit rerun
    
    st.markdown("---")
    st.markdown("## 📖 Instructions")
    st.markdown("""
    ### Required Fields:
    - **Make & Model**: Select from dropdown
    - **Year**: 2000-2025
    - **Mileage**: 0-500,000 km
    - **Engine Size**: 0.5-10.0 L
    - **Cylinders**: 2-12
    - **Condition**: Select quality level
    - **Fuel Type**: Choose fuel type
    - **Location**: Select location
    
    ### Validation:
    - All fields must be valid
    - Make and model must exist in dataset
    - Values must be within acceptable ranges
    """)

# ============================================================================
# MAIN TABS
# ============================================================================
tab1, tab2, tab3 = st.tabs([f"🚗 {t('predict')}", f"📊 {t('data')}", f"ℹ️ {t('about')}"])

# ============================================================================
# TAB 1: PREDICTION
# ============================================================================
with tab1:
    if not st.session_state.model_loaded:
        st.error("⚠️ Model not loaded. Please ensure model_training.py has been run.")
    else:
        pred_tab1, pred_tab2, pred_tab3 = st.tabs([t("single"), t("batch"), t("compare")])
        
        with pred_tab1:
            df = st.session_state.df
            
            # Cache dropdown options in session state to avoid recomputing
            if 'dropdown_options' not in st.session_state:
                st.session_state.dropdown_options = {
                    'makes': sorted(df['make'].dropna().unique().tolist()),
                    'fuel_types': sorted(df['fuel_type'].dropna().unique().tolist()),
                    'locations': sorted(df['location'].dropna().unique().tolist()),
                    'conditions': ['New', 'Like New', 'Excellent', 'Good', 'Fair', 'Poor']
                }
            
            makes = st.session_state.dropdown_options['makes']
            fuel_types = st.session_state.dropdown_options['fuel_types']
            locations = st.session_state.dropdown_options['locations']
            conditions = st.session_state.dropdown_options['conditions']
            
            # Initialize session state for dropdown values (for mobile cascading dropdowns)
            if 'selected_make' not in st.session_state:
                st.session_state.selected_make = None
            if 'selected_model' not in st.session_state:
                st.session_state.selected_model = None
            if 'selected_engine_size' not in st.session_state:
                st.session_state.selected_engine_size = None
            if 'selected_trim' not in st.session_state:
                st.session_state.selected_trim = None
            if 'selected_fuel_type' not in st.session_state:
                st.session_state.selected_fuel_type = None
            if 'selected_location' not in st.session_state:
                st.session_state.selected_location = None
            
            # Initialize counters for unique keys (forces Streamlit to recreate selectboxes on mobile)
            if 'make_counter' not in st.session_state:
                st.session_state.make_counter = 0
            if 'model_counter' not in st.session_state:
                st.session_state.model_counter = 0
            if 'engine_counter' not in st.session_state:
                st.session_state.engine_counter = 0
            
            # Handle form reset - clear all dropdown session state values and reset counters
            if st.session_state.form_reset:
                st.session_state.selected_make = None
                st.session_state.selected_model = None
                st.session_state.selected_engine_size = None
                st.session_state.selected_trim = None
                st.session_state.selected_fuel_type = None
                st.session_state.selected_location = None
                st.session_state.make_counter = 0
                st.session_state.model_counter = 0
                st.session_state.engine_counter = 0
                st.session_state.form_reset = False
            
            # Callback functions for selectbox on_change events
            def on_make_change():
                """Callback when Make dropdown changes - increment counter and reset dependent dropdowns"""
                # Increment make_counter to force Model selectbox recreation
                st.session_state.make_counter = st.session_state.get('make_counter', 0) + 1
                # Reset dependent dropdowns when make changes
                st.session_state.selected_model = None
                st.session_state.selected_engine_size = None
                st.session_state.selected_trim = None
                # Reset model_counter since Model selectbox will be recreated
                st.session_state.model_counter = 0
            
            def on_model_change():
                """Callback when Model dropdown changes - increment counter and reset dependent dropdowns"""
                # Increment model_counter to force Engine Size selectbox recreation
                st.session_state.model_counter = st.session_state.get('model_counter', 0) + 1
                # Reset dependent dropdowns when model changes
                st.session_state.selected_engine_size = None
                st.session_state.selected_trim = None
                # Reset engine_counter since Engine Size selectbox will be recreated
                st.session_state.engine_counter = 0
            
            def on_engine_size_change():
                """Callback when Engine Size dropdown changes - increment counter"""
                # Increment engine_counter to force selectbox recreation if needed
                st.session_state.engine_counter = st.session_state.get('engine_counter', 0) + 1
            
            def on_trim_change():
                """Callback when Trim dropdown changes"""
                pass  # Trim doesn't affect other dropdowns
            
            def on_fuel_type_change():
                """Callback when Fuel Type dropdown changes"""
                pass  # Fuel type doesn't affect other dropdowns
            
            def on_location_change():
                """Callback when Location dropdown changes"""
                pass  # Location doesn't affect other dropdowns
            
            # Try Sample Car button - placed before inputs
            col_btn1, col_btn2 = st.columns([1, 1])
            with col_btn1:
                if st.button(f"🎯 {t('try_sample_car')}", use_container_width=True, help="Pre-fill form with example car data"):
                    # Get sample car data from dataset if available
                    if st.session_state.data_loaded and st.session_state.df is not None:
                        df = st.session_state.df
                        # Find a common car (e.g., Toyota Camry or similar)
                        sample_cars = df[
                            (df['year'] >= 2018) & 
                            (df['year'] <= 2022) &
                            (df['mileage'] >= 20000) &
                            (df['mileage'] <= 50000)
                        ]
                        if len(sample_cars) > 0:
                            sample = sample_cars.iloc[0]
                            st.session_state.sample_car_data = {
                                'make': sample.get('make', 'Toyota'),
                                'model': sample.get('model', 'Camry'),
                                'year': int(sample.get('year', 2020)),
                                'mileage': int(sample.get('mileage', 30000)),
                                'engine_size': float(sample.get('engine_size', 2.5)),
                                'cylinders': int(sample.get('cylinders', 4)),
                                'condition': sample.get('condition', 'Good'),
                                'fuel_type': sample.get('fuel_type', 'Gasoline'),
                                'location': sample.get('location', locations[0] if locations else 'Unknown'),
                                'trim': sample.get('trim', None) if 'trim' in sample.index else None
                            }
                        else:
                            # Fallback sample data
                            st.session_state.sample_car_data = {
                                'make': 'Toyota',
                                'model': 'Camry',
                                'year': 2020,
                                'mileage': 30000,
                                'engine_size': 2.5,
                                'cylinders': 4,
                                'condition': 'Good',
                                'fuel_type': 'Gasoline',
                                'location': locations[0] if locations else 'Unknown',
                                'trim': None
                            }
                        # Update session state dropdown values from sample data
                        st.session_state.selected_make = st.session_state.sample_car_data.get('make')
                        st.session_state.selected_model = st.session_state.sample_car_data.get('model')
                        st.session_state.selected_engine_size = st.session_state.sample_car_data.get('engine_size')
                        st.session_state.selected_trim = st.session_state.sample_car_data.get('trim')
                        st.session_state.selected_fuel_type = st.session_state.sample_car_data.get('fuel_type')
                        st.session_state.selected_location = st.session_state.sample_car_data.get('location')
                        st.session_state.sample_car_loaded = True
                        # Use a session state flag to show success message at top on next rerun
                        st.session_state.show_sample_success = True
                        # Streamlit will automatically rerun on button click
                        # The success message will be shown at the top on the next render
                    else:
                        st.error("Data not loaded. Please wait for data to load.")
            
            with col_btn2:
                if st.button(f"🔄 {t('clear_form')}", use_container_width=True, help="Clear all inputs"):
                    st.session_state.sample_car_loaded = False
                    st.session_state.sample_car_data = None
                    st.session_state.form_reset = True
                    # Don't call st.rerun() - Streamlit will rerun automatically on button click
            
            st.markdown("---")
            
            # iOS Detection and Banner
            is_ios = add_ios_detection_component()
            if is_ios:
                st.info("📱 **iOS User?** Tap the Make dropdown, select your option, then tap anywhere outside the dropdown before selecting Model. This helps iOS Safari refresh properly.")
            
            # Organize inputs - Responsive: 3 columns on desktop, 1 on mobile
            # Use CSS to handle mobile stacking automatically
            col1, col2, col3 = st.columns([1, 1, 1])
            
            # Get sample car data if available
            sample_data = st.session_state.sample_car_data if st.session_state.sample_car_loaded else None
            
            with col1:
                st.markdown('<div class="form-section">', unsafe_allow_html=True)
                st.markdown(f'<div class="form-section-title">🚗 {t("basic_information")}</div>', unsafe_allow_html=True)
                
                if not makes:
                    st.error("No makes found in dataset")
                    make = "Unknown"
                else:
                    # Calculate index from session state or sample data
                    make_idx = 0
                    if sample_data and sample_data.get('make') in makes:
                        make_idx = makes.index(sample_data.get('make'))
                    elif st.session_state.selected_make and st.session_state.selected_make in makes:
                        make_idx = makes.index(st.session_state.selected_make)
                    elif 'Toyota' in makes:
                        make_idx = makes.index('Toyota')
                    
                    # Use unique key 'make' (no counter needed for top-level dropdown)
                    st.markdown('<span class="field-importance most-important">Most Important</span>', unsafe_allow_html=True)
                    make = st.selectbox(
                        f"🚗 {t('make')}", 
                        makes, 
                        index=make_idx,
                        help="Select the car manufacturer/brand (e.g., Toyota, Honda, Ford). This affects the price prediction significantly.", 
                        key="make",
                        on_change=on_make_change
                    )
                    st.markdown('<p class="helper-text">The manufacturer significantly impacts price prediction accuracy.</p>', unsafe_allow_html=True)
                    # Update session state
                    st.session_state.selected_make = make
                    
                    # Add refresh link button after Make dropdown
                    create_refresh_link_button("make")
                
                # Use session state make for filtering (more reliable on mobile)
                make_for_filter = st.session_state.selected_make if st.session_state.selected_make else make
                if make_for_filter and make_for_filter != "Unknown":
                    models = sorted(df[df['make'] == make_for_filter]['model'].dropna().unique().tolist())
                else:
                    models = []
                
                if not models:
                    st.warning("No models found for selected make")
                    model = "Unknown"
                else:
                    # Calculate index from session state or sample data
                    model_idx = 0
                    if sample_data and sample_data.get('model') in models:
                        model_idx = models.index(sample_data.get('model'))
                    elif st.session_state.selected_model and st.session_state.selected_model in models:
                        model_idx = models.index(st.session_state.selected_model)
                    
                    # Use unique key with make_counter to force recreation when Make changes
                    model_key = f'model_{st.session_state.get("make_counter", 0)}'
                    st.markdown('<span class="field-importance most-important">Most Important</span>', unsafe_allow_html=True)
                    model = st.selectbox(
                        f"🚙 {t('model_label')}", 
                        models, 
                        index=model_idx,
                        help="Select the specific car model (e.g., Camry, Accord, F-150). Available models depend on the selected make.", 
                        key=model_key,
                        on_change=on_model_change
                    )
                    st.markdown('<p class="helper-text">Choose the exact model for precise pricing.</p>', unsafe_allow_html=True)
                    # Update session state
                    st.session_state.selected_model = model
                    
                    # Add refresh link button after Model dropdown
                    create_refresh_link_button("model")
                
                # Show helpful info message when both Make and Model are selected
                if make and make != "Unknown" and model and model != "Unknown":
                    st.info(f"✨ Showing options available for **{make} {model}**")
                
                # Use sample data for year if available
                default_year = sample_data.get('year', 2020) if sample_data else 2020
                st.markdown('<span class="field-importance important">Important</span>', unsafe_allow_html=True)
                year = st.slider(f"📅 {t('year')}", min_value=2000, max_value=2025, value=default_year, step=1,
                               help="Select the manufacturing year of the vehicle (2000-2025). Newer cars typically have higher values. Use the slider or type directly.", key="year_input")
                st.markdown('<p class="helper-text">Newer vehicles typically command higher prices.</p>', unsafe_allow_html=True)
                
                # Use sample data for mileage if available
                default_mileage = sample_data.get('mileage', 30000) if sample_data else 30000
                st.markdown('<span class="field-importance important">Important</span>', unsafe_allow_html=True)
                mileage = st.number_input(f"🛣️ {t('mileage_km')}", min_value=0, max_value=500000, value=default_mileage, step=1000,
                                        help="Enter the total distance the vehicle has traveled in kilometers (0-500,000 km). Lower mileage generally increases value. You can use the +/- buttons or type directly.", key="mileage_input")
                st.markdown('<p class="helper-text">Lower mileage generally increases market value.</p>', unsafe_allow_html=True)
                
                st.markdown('</div>', unsafe_allow_html=True)
                
            with col2:
                st.markdown('<div class="form-section">', unsafe_allow_html=True)
                st.markdown(f'<div class="form-section-title">⚙️ {t("technical_specs")}</div>', unsafe_allow_html=True)
                
                # Dynamic Engine Size - Filter based on Make and Model (use session state for reliability)
                available_engine_sizes = []
                make_for_filter = st.session_state.selected_make if st.session_state.selected_make else make
                model_for_filter = st.session_state.selected_model if st.session_state.selected_model else model
                
                if make_for_filter and make_for_filter != "Unknown" and model_for_filter and model_for_filter != "Unknown":
                    # Filter by both make and model
                    filtered_df = df[(df['make'] == make_for_filter) & (df['model'] == model_for_filter)]
                    if len(filtered_df) > 0:
                        available_engine_sizes = sorted(filtered_df['engine_size'].dropna().unique().tolist())
                elif make_for_filter and make_for_filter != "Unknown":
                    # Filter by make only
                    filtered_df = df[df['make'] == make_for_filter]
                    if len(filtered_df) > 0:
                        available_engine_sizes = sorted(filtered_df['engine_size'].dropna().unique().tolist())
                else:
                    # Show all engine sizes if no make selected
                    available_engine_sizes = sorted(df['engine_size'].dropna().unique().tolist())
                
                # Convert to strings for display, then back to float for value
                if available_engine_sizes:
                    engine_size_options = [f"{size:.1f}L" for size in available_engine_sizes]
                    engine_size_values = available_engine_sizes
                    
                    # Calculate index from session state or sample data
                    engine_size_idx = 0
                    if sample_data:
                        sample_engine = sample_data.get('engine_size')
                        if sample_engine in engine_size_values:
                            engine_size_idx = engine_size_values.index(sample_engine)
                    elif st.session_state.selected_engine_size and st.session_state.selected_engine_size in engine_size_values:
                        engine_size_idx = engine_size_values.index(st.session_state.selected_engine_size)
                    
                    # Use unique key with model_counter to force recreation when Model changes
                    engine_key = f'engine_{st.session_state.get("model_counter", 0)}'
                    st.markdown('<span class="field-importance important">Important</span>', unsafe_allow_html=True)
                    selected_engine_display = st.selectbox(
                        f"🔧 {t('engine_size_l')}",
                        options=engine_size_options,
                        index=engine_size_idx,
                        help=f"Select engine size available for {make_for_filter} {model_for_filter if model_for_filter != 'Unknown' else 'selected make'}. Options are filtered based on your selection.",
                        key=engine_key,
                        on_change=on_engine_size_change
                    )
                    st.markdown('<p class="helper-text">Engine size affects performance and value.</p>', unsafe_allow_html=True)
                    # Get the actual float value
                    engine_size = engine_size_values[engine_size_options.index(selected_engine_display)]
                    # Update session state
                    st.session_state.selected_engine_size = engine_size
                    
                    # Add refresh link button after Engine Size dropdown
                    create_refresh_link_button("engine")
                else:
                    st.warning("⚠️ No engine sizes found for selected make/model. Please select a valid combination.")
                    engine_size = 2.5  # Default fallback
                
                # Trim field - Filter based on Make + Model (use session state for reliability)
                available_trims = []
                
                if make_for_filter and make_for_filter != "Unknown" and model_for_filter and model_for_filter != "Unknown":
                    filtered_df = df[(df['make'] == make_for_filter) & (df['model'] == model_for_filter)]
                    if len(filtered_df) > 0 and 'trim' in filtered_df.columns:
                        available_trims = sorted(filtered_df['trim'].dropna().unique().tolist())
                
                if available_trims:
                    # Calculate index from session state or sample data
                    trim_idx = 0
                    if sample_data and sample_data.get('trim') in available_trims:
                        trim_idx = available_trims.index(sample_data.get('trim'))
                    elif st.session_state.selected_trim and st.session_state.selected_trim in available_trims:
                        trim_idx = available_trims.index(st.session_state.selected_trim)
                    
                    st.markdown('<span class="field-importance optional">Optional</span>', unsafe_allow_html=True)
                    trim = st.selectbox(
                        "🎨 Trim",
                        options=available_trims,
                        index=trim_idx,
                        help=f"Select the trim level for {make_for_filter} {model_for_filter}. Trim levels represent different equipment packages and features.",
                        key="trim_input",
                        on_change=on_trim_change
                    )
                    st.markdown('<p class="helper-text">Refines pricing for specific equipment packages.</p>', unsafe_allow_html=True)
                    # Update session state
                    st.session_state.selected_trim = trim
                else:
                    # Don't show trim if no make/model selected or no trims available
                    trim = None
                    if make_for_filter != "Unknown" and model_for_filter != "Unknown":
                        st.info("ℹ️ No trim information available for this make/model combination.")
                
                # Use sample data for cylinders if available
                default_cylinders = sample_data.get('cylinders', 4) if sample_data else 4
                st.markdown('<span class="field-importance important">Important</span>', unsafe_allow_html=True)
                cylinders = st.slider(f"⚡ {t('cylinders')}", min_value=2, max_value=12, value=default_cylinders, step=1,
                                     help="Select the number of engine cylinders (2-12). Common values: 4 cylinders (most cars), 6 cylinders (mid-size), 8+ cylinders (performance/luxury). More cylinders often indicate higher performance and value.", key="cylinders_input")
                st.markdown('<p class="helper-text">More cylinders typically indicate higher performance.</p>', unsafe_allow_html=True)
                
                # Translate condition options
                condition_options = [t("new"), t("like_new"), t("excellent"), t("good"), t("fair"), t("poor")]
                condition_map = {
                    t("new"): "New",
                    t("like_new"): "Like New",
                    t("excellent"): "Excellent",
                    t("good"): "Good",
                    t("fair"): "Fair",
                    t("poor"): "Poor"
                }
                
                # Use sample data for condition if available
                default_condition_idx = 3  # Default to "Good"
                if sample_data:
                    sample_condition = sample_data.get('condition', 'Good')
                    for idx, (key, val) in enumerate(condition_map.items()):
                        if val == sample_condition:
                            default_condition_idx = idx
                            break
                
                st.markdown('<span class="field-importance most-important">Most Important</span>', unsafe_allow_html=True)
                condition_display = st.radio(f"✨ {t('condition')}", condition_options, index=default_condition_idx,
                                   help="Select the overall condition of the vehicle: New (never used), Like New (minimal wear), Excellent (very good), Good (normal wear), Fair (some issues), Poor (significant problems). Condition significantly affects price.", key="condition_input")
                condition = condition_map.get(condition_display, "Good")
                st.markdown('<p class="helper-text">Vehicle condition has a major impact on price.</p>', unsafe_allow_html=True)
                
                st.markdown('</div>', unsafe_allow_html=True)
            
            with col3:
                st.markdown('<div class="form-section">', unsafe_allow_html=True)
                st.markdown(f'<div class="form-section-title">📍 {t("condition_location")}</div>', unsafe_allow_html=True)
                
                # Calculate index from session state or sample data
                fuel_type_idx = 0
                if sample_data and sample_data.get('fuel_type') in fuel_types:
                    fuel_type_idx = fuel_types.index(sample_data.get('fuel_type'))
                elif st.session_state.selected_fuel_type and st.session_state.selected_fuel_type in fuel_types:
                    fuel_type_idx = fuel_types.index(st.session_state.selected_fuel_type)
                elif 'Gasoline' in fuel_types:
                    fuel_type_idx = fuel_types.index('Gasoline')
                
                st.markdown('<span class="field-importance important">Important</span>', unsafe_allow_html=True)
                fuel_type = st.selectbox(
                    f"⛽ {t('fuel_type')}", 
                    fuel_types, 
                    index=fuel_type_idx,
                    help="Select the type of fuel the vehicle uses (e.g., Gasoline, Diesel, Electric, Hybrid). Fuel type affects both operating costs and resale value.", 
                    key="fuel_type_input",
                    on_change=on_fuel_type_change
                )
                # Update session state
                st.session_state.selected_fuel_type = fuel_type
                st.markdown('<p class="helper-text">Fuel type influences market demand and value.</p>', unsafe_allow_html=True)
                
                # Calculate index from session state or sample data
                location_idx = 0
                if sample_data and sample_data.get('location') in locations:
                    location_idx = locations.index(sample_data.get('location'))
                elif st.session_state.selected_location and st.session_state.selected_location in locations:
                    location_idx = locations.index(st.session_state.selected_location)
                
                st.markdown('<span class="field-importance optional">Optional</span>', unsafe_allow_html=True)
                location = st.selectbox(
                    f"🌍 {t('location')}", 
                    locations, 
                    index=location_idx,
                    help="Select the geographic location where the vehicle is located. Location affects market prices due to regional demand, climate, and local market conditions.", 
                    key="location_input",
                    on_change=on_location_change
                )
                # Update session state
                st.session_state.selected_location = location
                st.markdown('<p class="helper-text">Regional markets can vary in pricing.</p>', unsafe_allow_html=True)
                
                st.markdown('</div>', unsafe_allow_html=True)
            
            # Predict button - PRIMARY ACTION - Prominent placement
            st.markdown("<br>", unsafe_allow_html=True)
            st.markdown('<div class="predict-button-container">', unsafe_allow_html=True)
            predict_button = st.button(f"🚀 {t('predict_price')}", type="primary", use_container_width=True, 
                                      help="Click to get your AI-powered price prediction")
            st.markdown('</div>', unsafe_allow_html=True)
            st.markdown("<br>", unsafe_allow_html=True)
            
            # Results column
            col1, col2 = st.columns([1, 2])
            
            
            with col2:
                st.markdown(f'<div class="chart-title">{t("prediction_results")}</div>', unsafe_allow_html=True)
                
                if predict_button:
                    # Enhanced input validation with detailed error messages
                    validation_errors = []
                    
                    # Validate make and model
                    if make == "Unknown" or not make:
                        validation_errors.append("❌ **Make**: Please select a valid car manufacturer from the dropdown.")
                    if model == "Unknown" or not model:
                        validation_errors.append("❌ **Model**: Please select a valid car model. Make sure the make is selected first.")
                    
                    # Validate year
                    if year < 2000 or year > 2025:
                        validation_errors.append(f"❌ **Year**: Year must be between 2000 and 2025. You entered: {year}")
                    
                    # Validate mileage
                    if mileage < 0:
                        validation_errors.append("❌ **Mileage**: Mileage cannot be negative. Please enter a positive number.")
                    elif mileage > 500000:
                        validation_errors.append(f"❌ **Mileage**: Mileage seems unusually high ({mileage:,} km). Please verify the value.")
                    
                    # Validate engine size (now from selectbox, so should always be valid, but check anyway)
                    if engine_size is None or engine_size <= 0:
                        validation_errors.append("❌ **Engine Size**: Please select a valid engine size from the dropdown.")
                    elif engine_size > 10.0:
                        validation_errors.append(f"❌ **Engine Size**: Engine size seems unusually large ({engine_size}L). Please verify the value.")
                    
                    # Validate cylinders
                    if cylinders < 2:
                        validation_errors.append("❌ **Cylinders**: Number of cylinders must be at least 2.")
                    elif cylinders > 12:
                        validation_errors.append(f"❌ **Cylinders**: Number of cylinders seems unusually high ({cylinders}). Please verify the value.")
                    
                    # Validate condition
                    if not condition or condition not in ['New', 'Like New', 'Excellent', 'Good', 'Fair', 'Poor']:
                        validation_errors.append("❌ **Condition**: Please select a valid condition.")
                    
                    # Validate fuel type
                    if not fuel_type or fuel_type not in fuel_types:
                        validation_errors.append("❌ **Fuel Type**: Please select a valid fuel type.")
                    
                    # Validate location
                    if not location or location not in locations:
                        validation_errors.append("❌ **Location**: Please select a valid location.")
                    
                    # Display validation errors if any
                    if validation_errors:
                        st.error("**Input Validation Failed:**")
                        for error in validation_errors:
                            st.error(error)
                        st.info("💡 Please correct the errors above and try again.")
                    else:
                        try:
                            car_data = {
                                'year': year,
                                'mileage': mileage,
                                'engine_size': engine_size,
                                'cylinders': cylinders,
                                'make': make,
                                'model': model,
                                'condition': condition,
                                'fuel_type': fuel_type,
                                'location': location
                            }
                            # Add trim if available
                            if trim:
                                car_data['trim'] = trim
                            
                            # Loading animation - Enhanced with premium styling
                            with st.spinner("🔮 Analyzing market data and predicting price..."):
                                price, confidence = predict_price(car_data, return_confidence=True)
                                
                                # Extract values and convert to Python float (fix JSON serialization)
                                predicted_price = float(price[0] if isinstance(price, np.ndarray) else price)
                                lower_ci_raw = confidence['lower_95'][0] if isinstance(confidence['lower_95'], np.ndarray) else confidence['lower_95']
                                upper_ci_raw = confidence['upper_95'][0] if isinstance(confidence['upper_95'], np.ndarray) else confidence['upper_95']
                                lower_ci = float(lower_ci_raw)
                                upper_ci = float(upper_ci_raw)
                                
                                # BUG FIX 1: Handle negative prices - use abs() as requested
                                if predicted_price < 0:
                                    predicted_price = abs(predicted_price)
                                    st.warning("⚠️ Prediction was negative. Using absolute value. Please verify input data matches training data.")
                                
                                # CRITICAL: Aggressive warning for predictions < $100
                                if predicted_price < 100:
                                    st.error(f"❌ CRITICAL: Prediction is extremely low: ${predicted_price:,.2f}")
                                    st.error("This indicates a serious problem with the model or input data.")
                                    st.error("**Immediate Action Required:**")
                                    st.error("  1. **Model needs retraining** - Run `python model_training.py`")
                                    st.error("  2. Model may be missing required features (price_per_km was removed)")
                                    st.error("  3. Model file may be corrupted or missing transformation flags")
                                    st.error("  4. Input data may not match training data format")
                                    st.error("")
                                    st.warning("⚠️ **The model file may be from before the data leakage fix.**")
                                    st.warning("⚠️ **You MUST retrain the model after removing price_per_km feature.**")
                                    st.info("🔧 **Fix:** Run `python model_training.py` to retrain the model")
                                    st.info("This will create a new model file without the data leakage feature")
                                # Warning for predictions < $1000 (less critical but still concerning)
                                elif predicted_price < 1000:
                                    st.warning(f"⚠️ Prediction seems unusually low: ${predicted_price:,.2f}. This may indicate:")
                                    st.warning("  - Model needs retraining")
                                    st.warning("  - Input data doesn't match training data")
                                    st.warning("  - Model file may be corrupted")
                                    st.info("💡 Try: `python model_training.py` to retrain the model")
                                
                                # Only apply absolute minimum if prediction is negative or zero
                                if predicted_price <= 0:
                                    predicted_price = 1.0
                                    st.error("❌ Prediction is zero or negative. Please check the model and input data.")
                                
                                # Ensure confidence intervals are reasonable
                                if lower_ci < 0:
                                    lower_ci = max(0.0, predicted_price * 0.5)
                                if upper_ci < predicted_price:
                                    upper_ci = max(predicted_price * 1.1, upper_ci)
                            
                            # Display prediction - HERO VISUAL ELEMENT
                            st.markdown(f"""
                            <div class="prediction-box-premium">
                                <div class="price-label-premium">Estimated Market Value</div>
                                <div class="price-display-premium">${predicted_price:,.2f}</div>
                                <div class="confidence-interval-premium">
                                    95% Confidence: ${lower_ci:,.2f} - ${upper_ci:,.2f}
                                </div>
                            </div>
                            """, unsafe_allow_html=True)
                            
                            # Emotional feedback badges
                            confidence_pct = ((upper_ci - lower_ci) / predicted_price * 100) if predicted_price > 0 else 0
                            feedback_badges = []
                            
                            # Confidence level feedback
                            if confidence_pct < 10:
                                feedback_badges.append('<span class="feedback-badge positive">High Confidence</span>')
                            elif confidence_pct < 20:
                                feedback_badges.append('<span class="feedback-badge neutral">Moderate Confidence</span>')
                            else:
                                feedback_badges.append('<span class="feedback-badge warning">Wide Range</span>')
                            
                            # Market comparison feedback (will be added after market comparison)
                            
                            if feedback_badges:
                                st.markdown(f'<div style="margin-top: 12px;">{"".join(feedback_badges)}</div>', unsafe_allow_html=True)
                            
                            # Secondary metrics - compact layout
                            col_conf1, col_conf2 = st.columns(2)
                            with col_conf1:
                                confidence_range = upper_ci - lower_ci
                                st.metric(
                                    label="Confidence Range",
                                    value=f"±${confidence_range/2:,.0f}",
                                    help="The prediction range where the actual price is likely to fall (95% confidence)"
                                )
                            with col_conf2:
                                st.metric(
                                    label="Precision",
                                    value=f"±{confidence_pct:.1f}%",
                                    help="Percentage variation in the confidence interval"
                                )
                            
                            st.success(f"✅ {t('prediction_success')}")
                            st.balloons()  # Celebrate successful prediction!
                            
                            # Add subtle spacing after prediction
                            st.markdown("<br>", unsafe_allow_html=True)
                            
                            # Market comparison
                            if st.session_state.data_loaded and st.session_state.df is not None:
                                df = st.session_state.df
                                
                                # Ensure predicted_price is properly used (not hardcoded value)
                                # Fix: Make sure we're using the actual predicted price, not a default
                                your_car_price = float(predicted_price)  # Explicitly use predicted price
                                
                                # Additional validation - only skip market comparison if price is truly invalid
                                # Allow prices >= 100 to show comparison even if they seem low
                                if your_car_price <= 0:
                                    st.error(f"⚠️ Market comparison cannot be shown - predicted price is invalid: ${your_car_price:,.2f}")
                                    st.error("Please restart Streamlit to load the new model: Stop the app (Ctrl+C) and run `streamlit run app.py` again")
                                    your_car_price = 0  # Set to 0 to avoid division errors
                                elif your_car_price < 100:
                                    # Price is low but not zero - still show comparison with warning
                                    st.warning(f"⚠️ Prediction seems low (${your_car_price:,.2f}) but showing comparison anyway")
                                    st.info("💡 If this seems wrong, restart Streamlit to clear cache: Stop app (Ctrl+C) and restart")
                                
                                market_avg = float(df['price'].mean())
                                market_median = float(df['price'].median())
                                
                                diff_from_avg = your_car_price - market_avg
                                diff_pct = (diff_from_avg / market_avg) * 100 if market_avg > 0 else 0.0
                                
                                # Market comparison feedback
                                market_feedback = ""
                                if diff_pct > 15:
                                    market_feedback = '<span class="feedback-badge positive">Above Market</span>'
                                elif diff_pct > 5:
                                    market_feedback = '<span class="feedback-badge positive">Above Average</span>'
                                elif diff_pct < -15:
                                    market_feedback = '<span class="feedback-badge warning">Below Market</span>'
                                elif diff_pct < -5:
                                    market_feedback = '<span class="feedback-badge neutral">Below Average</span>'
                                else:
                                    market_feedback = '<span class="feedback-badge neutral">Market Average</span>'
                                
                                st.markdown(f'<div class="chart-title" style="margin-top: 32px;">{t("market_comparison")}</div>', unsafe_allow_html=True)
                                
                                # Show market feedback badge
                                if market_feedback:
                                    st.markdown(f'<div style="margin-bottom: 16px;">{market_feedback}</div>', unsafe_allow_html=True)
                                
                                col_m1, col_m2, col_m3 = st.columns(3)
                                with col_m1:
                                    st.markdown('<div class="market-comparison-card">', unsafe_allow_html=True)
                                    st.metric(t("your_car"), f"${your_car_price:,.0f}", 
                                            help=f"Predicted price: ${your_car_price:,.2f}")
                                    st.markdown('</div>', unsafe_allow_html=True)
                                with col_m2:
                                    st.markdown('<div class="market-comparison-card">', unsafe_allow_html=True)
                                    st.metric(t("market_average"), f"${market_avg:,.0f}")
                                    st.markdown('</div>', unsafe_allow_html=True)
                                with col_m3:
                                    st.markdown('<div class="market-comparison-card">', unsafe_allow_html=True)
                                    st.metric(t("difference"), f"{diff_pct:+.1f}%", 
                                            delta=f"${diff_from_avg:,.0f}")
                                    st.markdown('</div>', unsafe_allow_html=True)
                                
                                # Explain wide range if applicable
                                if confidence_pct >= 20:
                                    st.info("💡 **Wide Range Explained:** This prediction has a broader confidence interval, which may indicate less historical data for similar vehicles or higher market variability for this make/model combination.")
                            
                            # Store prediction (BUG FIX 2: Convert all numpy types to Python float for JSON serialization)
                            prediction_record = {
                                'timestamp': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'),
                                'make': str(make),
                                'model': str(model),
                                'year': int(year),
                                'mileage': to_python_float(mileage),
                                'condition': str(condition),
                                'fuel_type': str(fuel_type),
                                'engine_size': to_python_float(engine_size),
                                'cylinders': int(cylinders),
                                'location': str(location),
                                'predicted_price': to_python_float(predicted_price),
                                'lower_ci': to_python_float(lower_ci),
                                'upper_ci': to_python_float(upper_ci)
                            }
                            # Add trim if available
                            if trim:
                                prediction_record['trim'] = str(trim)
                            st.session_state.predictions_history.append(prediction_record)
                            
                            # Export and Share buttons - Progressive disclosure
                            with st.expander("💾 Export & Share Results", expanded=False):
                                col_exp1, col_exp2, col_exp3 = st.columns(3)
                                with col_exp1:
                                    export_df = pd.DataFrame([prediction_record])
                                    csv = export_df.to_csv(index=False)
                                    st.download_button(
                                        label="📥 CSV",
                                        data=csv,
                                        file_name=f"prediction_{make}_{model}_{year}.csv",
                                        mime="text/csv"
                                    )
                                with col_exp2:
                                    json_str = json.dumps(prediction_record, indent=2)
                                    st.download_button(
                                        label="📥 JSON",
                                        data=json_str,
                                        file_name=f"prediction_{make}_{model}_{year}.json",
                                        mime="application/json"
                                    )
                                with col_exp3:
                                    # Simple Share button that works immediately
                                    if st.button(f"📋 {t('share_prediction')}", use_container_width=True):
                                        share_text = f"Car: {make} {model} | Year: {year} | Predicted Price: ${predicted_price:,.0f}"
                                        st.text_area("Copy this to share:", share_text, height=100, key="share_text_area")
                                        st.info("✅ Text ready to copy! Select all and press Ctrl+C")
                            
                            # Similar cars - Progressive disclosure with expander
                            with st.expander(f"🔍 {t('similar_cars')} - Compare with Market Data", expanded=False):
                                try:
                                    if st.session_state.data_loaded and st.session_state.df is not None:
                                        df = st.session_state.df
                                        similar_cars = df[
                                            (df['make'] == make) & 
                                            (df['model'] == model) &
                                            (df['year'] >= year - 2) &
                                            (df['year'] <= year + 2) &
                                            (abs(df['mileage'] - mileage) <= mileage * 0.3)
                                        ].head(10)
                                        
                                    if len(similar_cars) > 0:
                                        similar_cars_display = similar_cars[['year', 'mileage', 'condition', 'price']].copy()
                                        similar_cars_display.columns = ['Year', 'Mileage (km)', 'Condition', 'Price ($)']
                                        similar_cars_display['Price ($)'] = similar_cars_display['Price ($)'].apply(lambda x: f"${x:,.2f}")
                                        # Limit display to top 10 for performance
                                        st.dataframe(similar_cars_display.head(10), use_container_width=True, hide_index=True)
                                        if len(similar_cars) > 10:
                                            st.caption(f"Showing top 10 of {len(similar_cars)} similar cars")
                                    else:
                                        st.info("No similar cars found in the dataset.")
                                except Exception as e:
                                    st.warning(f"Could not load similar cars: {e}")
                            
                        except Exception as e:
                            st.error(f"❌ Error making prediction: {e}")
                            st.exception(e)
        
        # Batch and Compare tabs (keeping existing functionality)
        with pred_tab2:
            st.markdown(f'<div class="chart-title">{t("batch_prediction")}</div>', unsafe_allow_html=True)
            st.info(t("upload_csv"))
            
            uploaded_file = st.file_uploader("Choose CSV file", type=['csv'], 
                                            help="CSV should have columns: make, model, year, mileage, condition, fuel_type, engine_size, cylinders, location")
            
            if uploaded_file is not None:
                try:
                    batch_df = pd.read_csv(uploaded_file)
                    st.success(f"✅ Loaded {len(batch_df)} cars from file")
                    
                    required_cols = ['make', 'model', 'year', 'mileage', 'condition', 'fuel_type', 'engine_size', 'cylinders', 'location']
                    missing_cols = [col for col in required_cols if col not in batch_df.columns]
                    
                    if missing_cols:
                        st.error(f"❌ Missing required columns: {', '.join(missing_cols)}")
                    else:
                        if st.button(f"🚀 {t('predict_all_prices')}", type="primary"):
                            with st.spinner("Processing batch predictions..."):
                                progress_bar = st.progress(0)
                            predictions_list = []
                            errors = []
                            
                            for idx, row in batch_df.iterrows():
                                try:
                                    car_data = row.to_dict()
                                    price, confidence = predict_price(car_data, return_confidence=True)
                                    
                                    # Extract and convert to Python float
                                    pred_price_raw = price[0] if isinstance(price, np.ndarray) else price
                                    pred_price = float(pred_price_raw)
                                    
                                    lower_raw = confidence['lower_95'][0] if isinstance(confidence['lower_95'], np.ndarray) else confidence['lower_95']
                                    upper_raw = confidence['upper_95'][0] if isinstance(confidence['upper_95'], np.ndarray) else confidence['upper_95']
                                    lower = float(lower_raw)
                                    upper = float(upper_raw)
                                    
                                    # BUG FIX 1: Handle negative prices
                                    if pred_price < 0:
                                        pred_price = abs(pred_price)
                                    
                                    # CRITICAL: Aggressive warning for predictions < $100
                                    if pred_price < 100:
                                        errors.append(f"Row {idx+1}: CRITICAL - Prediction ${pred_price:,.2f} is extremely low. Model may need retraining.")
                                    
                                    # Ensure minimum reasonable price
                                    if pred_price < 1.0:
                                        pred_price = max(1.0, pred_price)
                                    if lower < 0:
                                        lower = max(0.0, pred_price * 0.5)
                                    if upper < pred_price:
                                        upper = max(pred_price * 1.1, upper)
                                    
                                    # BUG FIX 2: Convert all to Python native types for JSON serialization
                                    predictions_list.append({
                                        'make': str(car_data.get('make', '')),
                                        'model': str(car_data.get('model', '')),
                                        'year': int(car_data.get('year', 0)),
                                        'mileage': to_python_float(car_data.get('mileage', 0)),
                                        'predicted_price': to_python_float(pred_price),
                                        'lower_95_ci': to_python_float(lower),
                                        'upper_95_ci': to_python_float(upper)
                                    })
                                    # Update progress every 10 rows for better performance
                                    if (idx + 1) % 10 == 0 or (idx + 1) == len(batch_df):
                                        progress_bar.progress((idx + 1) / len(batch_df))
                                except Exception as e:
                                    errors.append(f"Row {idx+1}: {str(e)}")
                            
                            progress_bar.empty()
                            
                            if predictions_list:
                                results_df = pd.DataFrame(predictions_list)
                                st.success(f"✅ Successfully predicted {len(predictions_list)} cars")
                                st.dataframe(results_df, use_container_width=True)
                                
                                csv_results = results_df.to_csv(index=False)
                                st.download_button(
                                    label="📥 Download Batch Results (CSV)",
                                    data=csv_results,
                                    file_name="batch_predictions.csv",
                                    mime="text/csv"
                                )
                            
                            if errors:
                                st.warning(f"⚠️ {len(errors)} errors occurred:")
                                for error in errors[:10]:
                                    st.text(error)
                except Exception as e:
                    st.error(f"❌ Error processing file: {e}")
        
        with pred_tab3:
            st.markdown(f'<div class="chart-title">{t("compare_cars")}</div>', unsafe_allow_html=True)
            st.info("Enter details for up to 5 cars to compare their predicted prices side by side.")
            
            num_cars = st.slider("Number of cars to compare", min_value=2, max_value=5, value=2)
            
            comparison_data = []
            df = st.session_state.df
            
            # Use cached dropdown options from session state
            if 'dropdown_options' in st.session_state:
                makes = st.session_state.dropdown_options['makes']
                fuel_types = st.session_state.dropdown_options['fuel_types']
                locations = st.session_state.dropdown_options['locations']
                conditions = st.session_state.dropdown_options['conditions']
            else:
                # Fallback if not cached
                makes = sorted(df['make'].dropna().unique().tolist())
            fuel_types = sorted(df['fuel_type'].dropna().unique().tolist())
            locations = sorted(df['location'].dropna().unique().tolist())
            conditions = ['New', 'Like New', 'Excellent', 'Good', 'Fair', 'Poor']
            
            cols = st.columns(num_cars)
            for i in range(num_cars):
                with cols[i]:
                    st.markdown(f"#### Car {i+1}")
                    make_comp = st.selectbox(f"Make {i+1}", makes, key=f"make_comp_{i}")
                    if make_comp:
                        models_comp = sorted(df[df['make'] == make_comp]['model'].dropna().unique().tolist())
                        model_comp = st.selectbox(f"Model {i+1}", models_comp, key=f"model_comp_{i}") if models_comp else None
                    else:
                        model_comp = None
                    
                    year_comp = st.slider(f"Year {i+1}", 2000, 2025, 2020, key=f"year_comp_{i}")
                    mileage_comp = st.number_input(f"Mileage (km) {i+1}", 0, 500000, 30000, 1000, key=f"mileage_comp_{i}")
                    condition_comp = st.selectbox(f"Condition {i+1}", conditions, index=3, key=f"condition_comp_{i}")
                    fuel_type_comp = st.selectbox(f"Fuel Type {i+1}", fuel_types, key=f"fuel_type_comp_{i}")
                    engine_size_comp = st.number_input(f"Engine Size (L) {i+1}", 0.5, 10.0, 2.5, 0.1, key=f"engine_size_comp_{i}")
                    cylinders_comp = st.slider(f"Cylinders {i+1}", 2, 12, 4, key=f"cylinders_comp_{i}")
                    location_comp = st.selectbox(f"Location {i+1}", locations, key=f"location_comp_{i}")
                    
                    if make_comp and model_comp:
                        comparison_data.append({
                            'make': make_comp,
                            'model': model_comp,
                            'year': year_comp,
                            'mileage': mileage_comp,
                            'condition': condition_comp,
                            'fuel_type': fuel_type_comp,
                            'engine_size': engine_size_comp,
                            'cylinders': cylinders_comp,
                            'location': location_comp
                        })
            
            if st.button(f"🚀 {t('compare_prices')}", type="primary"):
                if len(comparison_data) < 2:
                    st.warning("Please enter at least 2 cars to compare.")
                else:
                    with st.spinner("🔮 Analyzing and comparing cars..."):
                        comparison_results = []
                        for i, car_data in enumerate(comparison_data):
                            try:
                                price, confidence = predict_price(car_data, return_confidence=True)
                                
                                # Extract and convert to Python float
                                pred_price_raw = price[0] if isinstance(price, np.ndarray) else price
                                pred_price = float(pred_price_raw)
                                
                                lower_raw = confidence['lower_95'][0] if isinstance(confidence['lower_95'], np.ndarray) else confidence['lower_95']
                                upper_raw = confidence['upper_95'][0] if isinstance(confidence['upper_95'], np.ndarray) else confidence['upper_95']
                                lower = float(lower_raw)
                                upper = float(upper_raw)
                                
                                # BUG FIX 1: Handle negative prices
                                if pred_price < 0:
                                    pred_price = abs(pred_price)
                                
                                # CRITICAL: Aggressive warning for predictions < $100
                                if pred_price < 100:
                                    st.warning(f"⚠️ Car {i+1}: Prediction ${pred_price:,.2f} is extremely low. Model may need retraining.")
                                
                                # Ensure minimum reasonable price
                                if pred_price < 1.0:
                                    pred_price = max(1.0, pred_price)
                                if lower < 0:
                                    lower = max(0.0, pred_price * 0.5)
                                if upper < pred_price:
                                    upper = max(pred_price * 1.1, upper)
                                
                                # BUG FIX 2: Convert all to Python native types
                                comparison_results.append({
                                    'Car': f"Car {i+1}",
                                    'Make': str(car_data['make']),
                                    'Model': str(car_data['model']),
                                    'Year': int(car_data['year']),
                                    'Mileage (km)': to_python_float(car_data['mileage']),
                                    'Condition': str(car_data['condition']),
                                    'Predicted Price ($)': f"${pred_price:,.2f}",
                                    'Price (numeric)': to_python_float(pred_price),
                                    'Lower CI': f"${lower:,.2f}",
                                    'Upper CI': f"${upper:,.2f}"
                                })
                            except Exception as e:
                                st.error(f"Error predicting Car {i+1}: {e}")
                        
                        if comparison_results:
                            comp_df = pd.DataFrame(comparison_results)
                            st.dataframe(comp_df[['Car', 'Make', 'Model', 'Year', 'Mileage (km)', 'Condition', 'Predicted Price ($)', 'Lower CI', 'Upper CI']], 
                                       use_container_width=True, hide_index=True)
                            
                            st.markdown('<div class="chart-title">Price Comparison Chart</div>', unsafe_allow_html=True)
                            fig_comp = px.bar(
                                comp_df, 
                                x='Car', 
                                y='Price (numeric)',
                                color='Price (numeric)',
                                color_continuous_scale='Viridis',
                                title="Predicted Prices Comparison",
                                labels={'Price (numeric)': 'Predicted Price ($)', 'Car': 'Car'},
                                text='Predicted Price ($)'
                            )
                            fig_comp.update_traces(
                                texttemplate='$%{text}',
                                textposition='outside',
                                hovertemplate='<b>%{x}</b><br>Price: $%{y:,.2f}<extra></extra>',
                                marker_line_color='rgba(0,0,0,0.2)',
                                marker_line_width=1
                            )
                            fig_comp.update_layout(
                                height=450,
                                template='plotly_dark',
                                paper_bgcolor='#0F1419',
                                plot_bgcolor='#1A1F2E',
                                font=dict(family="Inter, sans-serif", size=12, color='#F9FAFB'),
                                showlegend=False,
                                xaxis=dict(title=dict(text='Car', font=dict(color='#9CA3AF')), showgrid=False),
                                yaxis=dict(title=dict(text='Predicted Price ($)', font=dict(color='#9CA3AF')), showgrid=True, gridcolor='rgba(255,255,255,0.1)')
                            )
                            st.plotly_chart(fig_comp, use_container_width=True)
                            
                            csv_comp = comp_df.to_csv(index=False)
                            st.download_button(
                                label="📥 Download Comparison (CSV)",
                                data=csv_comp,
                                file_name="car_comparison.csv",
                                mime="text/csv"
                            )

# ============================================================================
# TAB 2: DATA - Statistics and Visualizations Combined
# ============================================================================
with tab2:
    # Create sub-tabs for Statistics and Visualizations
    data_tab1, data_tab2 = st.tabs(["📊 Statistics", "📈 Visualizations"])
    
    # ========================================================================
    # SUB-TAB 1: STATISTICS
    # ========================================================================
    with data_tab1:
        if not st.session_state.data_loaded:
            st.error("⚠️ Data not loaded.")
        else:
            df = st.session_state.df
        
        # Premium color palette matching design system
        PROFESSIONAL_COLORS = {
            'primary': '#6366F1',
            'secondary': '#4F46E5',
            'accent': '#818CF8',
            'success': '#10B981',
            'warning': '#F59E0B',
            'error': '#EF4444',
            'info': '#3B82F6'
        }
        
        # ========================================================================
        # KPI CARDS AT TOP - 4 Column Grid
        # ========================================================================
        st.markdown(f'<div class="chart-title">{t("dataset_statistics")}</div>', unsafe_allow_html=True)
        
        # 4-column KPI grid
        kpi_col1, kpi_col2, kpi_col3, kpi_col4 = st.columns(4)
        
        with kpi_col1:
            st.metric(
                t("total_cars"),
                f"{len(df):,}",
                help="Total number of cars in the dataset"
            )
        
        with kpi_col2:
            if 'price' in df.columns:
                avg_price = df['price'].mean()
                st.metric(
                    t("avg_price"),
                    f"${avg_price:,.0f}",
                    help="Average car price"
                )
            else:
                st.metric(t("avg_price"), "N/A")
        
        with kpi_col3:
            if 'price' in df.columns:
                median_price = df['price'].median()
                st.metric(
                    t("median_price"),
                    f"${median_price:,.0f}",
                    help="Median car price (50th percentile)"
                )
            else:
                st.metric(t("median_price"), "N/A")
        
        with kpi_col4:
            if 'year' in df.columns:
                year_range = f"{int(df['year'].min())}-{int(df['year'].max())}"
                st.metric(
                    t("year_range"),
                    year_range,
                    help="Range of manufacturing years"
                )
            else:
                st.metric(t("year_range"), "N/A")
        
        st.markdown('<div class="section-spacer"></div>', unsafe_allow_html=True)
        
        # ========================================================================
        # ENHANCED INTERACTIVE CHARTS - WITH COLLAPSIBLE SECTIONS
        # ========================================================================
        
        # Price Distribution - Collapsible Section
        if 'price' in df.columns:
            with st.expander(f"📊 {t('price_distribution')}", expanded=True):
                # Use sampled data for better performance
                df_chart = get_chart_data(df, max_rows=10000)
                fig_price = px.histogram(
                    df_chart, 
                    x='price', 
                    nbins=50,
                    title="",
                    labels={'price': 'Price ($)', 'count': 'Number of Cars'},
                    color_discrete_sequence=[PROFESSIONAL_COLORS['primary']]
                )
                fig_price.update_traces(
                    marker_line_color='rgba(0,0,0,0.2)',
                    marker_line_width=1,
                    hovertemplate='<b>Price Range</b><br>Price: $%{x:,.2f}<br>Count: %{y}<extra></extra>'
                )
                fig_price.update_layout(
                    height=450,
                    template='plotly_dark',
                    paper_bgcolor='#0F1419',
                    plot_bgcolor='#1A1F2E',
                    font=dict(family="Inter, sans-serif", size=12, color='#F9FAFB'),
                    hovermode='x unified',
                    xaxis=dict(title=dict(text='Price ($)', font=dict(color='#9CA3AF')), showgrid=True, gridcolor='rgba(255,255,255,0.1)'),
                    yaxis=dict(title=dict(text='Number of Cars', font=dict(color='#9CA3AF')), showgrid=True, gridcolor='rgba(255,255,255,0.1)')
                )
                st.plotly_chart(fig_price, use_container_width=True)
        
        # Two-column layout for mini charts - Collapsible
        col1, col2 = st.columns(2)
        
        with col1:
            if 'make' in df.columns:
                with st.expander(f"🏆 {t('top_makes')}", expanded=False):
                    # Use full dataset for top makes (small operation)
                    top_makes = df['make'].value_counts().head(10)
                    fig_makes = px.bar(
                        x=top_makes.values, 
                        y=top_makes.index, 
                        orientation='h',
                        labels={'x': 'Count', 'y': 'Make'},
                        title="Most Popular Car Makes",
                        color=top_makes.values,
                        color_continuous_scale='Viridis'
                    )
                    fig_makes.update_traces(
                        hovertemplate='<b>%{y}</b><br>Count: %{x}<extra></extra>',
                        marker_line_color='rgba(0,0,0,0.2)',
                        marker_line_width=1
                    )
                    fig_makes.update_layout(
                        height=400,
                        template='plotly_dark',
                        paper_bgcolor='#0F1419',
                        plot_bgcolor='#1A1F2E',
                        font=dict(family="Inter, sans-serif", size=12, color='#F9FAFB'),
                        showlegend=False,
                        xaxis=dict(title=dict(text='Count', font=dict(color='#9CA3AF')), showgrid=True, gridcolor='rgba(255,255,255,0.1)'),
                        yaxis=dict(title='', showgrid=False)
                    )
                    st.plotly_chart(fig_makes, use_container_width=True)
        
        with col2:
            if 'fuel_type' in df.columns:
                with st.expander(f"⛽ {t('fuel_distribution')}", expanded=False):
                    fuel_dist = df['fuel_type'].value_counts()
                    fig_fuel = px.pie(
                        values=fuel_dist.values, 
                        names=fuel_dist.index,
                        title="Fuel Type Distribution",
                        color_discrete_sequence=px.colors.qualitative.Set3
                    )
                    fig_fuel.update_traces(
                        textposition='inside',
                        textinfo='percent+label',
                        hovertemplate='<b>%{label}</b><br>Count: %{value}<br>Percentage: %{percent}<extra></extra>',
                        marker=dict(line=dict(color='#FFFFFF', width=2))
                    )
                    fig_fuel.update_layout(
                        height=400,
                        template='plotly_dark',
                        paper_bgcolor='#0F1419',
                        plot_bgcolor='#1A1F2E',
                        font=dict(family="Inter, sans-serif", size=12, color='#F9FAFB'),
                        showlegend=True
                    )
                    st.plotly_chart(fig_fuel, use_container_width=True)
        
        # Price trends by year - Collapsible Section
        if 'year' in df.columns and 'price' in df.columns:
            with st.expander(f"📈 {t('price_trends')}", expanded=False):
                # Use sampled data for trend calculation
                df_chart = get_chart_data(df, max_rows=10000)
                price_by_year = df_chart.groupby('year')['price'].mean().reset_index()
                fig_year = px.line(
                    price_by_year, 
                    x='year', 
                    y='price',
                    title="Average Car Price by Year",
                    labels={'year': 'Year', 'price': 'Average Price ($)'},
                    color_discrete_sequence=[PROFESSIONAL_COLORS['primary']]
                )
                fig_year.update_traces(
                    line=dict(width=3),
                    marker=dict(size=6),
                    hovertemplate='<b>Year: %{x}</b><br>Avg Price: $%{y:,.2f}<extra></extra>',
                    mode='lines+markers'
                )
                fig_year.update_layout(
                    height=400,
                    template='plotly_dark',
                    paper_bgcolor='#0F1419',
                    plot_bgcolor='#1A1F2E',
                    font=dict(family="Inter, sans-serif", size=12, color='#F9FAFB'),
                    hovermode='x unified',
                    xaxis=dict(title=dict(text='Year', font=dict(color='#9CA3AF')), showgrid=True, gridcolor='rgba(255,255,255,0.1)'),
                    yaxis=dict(title=dict(text='Average Price ($)', font=dict(color='#9CA3AF')), showgrid=True, gridcolor='rgba(255,255,255,0.1)')
                )
                st.plotly_chart(fig_year, use_container_width=True)
        
        # Condition analysis - Collapsible Section
        if 'condition' in df.columns and 'price' in df.columns:
            with st.expander(f"✨ {t('price_by_condition')}", expanded=False):
                # Use sampled data for condition analysis
                df_chart = get_chart_data(df, max_rows=10000)
                condition_price = df_chart.groupby('condition')['price'].mean().sort_values(ascending=False)
                fig_condition = px.bar(
                    x=condition_price.index, 
                    y=condition_price.values,
                    labels={'x': 'Condition', 'y': 'Average Price ($)'},
                    title="Average Price by Condition",
                    color=condition_price.values,
                    color_continuous_scale='Viridis'
                )
                fig_condition.update_traces(
                    hovertemplate='<b>%{x}</b><br>Avg Price: $%{y:,.2f}<extra></extra>',
                    marker_line_color='rgba(0,0,0,0.2)',
                    marker_line_width=1
                )
                fig_condition.update_layout(
                    height=400,
                    template='plotly_dark',
                    paper_bgcolor='#0F1419',
                    plot_bgcolor='#1A1F2E',
                    font=dict(family="Inter, sans-serif", size=12, color='#F9FAFB'),
                    showlegend=False,
                    xaxis=dict(title=dict(text='Condition', font=dict(color='#9CA3AF')), showgrid=False),
                    yaxis=dict(title=dict(text='Average Price ($)', font=dict(color='#9CA3AF')), showgrid=True, gridcolor='rgba(255,255,255,0.1)')
                )
                st.plotly_chart(fig_condition, use_container_width=True)

    # ========================================================================
    # SUB-TAB 2: VISUALIZATIONS
    # ========================================================================
    with data_tab2:
        # Visualization helper functions
        @st.cache_data(ttl=3600, show_spinner=False, max_entries=3)
        def get_viz_file_info(file_path):
            """Get file size and basic info without loading content"""
            try:
                if not os.path.exists(file_path):
                    return None, "File not found", 0
                
                file_size = os.path.getsize(file_path)
                file_size_mb = file_size / 1_000_000
                return file_path, None, file_size_mb
            except Exception as e:
                return None, str(e), 0
        
        @st.cache_data(ttl=3600, show_spinner=False, max_entries=3)
        def load_small_html_viz(file_path):
            """Load HTML visualization content ONLY for small files (<2MB) to prevent crashes"""
            try:
                if not os.path.exists(file_path):
                    return None, "File not found"
                
                # Check file size BEFORE reading to prevent memory issues
                file_size = os.path.getsize(file_path)
                
                # STRICT LIMIT: Only load files < 2MB inline to prevent browser crashes
                if file_size > 2_000_000:  # 2MB hard limit for inline display
                    file_size_mb = file_size / 1_000_000
                    return None, f"File too large ({file_size_mb:.1f}MB > 2MB)"
                
                # Only read if file is small enough
                with open(file_path, 'r', encoding='utf-8') as f:
                    html_content = f.read()
                
                return html_content, None
            except MemoryError:
                return None, "Memory error loading file"
            except OSError as e:
                return None, f"File system error: {str(e)}"
            except Exception as e:
                return None, str(e)

        @st.cache_data(ttl=3600, show_spinner=False)
        def get_viz_file_list(viz_folder):
            """Get list of visualization files safely"""
            try:
                if not os.path.exists(viz_folder):
                    return [], []
                files = os.listdir(viz_folder)
                html_files = sorted([f for f in files if f.endswith('.html')])
                png_files = sorted([f for f in files if f.endswith('.png')])
                return html_files, png_files
            except Exception:
                # Return empty lists on error (error handling done in calling code)
                return [], []

        st.markdown(f'<div class="chart-title">{t("advanced_visualizations")}</div>', unsafe_allow_html=True)
        st.info("💡 Interactive visualizations with zoom, pan, and hover tooltips. Click and drag to explore!")
        
        try:
            viz_folder = config.VISUALIZATIONS_DIR
            
            # Get file lists with error handling
            html_viz_files, png_viz_files = get_viz_file_list(viz_folder)
            
            # Show interactive HTML visualizations first
            if html_viz_files:
                st.markdown(f'<div class="chart-title">{t("interactive_viz")}</div>', unsafe_allow_html=True)
                
                try:
                    # Lazy loading - only load selected visualization
                    selected_viz = st.selectbox(
                        f"🎯 {t('select_viz')}",
                        options=html_viz_files,
                        format_func=lambda x: x.replace('.html', '').replace('_', ' ').title(),
                        key='viz_selector',
                        help="Select a visualization to load (lazy loading for better performance)"
                    )
                    
                    if selected_viz:
                        html_path = os.path.join(viz_folder, selected_viz)
                        
                        # Verify file exists and get size info WITHOUT loading content
                        if os.path.exists(html_path):
                            try:
                                # Get file info first (fast, no loading)
                                file_path, error, file_size_mb = get_viz_file_info(html_path)
                                
                                if error:
                                    st.warning(f"⚠️ {error}")
                                else:
                                    # Check file size BEFORE attempting to load
                                    if file_size_mb > 2.0:
                                        # File is too large for inline display - provide download option
                                        st.warning(f"⚠️ **This visualization is large ({file_size_mb:.1f} MB)**")
                                        st.info("💡 **Large visualizations (>2MB) cannot be displayed inline to prevent browser crashes.** "
                                               "Please download the file and open it in your browser for the best experience.")
                                        
                                        # Provide download button
                                        try:
                                            with open(html_path, 'rb') as f:
                                                html_bytes = f.read()
                                            st.download_button(
                                                label="📥 Download Visualization",
                                                data=html_bytes,
                                                file_name=selected_viz,
                                                mime="text/html",
                                                help="Download and open in your browser for full interactive experience"
                                            )
                                        except Exception as e:
                                            st.error(f"❌ Could not prepare download: {str(e)}")
                                    
                                    else:
                                        # File is small enough - try to load inline
                                        try:
                                            # Load small file with caching
                                            html_content, error = load_small_html_viz(html_path)
                                            
                                            if html_content:
                                                try:
                                                    # Render HTML visualization directly (only safe for small files <2MB)
                                                    st.components.v1.html(html_content, height=600, scrolling=True)
                                                except Exception as render_error:
                                                    st.warning(f"⚠️ Could not render visualization: {str(render_error)}")
                                                    st.info("💡 This visualization may not be compatible with the current browser. Try downloading it instead.")
                                                    # Offer download as fallback
                                                    try:
                                                        with open(html_path, 'rb') as f:
                                                            html_bytes = f.read()
                                                        st.download_button(
                                                            label="📥 Download Visualization (Fallback)",
                                                            data=html_bytes,
                                                            file_name=selected_viz,
                                                            mime="text/html"
                                                        )
                                                    except:
                                                        pass
                                            elif error:
                                                if error.startswith("File too large"):
                                                    st.warning(f"⚠️ {error}")
                                                    st.info("💡 Please download the visualization to view it properly.")
                                                    # Offer download
                                                    try:
                                                        with open(html_path, 'rb') as f:
                                                            html_bytes = f.read()
                                                        st.download_button(
                                                            label="📥 Download Visualization",
                                                            data=html_bytes,
                                                            file_name=selected_viz,
                                                            mime="text/html"
                                                        )
                                                    except:
                                                        pass
                                                else:
                                                    st.error(f"❌ Error loading visualization: {error}")
                                            else:
                                                st.error("❌ Unknown error loading visualization")
                                        except MemoryError:
                                            st.error("❌ Memory error: This visualization is too large to load.")
                                            st.info("💡 Please download the visualization instead.")
                                            try:
                                                with open(html_path, 'rb') as f:
                                                    html_bytes = f.read()
                                                st.download_button(
                                                    label="📥 Download Visualization",
                                                    data=html_bytes,
                                                    file_name=selected_viz,
                                                    mime="text/html"
                                                )
                                            except:
                                                pass
                                        except Exception as load_error:
                                            st.error(f"❌ Error loading visualization: {str(load_error)}")
                            except OSError as e:
                                st.warning(f"⚠️ File system error: {str(e)}")
                                st.info("💡 The visualization file system may be under heavy load. Please try again later.")
                            except Exception as e:
                                st.warning(f"⚠️ Error accessing visualization file: {str(e)}")
                        else:
                            st.warning(f"⚠️ Visualization file not found: {selected_viz}")
                except Exception as e:
                    st.error(f"❌ Error setting up visualization selector: {str(e)}")
        
            # Show static PNG visualizations with lazy loading (priority ones first)
            if png_viz_files:
                st.markdown('<div class="section-spacer"></div>', unsafe_allow_html=True)
                st.markdown(f'<div class="chart-title">{t("static_viz")}</div>', unsafe_allow_html=True)
                
                # Visualization mapping for organized display
                viz_mapping = {
                    '1_': ('Price Distribution', True),
                    '2_': ('Price vs Year', True),
                    '3_': ('Price by Make (Top 10)', True),
                    '4_': ('Price by Fuel Type', False),
                    '5_': ('Price by Condition', False),
                    '6_': ('Mileage vs Price', False),
                    '7_': ('Correlation Heatmap', True),
                    '8_': ('Price by Location', False),
                    '9_': ('Engine Size vs Price', False)
                }
                
                # Separate priority and optional visualizations for lazy loading
                priority_viz = []
                optional_viz = []
                
                for viz_file in png_viz_files:
                    viz_path = os.path.join(viz_folder, viz_file)
                    if not os.path.exists(viz_path):
                        continue
                    
                    viz_title = None
                    show_viz = False
                    
                    for prefix, (title, show) in viz_mapping.items():
                        if viz_file.startswith(prefix):
                            viz_title = title
                            show_viz = show
                            break
                    
                    if viz_title:
                        if show_viz:
                            priority_viz.append((viz_file, viz_path, viz_title))
                        else:
                            optional_viz.append((viz_file, viz_path, viz_title))
                
                try:
                    loaded_count = 0
                    
                    # Load priority visualizations immediately (always shown)
                    if priority_viz:
                        for viz_file, viz_path, viz_title in priority_viz:
                            try:
                                st.markdown(f"#### {viz_title}")
                                try:
                                    st.image(viz_path, use_container_width=True)
                                    loaded_count += 1
                                except Exception as img_error:
                                    st.error(f"❌ Error loading image {viz_file}: {str(img_error)}")
                            except Exception:
                                continue
                    
                    # Load optional visualizations in expanders (lazy loading)
                    if optional_viz:
                        # Add checkbox to show all optional visualizations
                        show_all_optional = st.checkbox(
                            f"📊 {t('show_additional')}", 
                            value=False, 
                            key="show_optional_viz",
                            help="Load additional visualizations (may take time)"
                        )
                        
                        if show_all_optional:
                            with st.spinner("Loading additional visualizations..."):
                                for viz_file, viz_path, viz_title in optional_viz:
                                    try:
                                        with st.expander(f"📊 {viz_title}"):
                                            try:
                                                st.image(viz_path, use_container_width=True)
                                                loaded_count += 1
                                            except Exception as img_error:
                                                st.error(f"❌ Error loading image {viz_file}: {str(img_error)}")
                                    except Exception:
                                        continue
                    
                    if loaded_count > 0:
                        st.success(f"✅ Loaded {loaded_count} visualization(s) successfully!")
                    elif png_viz_files:
                        st.warning("⚠️ No visualizations could be loaded. Please check file permissions and formats.")
                        
                except Exception as e:
                    st.error(f"❌ Error loading static visualizations: {str(e)}")
                    st.info("💡 Please run data_visualization.py to generate visualizations.")
            else:
                if not html_viz_files:
                    st.warning("⚠️ No visualizations found. Please run data_visualization.py first to generate visualizations.")
                    st.info("💡 Run this command: `python data_visualization.py`")
            
        except Exception as e:
            st.error(f"❌ Critical error in Visualizations tab: {str(e)}")
            st.info("💡 Please check:")
            st.info("  1. Visualizations folder exists")
            st.info("  2. Run data_visualization.py to generate charts")
            st.info("  3. Check file permissions")
            import traceback
            with st.expander("🔍 Technical Details"):
                st.code(traceback.format_exc())

# ============================================================================
# TAB 3: ABOUT
# ============================================================================
with tab3:
    st.markdown("""
    ## About Car Price Predictor Pro
    
    ### 🎯 Project Overview
    This is an AI-powered car price prediction system that uses advanced machine learning to estimate 
    the market value of used cars based on various features.
    
    ### 🤖 Model Information
    - **Algorithm:** Stacking Ensemble (Random Forest + XGBoost + LightGBM)
    - **R² Score:** 0.9996 (99.96% variance explained)
    - **Training Data:** 62,181 car listings
    - **Features Used:** Year, Mileage, Engine Size, Cylinders, Make, Model, Condition, Fuel Type, Location
    
    ### 📊 Key Features
    - ✅ Accurate price predictions with confidence intervals
    - ✅ Market comparison with average prices
    - ✅ Similar car comparisons
    - ✅ Batch prediction support
    - ✅ Comprehensive dataset statistics
    - ✅ Interactive visualizations
    - ✅ Premium user interface
    
    ### 🛠️ Technology Stack
    - **Frontend:** Streamlit with custom CSS
    - **Machine Learning:** Scikit-learn, XGBoost, LightGBM
    - **Data Processing:** Pandas, NumPy
    - **Visualization:** Plotly, Matplotlib, Seaborn
    
    ### 📈 Model Performance Metrics
    - **R² Score:** 0.9996
    - **RMSE:** $180.43
    - **MAE:** $91.02
    - **Coverage:** 96.36%
    
    ---
    
    **Version:** 2.0.0 (Premium)  
    **Last Updated:** 2025
    """)

# ============================================================================
# PREMIUM FOOTER WITH ATTRIBUTION
# ============================================================================
st.markdown("---")
st.markdown("""
<div class="premium-footer">
    <p class="footer-text">Car Price Predictor Pro | Powered by Advanced Machine Learning</p>
    <p class="footer-text" style="font-size: 0.9rem; margin-top: 0.5rem; color: #6366F1;">
        Built with Streamlit and ❤️
    </p>
    <p class="footer-text" style="font-size: 0.9rem; margin-top: 0.5rem; color: #10B981;">
        Created by MrDYAR
    </p>
    <p class="footer-text" style="font-size: 0.8rem; margin-top: 0.5rem;">© 2025 | All rights reserved</p>
</div>
""", unsafe_allow_html=True)
