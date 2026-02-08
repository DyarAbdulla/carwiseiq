# 🚩 Flag Emoji Reference for Language Switcher

## Current Flags in Your App

Location: `app.py` lines 920-923

```python
language_options = [
    ("🇬🇧", "English", "en"),      # United Kingdom flag
    ("🇮🇶", "کوردی", "ku"),        # Iraq flag (for Kurdish)
    ("🇸🇦", "العربية", "ar")       # Saudi Arabia flag (for Arabic)
]
```

## How to Change Flags

Edit the first element in each tuple in `app.py`:

```python
language_options = [
    ("YOUR_FLAG_HERE", "English", "en"),
    ("YOUR_FLAG_HERE", "کوردی", "ku"),
    ("YOUR_FLAG_HERE", "العربية", "ar")
]
```

## Popular Flag Emoji Options

### English Language Flags:
- 🇬🇧 United Kingdom (current)
- 🇺🇸 United States
- 🇦🇺 Australia
- 🇨🇦 Canada
- 🇳🇿 New Zealand

### Kurdish Language Flags:
- 🇮🇶 Iraq (current - Kurdistan region is in Iraq)
- 🇹🇷 Turkey (some Kurdish speakers)
- 🇸🇾 Syria (some Kurdish speakers)
- 🇮🇷 Iran (some Kurdish speakers)

### Arabic Language Flags:
- 🇸🇦 Saudi Arabia (current)
- 🇪🇬 Egypt
- 🇦🇪 United Arab Emirates
- 🇯🇴 Jordan
- 🇱🇧 Lebanon
- 🇸🇾 Syria
- 🇮🇶 Iraq
- 🇰🇼 Kuwait
- 🇶🇦 Qatar
- 🇧🇭 Bahrain
- 🇴🇲 Oman
- 🇾🇪 Yemen
- 🇲🇦 Morocco
- 🇩🇿 Algeria
- 🇹🇳 Tunisia
- 🇱🇾 Libya
- 🇸🇩 Sudan
- 🇸🇴 Somalia

## Other Useful Emojis (if you want non-flag options):
- 🌐 Globe (for language)
- 🗣️ Speaking head
- 💬 Speech bubble
- 📝 Memo
- ✍️ Writing hand

## Quick Copy-Paste Format

Here's the exact code section to edit in `app.py`:

```python
# Language options - clean format
language_options = [
    ("🇬🇧", "English", "en"),      # Change this flag
    ("🇮🇶", "کوردی", "ku"),        # Change this flag
    ("🇸🇦", "العربية", "ar")       # Change this flag
]
```

## Example: Change to Different Flags

If you want to use different flags, for example:

```python
language_options = [
    ("🇺🇸", "English", "en"),      # US flag instead of UK
    ("🇮🇶", "کوردی", "ku"),        # Keep Iraq for Kurdish
    ("🇪🇬", "العربية", "ar")       # Egypt flag for Arabic
]
```

Just copy the emoji you want and paste it in place of the current one!

