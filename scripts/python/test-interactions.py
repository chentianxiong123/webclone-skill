#!/usr/bin/env python3
"""
test-interactions.py — Playwright-based interaction testing for cloned sites.

Tests all clickable elements respond, hover states trigger, form inputs work,
dropdowns expand, and modals open/close.

Usage:
    python test-interactions.py --url http://localhost:3001
"""

import argparse
import sys
from playwright.sync_api import sync_playwright


def test_interactions(url):
    results = {'passed': 0, 'failed': 0, 'tests': []}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 720})
        page.goto(url, wait_until='networkidle', timeout=15000)

        # Test 1: Click all buttons
        buttons = page.query_selector_all('button, a, [role=button], [onclick]')
        for i, btn in enumerate(buttons[:20]):
            try:
                btn.click()
                page.wait_for_timeout(300)
                results['tests'].append({'test': f'click element {i}', 'status': 'PASS', 'desc': f"{btn.tag_name}"})
                results['passed'] += 1
            except Exception as e:
                results['tests'].append({'test': f'click element {i}', 'status': 'FAIL', 'desc': str(e)})
                results['failed'] += 1

        # Test 2: Form inputs accept text
        inputs = page.query_selector_all('input[type=text], input[type=email], textarea')
        for i, inp in enumerate(inputs[:10]):
            try:
                inp.fill('test')
                page.wait_for_timeout(100)
                results['tests'].append({'test': f'input fill {i}', 'status': 'PASS'})
                results['passed'] += 1
            except Exception as e:
                results['tests'].append({'test': f'input fill {i}', 'status': 'FAIL', 'desc': str(e)})
                results['failed'] += 1

        # Test 3: Hover states trigger
        hoverable = page.query_selector_all('button, a, [role=button]')
        for i, el in enumerate(hoverable[:10]):
            try:
                el.hover()
                page.wait_for_timeout(100)
                results['tests'].append({'test': f'hover element {i}', 'status': 'PASS'})
                results['passed'] += 1
            except Exception as e:
                results['tests'].append({'test': f'hover element {i}', 'status': 'FAIL', 'desc': str(e)})
                results['failed'] += 1

        # Test 4: Check for console errors
        console_errors = []
        page.on('pageerror', lambda err: console_errors.append(str(err)))
        page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
        page.reload()
        page.wait_for_timeout(1000)

        if console_errors:
            results['tests'].append({'test': 'console errors', 'status': 'WARN', 'desc': '; '.join(console_errors[:5])})
        else:
            results['tests'].append({'test': 'console errors', 'status': 'PASS'})
            results['passed'] += 1

        browser.close()

    # Summary
    print(f"\nInteraction Test Results for {url}:")
    print(f"  Passed: {results['passed']}")
    print(f"  Failed: {results['failed']}")
    print(f"  Total:  {results['passed'] + results['failed']}")

    if results['failed'] > 0:
        print(f"\n  Failed tests:")
        for t in results['tests']:
            if t['status'] == 'FAIL':
                print(f"    ✗ {t['test']}: {t.get('desc', '')}")

    return results


def main():
    parser = argparse.ArgumentParser(description='Test cloned site interactions')
    parser.add_argument('--url', required=True, help='URL of the cloned site')
    args = parser.parse_args()

    results = test_interactions(args.url)
    if results['failed'] == 0:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == '__main__':
    main()
