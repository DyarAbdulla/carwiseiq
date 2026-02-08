"""
Test the normalization functions in the URL scraper
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.services.url_scraper import normalize_condition, normalize_fuel_type, validate_cylinders

def test_condition_normalization():
    """Test condition normalization"""
    print("\n" + "="*60)
    print("Testing Condition Normalization")
    print("="*60)

    test_cases = [
        ("New", "New"),
        ("new", "New"),
        ("Like New", "Like New"),
        ("like-new", "Like New"),
        ("Excellent", "Excellent"),
        ("excellent condition", "Excellent"),
        ("Very Good", "Excellent"),
        ("very-good", "Excellent"),
        ("Good", "Good"),
        ("good", "Good"),
        ("Fair", "Fair"),
        ("fair", "Fair"),
        ("Poor", "Poor"),
        ("poor condition", "Poor"),
        ("Salvage", "Salvage"),
        ("salvaged", "Salvage"),
        ("rebuilt title", "Salvage"),
        ("Unknown", "Good"),  # Should default
        ("", "Good"),  # Should default
    ]

    passed = 0
    failed = 0

    for input_val, expected in test_cases:
        result = normalize_condition(input_val)
        status = "✅" if result == expected else "❌"
        if result == expected:
            passed += 1
        else:
            failed += 1
        print(f"{status} '{input_val}' -> '{result}' (expected: '{expected}')")

    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_fuel_type_normalization():
    """Test fuel type normalization"""
    print("\n" + "="*60)
    print("Testing Fuel Type Normalization")
    print("="*60)

    test_cases = [
        ("Gasoline", "Gasoline"),
        ("gas", "Gasoline"),
        ("petrol", "Gasoline"),
        ("Petrol", "Gasoline"),
        ("Benzin", "Gasoline"),
        ("Diesel", "Diesel"),
        ("diesel", "Diesel"),
        ("Electric", "Electric"),
        ("EV", "Electric"),
        ("ev", "Electric"),
        ("battery electric", "Electric"),
        ("Hybrid", "Hybrid"),
        ("hybrid", "Hybrid"),
        ("Plug-in Hybrid", "Plug-in Hybrid"),
        ("PHEV", "Plug-in Hybrid"),
        ("phev", "Plug-in Hybrid"),
        ("plug in hybrid", "Plug-in Hybrid"),
        ("Other", "Other"),
        ("unknown", "Other"),
        ("", "Gasoline"),  # Should default
    ]

    passed = 0
    failed = 0

    for input_val, expected in test_cases:
        result = normalize_fuel_type(input_val)
        status = "✅" if result == expected else "❌"
        if result == expected:
            passed += 1
        else:
            failed += 1
        print(f"{status} '{input_val}' -> '{result}' (expected: '{expected}')")

    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_cylinders_validation():
    """Test cylinders validation"""
    print("\n" + "="*60)
    print("Testing Cylinders Validation")
    print("="*60)

    test_cases = [
        (1, 1),  # Valid
        (4, 4),  # Valid
        (6, 6),  # Valid
        (8, 8),  # Valid
        (12, 12),  # Valid (max)
        (0, 4),  # Invalid - too low
        (13, 4),  # Invalid - too high
        (20, 4),  # Invalid - too high
        (None, 4),  # None should default
        ("4", 4),  # String should convert
        ("15", 4),  # Invalid string should default
    ]

    passed = 0
    failed = 0

    for input_val, expected in test_cases:
        result = validate_cylinders(input_val)
        status = "✅" if result == expected else "❌"
        if result == expected:
            passed += 1
        else:
            failed += 1
        print(f"{status} {input_val} -> {result} (expected: {expected})")

    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


if __name__ == "__main__":
    print("\n" + "="*60)
    print("URL Scraper Normalization Tests")
    print("="*60)

    results = []
    results.append(test_condition_normalization())
    results.append(test_fuel_type_normalization())
    results.append(test_cylinders_validation())

    print("\n" + "="*60)
    print("Summary")
    print("="*60)
    if all(results):
        print("✅ All tests passed!")
        sys.exit(0)
    else:
        print("❌ Some tests failed!")
        sys.exit(1)
