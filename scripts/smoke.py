#!/usr/bin/env python3
"""Production-byte browser smoke test with screenshot evidence.

The execution sandbox can centrally block browser navigation. To keep the test browser-real,
this harness loads the exact dist HTML/CSS/JS bytes into about:blank, resolves ES-module
imports by deterministic concatenation in dependency order, and changes only the localhost
E2E gate in the in-memory copy. Shipped dist files are never modified.
"""
from __future__ import annotations
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
SHOTS = ROOT / "artifacts" / "screenshots"

try:
    from playwright.sync_api import sync_playwright
except Exception as exc:
    raise SystemExit(f"Playwright Python package is required for smoke testing: {exc}")

MODULE_ORDER = [
    "src/config.js",
    "src/core/math.js",
    "src/core/rng.js",
    "src/core/storage.js",
    "src/input/actions.js",
    "src/core/simulation.js",
    "src/audio/audio.js",
    "src/render/renderer.js",
    "src/ui/ui.js",
    "src/main.js",
]


def production_harness_html() -> str:
    html = (DIST / "index.html").read_text()
    css = (DIST / "styles.css").read_text()
    html = re.sub(r'<link[^>]+href=["\']\.?/?styles\.css["\'][^>]*>', f"<style>{css}</style>", html, count=1)
    html = re.sub(r'<script[^>]+type=["\']module["\'][^>]+src=["\']\.?/?src/main\.js["\'][^>]*></script>', "", html, count=1)

    chunks: list[str] = []
    for rel in MODULE_ORDER:
        source = (DIST / rel).read_text()
        source = re.sub(r'^import\s+.*?;\s*$', '', source, flags=re.MULTILINE)
        source = re.sub(r'^export\s+', '', source, flags=re.MULTILINE)
        if rel == "src/main.js":
            source = source.replace(
                "if (['127.0.0.1', 'localhost', 'thread-null.test'].includes(location.hostname)) {",
                "if (true) {",
            ).replace("if (params.get('e2e') === '1') {", "if (true) {")
        chunks.append(f"\n// ---- {rel} ----\n{source}\n")
    bundle = "\n".join(chunks).replace("</script>", "<\\/script>")
    html = html.replace("</body>", f"<script>{bundle}</script></body>")
    return html


def main() -> int:
    subprocess.run(["node", "scripts/build.mjs"], cwd=ROOT, check=True)
    SHOTS.mkdir(parents=True, exist_ok=True)
    for old in SHOTS.glob("*.png"):
        old.unlink()

    console_errors: list[str] = []
    page_errors: list[str] = []
    document = production_harness_html()

    with sync_playwright() as p:
        executable = os.environ.get("CHROMIUM_PATH")
        if not executable and Path("/usr/bin/chromium").exists():
            executable = "/usr/bin/chromium"
        browser = p.chromium.launch(headless=True, executable_path=executable, args=["--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.set_default_timeout(8000)
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        page.set_content(document, wait_until="load")
        page.wait_for_function("window.__THREAD_NULL_READY__ === true")
        page.screenshot(path=str(SHOTS / "01-title.png"), full_page=True)
        assert page.get_by_role("button", name="START RUN").is_visible()
        page.get_by_role("button", name="START RUN").click()
        page.wait_for_function("window.__THREAD_NULL_TEST__.state().phase === 'playing'")
        page.wait_for_timeout(500)
        page.screenshot(path=str(SHOTS / "02-early-gameplay.png"), full_page=True)

        # Exercise the actual keyboard mapping before deterministic setup calls.
        page.keyboard.down("d"); page.wait_for_timeout(250); page.keyboard.up("d")
        page.evaluate("window.__THREAD_NULL_TEST__.forceLoop()")
        page.wait_for_timeout(110)
        page.screenshot(path=str(SHOTS / "03-loop-seal.png"), full_page=True)
        page.wait_for_timeout(240)
        state = page.evaluate("window.__THREAD_NULL_TEST__.state()")
        assert state["score"] > 0, state

        # Exercise the real pause button and settings flow before introducing dense hazards.
        page.locator("#pauseButton").click()
        page.wait_for_function("window.__THREAD_NULL_TEST__.state().phase === 'paused'")
        assert page.get_by_text("PAUSED", exact=True).is_visible()
        page.screenshot(path=str(SHOTS / "04-pause.png"), full_page=True)
        page.get_by_role("button", name="SETTINGS").click()
        page.locator("#qualitySelect").select_option("medium")
        assert page.locator("#qualitySelect").input_value() == "medium"
        page.screenshot(path=str(SHOTS / "05-settings.png"), full_page=True)
        page.get_by_role("button", name="APPLY").click()
        page.get_by_role("button", name="RESUME").click()
        page.wait_for_function("window.__THREAD_NULL_TEST__.state().phase === 'playing'")
        page.set_viewport_size({"width": 1280, "height": 720})
        page.wait_for_timeout(120)
        canvas_box = page.locator("#game").bounding_box()
        assert canvas_box and canvas_box["width"] > 1000 and canvas_box["height"] > 600
        page.set_viewport_size({"width": 1440, "height": 900})

        page.evaluate("window.__THREAD_NULL_TEST__.dense()")
        page.wait_for_timeout(250)
        page.screenshot(path=str(SHOTS / "03-dense-gameplay.png"), full_page=True)

        page.evaluate("window.__THREAD_NULL_TEST__.victory()")
        page.wait_for_function("window.__THREAD_NULL_TEST__.state().phase === 'victory'")
        page.wait_for_timeout(250)
        assert page.get_by_role("button", name="RUN AGAIN").is_visible()
        page.screenshot(path=str(SHOTS / "06-victory-results.png"), full_page=True)
        page.get_by_role("button", name="RUN AGAIN").click()
        page.wait_for_function("window.__THREAD_NULL_TEST__.state().phase === 'playing'")
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        page.wait_for_function("window.__THREAD_NULL_TEST__.state().phase === 'paused'")
        page.evaluate("window.__THREAD_NULL_TEST__.resume()")
        page.wait_for_function("window.__THREAD_NULL_TEST__.state().phase === 'playing'")

        page.evaluate("window.__THREAD_NULL_TEST__.failure()")
        page.wait_for_function("window.__THREAD_NULL_TEST__.state().phase === 'gameover'")
        assert page.get_by_role("button", name="RUN AGAIN").is_visible()
        page.get_by_role("button", name="RETURN TO TITLE").click()
        page.wait_for_function("window.__THREAD_NULL_TEST__.state().phase === 'title'")

        # Mobile landscape smoke using the same production-byte harness.
        mobile = browser.new_context(viewport={"width": 844, "height": 390}, has_touch=True, is_mobile=True)
        mp = mobile.new_page()
        mp.set_default_timeout(8000)
        mp.on("console", lambda m: console_errors.append("mobile: " + m.text) if m.type == "error" else None)
        mp.on("pageerror", lambda e: page_errors.append("mobile: " + str(e)))
        mp.set_content(document, wait_until="load")
        mp.wait_for_function("window.__THREAD_NULL_READY__ === true")
        mp.get_by_role("button", name="START RUN").tap()
        mp.wait_for_function("window.__THREAD_NULL_TEST__.state().phase === 'playing'")
        mp.wait_for_timeout(250)
        assert mp.locator("#touchControls").is_visible()
        assert not mp.locator("#rotateHint").is_visible()
        mp.screenshot(path=str(SHOTS / "07-mobile-landscape.png"), full_page=True)
        mobile.close()

        portrait_context = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
        portrait = portrait_context.new_page()
        portrait.set_content(document, wait_until="load")
        portrait.wait_for_function("window.__THREAD_NULL_READY__ === true")
        assert portrait.locator("#rotateHint").is_visible()
        portrait_context.close()

        context.close()

        # Clean 1920x1080 samples: fresh pages, no screenshots or automation stalls.
        profiles = {}
        user_agent = None
        for quality in ("high", "medium", "low"):
            perf_context = browser.new_context(viewport={"width": 1920, "height": 1080})
            perf = perf_context.new_page()
            perf.set_default_timeout(8000)
            perf.set_content(document, wait_until="load")
            perf.wait_for_function("window.__THREAD_NULL_READY__ === true")
            perf.evaluate("q => { const s=document.querySelector('#qualitySelect'); s.value=q; s.dispatchEvent(new Event('change',{bubbles:true})); }", quality)
            perf.get_by_role("button", name="START RUN").click()
            perf.wait_for_function("window.__THREAD_NULL_TEST__.state().phase === 'playing'")
            perf.wait_for_timeout(2800)
            profiles[quality] = perf.evaluate("window.__THREAD_NULL_METRICS__")
            if user_agent is None: user_agent = perf.evaluate("navigator.userAgent")
            perf_context.close()
        metrics = {"viewport": "1920x1080", "browser": user_agent, "profiles": profiles}
        (SHOTS / "metrics.json").write_text(json.dumps(metrics, indent=2))
        browser.close()

    if page_errors or console_errors:
        raise AssertionError(f"Browser errors: page={page_errors} console={console_errors}")
    print(f"Smoke passed. Screenshots: {SHOTS}")
    print(f"Runtime metrics snapshot: {json.dumps(metrics)}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
