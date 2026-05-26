@echo off
echo === WebClone Skill ? Environment Setup ===
echo.

echo [1/3] Installing Python dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: pip install failed
    exit /b 1
)

echo.

echo [2/3] Installing Playwright browsers...
python -m playwright install chromium
if errorlevel 1 (
    echo ERROR: playwright install failed
    exit /b 1
)

echo.

echo [3/3] Verifying installation...
python -c "from playwright.sync_api import sync_playwright; print(\"Playwright: OK\")"
python -c "from PIL import Image; print(\"Pillow: OK\")"
python -c "import numpy; print(\"NumPy: OK\")"

echo.

echo === Setup Complete ===
echo.
echo Usage:
echo   python scripts/extractor.py ^<URL^> -o extraction.json --max
echo   python scripts/component-boundary-pipeline.py ^<URL^> -o components.json --mock-multimodal
echo   python scripts/pixel-diff.py image_a.png image_b.png --heatmap diff.png
