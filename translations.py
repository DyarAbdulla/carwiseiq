"""
Translation module for Car Price Predictor Pro
Supports English, Kurdish (Sorani), and Arabic
"""

import streamlit as st

TRANSLATIONS = {
    "en": {
        # App title and subtitle
        "app_title": "Car Price Predictor Pro",
        "app_subtitle": "AI-Powered Market Value Estimation",
        
        # System messages
        "system_ready": "System ready",
        
        # Navigation
        "navigation": "Navigation",
        "predict": "Predict",
        "statistics": "Statistics",
        "visualizations": "Visualizations",
        "about": "About",
        
        # Sidebar
        "total_cars": "Total Cars",
        "avg_price": "Average Price",
        "model_info": "Model Information",
        "model": "Model",
        "r2_score": "R² Score",
        "quick_actions": "Quick Actions",
        "reset_form": "Reset Form",
        
        # Prediction tabs
        "single": "Single",
        "batch": "Batch",
        "compare": "Compare",
        
        # Form labels
        "basic_information": "Basic Information",
        "make": "Make",
        "model_label": "Model",
        "year": "Year",
        "mileage_km": "Mileage (km)",
        "technical_specs": "Technical Specifications",
        "engine_size_l": "Engine Size (L)",
        "cylinders": "Cylinders",
        "condition_location": "Condition & Location",
        "condition": "Condition",
        "fuel_type": "Fuel Type",
        "location": "Location",
        
        # Condition options
        "new": "New",
        "like_new": "Like New",
        "excellent": "Excellent",
        "good": "Good",
        "fair": "Fair",
        "poor": "Poor",
        
        # Buttons
        "predict_price": "Predict Price",
        "try_sample_car": "Try Sample Car",
        "clear_form": "Clear Form",
        "reset_all_inputs": "Reset All Inputs",
        "share_prediction": "Share Prediction",
        "predict_all_prices": "Predict All Prices",
        "compare_prices": "Compare Prices",
        "prediction_success": "Prediction successful!",
        
        # Results
        "prediction_results": "Prediction Results",
        "confidence_interval": "Confidence Interval (95%)",
        "market_comparison": "Market Comparison",
        "your_car": "Your Car",
        "market_average": "Market Average",
        "difference": "Difference",
        "similar_cars": "Similar Cars",
        
        # Batch prediction
        "batch_prediction": "Batch Prediction",
        "upload_csv": "Upload a CSV file with car data to predict prices for multiple cars at once.",
        
        # Compare
        "compare_cars": "Compare Cars",
        
        # Statistics
        "dataset_statistics": "Dataset Statistics",
        "median_price": "Median Price",
        "year_range": "Year Range",
        "price_distribution": "Price Distribution",
        "top_makes": "Top Car Makes",
        "fuel_distribution": "Fuel Type Distribution",
        "price_trends": "Price Trends by Year",
        "price_by_condition": "Price by Condition",
        
        # Visualizations
        "advanced_visualizations": "Advanced Visualizations",
        "interactive_viz": "Interactive Visualizations",
        "select_viz": "Select Visualization",
        "static_viz": "Static Visualizations",
        "show_additional": "Show Additional Visualizations",
        
        # Share
        "copied_to_clipboard": "Copied to clipboard!",
    },
    "ku": {
        # App title and subtitle
        "app_title": "پێشبینیکردنی  نرخی ئۆتۆمبێل",
        "app_subtitle": "خەمڵاندنی نرخی بازاڕ بە هێزی AI",
        
        # System messages
        "system_ready": "سیستەم ئامادەیە",
        
        # Navigation
        "navigation": "گەشت",
        "predict": "بڕیاردان",
        "statistics": "ئامارەکان",
        "data": "داتا",
        "visualizations": "وێنەکان",
        "about": "دەربارە",
        
        # Sidebar
        "total_cars": "کۆی ئۆتۆمبێلەکان",
        "avg_price": "نرخی مامناوەند",
        "model_info": "زانیاری مۆدێل",
        "model": "مۆدێل",
        "r2_score": "نمرەی R²",
        "quick_actions": "کارە خێراکان",
        "reset_form": "دووبارەکردنەوەی فۆڕم",
        
        # Prediction tabs
        "single": "تاک",
        "batch": "کۆمەڵ",
        "compare": "بەراورد",
        
        # Form labels
        "basic_information": "زانیاری بنەڕەتی",
        "make": "دروستکەر",
        "model_label": "مۆدێل",
        "year": "ساڵ",
        "mileage_km": "خولگە (کیلۆمێتر)",
        "technical_specs": "تایبەتمەندییە تەکنیکییەکان",
        "engine_size_l": "قەبارەی بزوێنەر (لیتر)",
        "cylinders": "سلیندەرەکان",
        "condition_location": "دۆخ و شوێن",
        "condition": "دۆخ",
        "fuel_type": "جۆری سوتەمەنی",
        "location": "شوێن",
        
        # Condition options
        "new": "نوێ",
        "like_new": "وەک نوێ",
        "excellent": "نایاب",
        "good": "باش",
        "fair": "مامناوەند",
        "poor": "خراپ",
        
        # Buttons
        "predict_price": "نرخی بڕیار بە",
        "try_sample_car": "ئۆتۆمبێلی نموونە تاقی بکەوە",
        "clear_form": "فۆڕم پاک بکەوە",
        "reset_all_inputs": "هەموو دەرکەوتنەکان دووبارە بکەوە",
        "share_prediction": "بڕیاردان هاوبەش بکە",
        "predict_all_prices": "هەموو نرخەکان بڕیار بە",
        "compare_prices": "نرخەکان بەراورد بکە",
        "prediction_success": "بڕیاردان سەرکەوتوو بوو!",
        
        # Results
        "prediction_results": "ئەنجامەکانی بڕیاردان",
        "confidence_interval": "ماوەی متمانە (٩٥٪)",
        "market_comparison": "بەراوردی بازاڕ",
        "your_car": "ئۆتۆمبێلەکەت",
        "market_average": "مامناوەندی بازاڕ",
        "difference": "جیاوازی",
        "similar_cars": "ئۆتۆمبێلە هاوشێوەکان",
        
        # Batch prediction
        "batch_prediction": "بڕیاردانی کۆمەڵ",
        "upload_csv": "فایلی CSV بە زانیاری ئۆتۆمبێلەکان بار بکە بۆ بڕیاردانی نرخ بۆ چەندین ئۆتۆمبێل بە جارێک.",
        
        # Compare
        "compare_cars": "بەراوردکردنی ئۆتۆمبێلەکان",
        
        # Statistics
        "dataset_statistics": "ئامارەکانی داتا",
        "median_price": "نرخی ناوەندی",
        "year_range": "ماوەی ساڵەکان",
        "price_distribution": "بەشێوەی نرخەکان",
        "top_makes": "باشترین دروستکەرەکان",
        "fuel_distribution": "بەشێوەی جۆری سوتەمەنی",
        "price_trends": "ئاراستەی نرخەکان بەپێی ساڵ",
        "price_by_condition": "نرخ بەپێی دۆخ",
        
        # Visualizations
        "advanced_visualizations": "وێنەکانی پێشکەوتوو",
        "interactive_viz": "وێنەکانی کاراگەر",
        "select_viz": "وێنە هەڵبژێرە",
        "static_viz": "وێنەکانی جێگیر",
        "show_additional": "وێنەکانی زیاتر پیشان بدە",
        
        # Share
        "copied_to_clipboard": "لە کلیپبۆرد کۆپی کرا!",
    },
    "ar": {
        # App title and subtitle
        "app_title": "منبئ أسعار السيارات المحترف",
        "app_subtitle": "تقدير قيمة السوق بالذكاء الاصطناعي",
        
        # System messages
        "system_ready": "النظام جاهز",
        
        # Navigation
        "navigation": "التنقل",
        "predict": "التنبؤ",
        "statistics": "الإحصائيات",
        "data": "البيانات",
        "visualizations": "التصورات",
        "about": "حول",
        
        # Sidebar
        "total_cars": "إجمالي السيارات",
        "avg_price": "متوسط السعر",
        "model_info": "معلومات النموذج",
        "model": "النموذج",
        "r2_score": "نقاط R²",
        "quick_actions": "إجراءات سريعة",
        "reset_form": "إعادة تعيين النموذج",
        
        # Prediction tabs
        "single": "واحد",
        "batch": "مجموعة",
        "compare": "مقارنة",
        
        # Form labels
        "basic_information": "المعلومات الأساسية",
        "make": "الصانع",
        "model_label": "النموذج",
        "year": "السنة",
        "mileage_km": "المسافة المقطوعة (كم)",
        "technical_specs": "المواصفات التقنية",
        "engine_size_l": "حجم المحرك (لتر)",
        "cylinders": "الأسطوانات",
        "condition_location": "الحالة والموقع",
        "condition": "الحالة",
        "fuel_type": "نوع الوقود",
        "location": "الموقع",
        
        # Condition options
        "new": "جديد",
        "like_new": "كالجديد",
        "excellent": "ممتاز",
        "good": "جيد",
        "fair": "متوسط",
        "poor": "ضعيف",
        
        # Buttons
        "predict_price": "تنبؤ بالسعر",
        "try_sample_car": "جرب سيارة نموذجية",
        "clear_form": "مسح النموذج",
        "reset_all_inputs": "إعادة تعيين جميع المدخلات",
        "share_prediction": "مشاركة التنبؤ",
        "predict_all_prices": "تنبؤ بجميع الأسعار",
        "compare_prices": "مقارنة الأسعار",
        "prediction_success": "تم التنبؤ بنجاح!",
        
        # Results
        "prediction_results": "نتائج التنبؤ",
        "confidence_interval": "فترة الثقة (95%)",
        "market_comparison": "مقارنة السوق",
        "your_car": "سيارتك",
        "market_average": "متوسط السوق",
        "difference": "الفرق",
        "similar_cars": "سيارات مشابهة",
        
        # Batch prediction
        "batch_prediction": "التنبؤ بالمجموعة",
        "upload_csv": "قم بتحميل ملف CSV يحتوي على بيانات السيارات للتنبؤ بأسعار عدة سيارات دفعة واحدة.",
        
        # Compare
        "compare_cars": "مقارنة السيارات",
        
        # Statistics
        "dataset_statistics": "إحصائيات مجموعة البيانات",
        "median_price": "متوسط السعر",
        "year_range": "نطاق السنة",
        "price_distribution": "توزيع الأسعار",
        "top_makes": "أفضل الصانعين",
        "fuel_distribution": "توزيع نوع الوقود",
        "price_trends": "اتجاهات الأسعار حسب السنة",
        "price_by_condition": "السعر حسب الحالة",
        
        # Visualizations
        "advanced_visualizations": "تصورات متقدمة",
        "interactive_viz": "تصورات تفاعلية",
        "select_viz": "اختر التصور",
        "static_viz": "تصورات ثابتة",
        "show_additional": "إظهار تصورات إضافية",
        
        # Share
        "copied_to_clipboard": "تم النسخ إلى الحافظة!",
    }
}


def t(key, lang=None):
    """
    Get translation for a key in the current language
    
    Parameters:
    -----------
    key : str
        Translation key
    lang : str, optional
        Language code ('en' or 'ku'). If None, uses session state language
        
    Returns:
    --------
    str
        Translated text, or key if translation not found
    """
    if lang is None:
        lang = st.session_state.get('language', 'en')
    
    # Get translations for the requested language, fallback to English
    translations = TRANSLATIONS.get(lang, TRANSLATIONS['en'])
    
    # Return translation or key if not found
    return translations.get(key, key)




