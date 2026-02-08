#!/usr/bin/env python3
"""
Generate PWA icons for Car Price Predictor Pro
Creates 192x192 and 512x512 PNG icons with a car logo
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import os
    import sys

    def create_icon(size, output_path):
        """Create a car icon with specified size"""
        # Create image with dark background
        img = Image.new('RGB', (size, size), color='#0f172a')
        draw = ImageDraw.Draw(img)

        # Calculate dimensions for car shape
        width = size * 0.7
        height = size * 0.4
        x = (size - width) / 2
        y = (size - height) / 2

        # Draw car body (rounded rectangle)
        body_margin = size * 0.05
        draw.rounded_rectangle(
            [x, y + body_margin, x + width, y + height - body_margin],
            radius=size * 0.05,
            fill='#6366f1'
        )

        # Draw car windows (two rectangles)
        window_width = width * 0.25
        window_height = height * 0.4
        window_y = y + body_margin * 2

        # Left window
        draw.rounded_rectangle(
            [x + width * 0.15, window_y, x + width * 0.15 + window_width, window_y + window_height],
            radius=size * 0.02,
            fill='#1e293b'
        )

        # Right window
        draw.rounded_rectangle(
            [x + width * 0.6, window_y, x + width * 0.6 + window_width, window_y + window_height],
            radius=size * 0.02,
            fill='#1e293b'
        )

        # Draw wheels (two circles)
        wheel_radius = size * 0.08
        wheel_y = y + height - body_margin - wheel_radius

        # Left wheel
        draw.ellipse(
            [x + width * 0.2 - wheel_radius, wheel_y - wheel_radius,
             x + width * 0.2 + wheel_radius, wheel_y + wheel_radius],
            fill='#475569'
        )
        draw.ellipse(
            [x + width * 0.2 - wheel_radius * 0.5, wheel_y - wheel_radius * 0.5,
             x + width * 0.2 + wheel_radius * 0.5, wheel_y + wheel_radius * 0.5],
            fill='#64748b'
        )

        # Right wheel
        draw.ellipse(
            [x + width * 0.8 - wheel_radius, wheel_y - wheel_radius,
             x + width * 0.8 + wheel_radius, wheel_y + wheel_radius],
            fill='#475569'
        )
        draw.ellipse(
            [x + width * 0.8 - wheel_radius * 0.5, wheel_y - wheel_radius * 0.5,
             x + width * 0.8 + wheel_radius * 0.5, wheel_y + wheel_radius * 0.5],
            fill='#64748b'
        )

        # Save image
        img.save(output_path, 'PNG')
        print(f'Created icon: {output_path} ({size}x{size})')

    # Get the public/icons directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.dirname(script_dir)
    icons_dir = os.path.join(frontend_dir, 'public', 'icons')

    # Create icons directory if it doesn't exist
    os.makedirs(icons_dir, exist_ok=True)

    # Generate icons
    create_icon(192, os.path.join(icons_dir, 'icon-192x192.png'))
    create_icon(512, os.path.join(icons_dir, 'icon-512x512.png'))

    print('Icons generated successfully!')

except ImportError:
    print("Pillow (PIL) is not installed. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    print("Please run this script again.")
    sys.exit(1)
except Exception as e:
    print(f"Error generating icons: {e}")
    sys.exit(1)
