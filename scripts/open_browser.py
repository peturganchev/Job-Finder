import os
import sys
import subprocess
import time

if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def open_browser():
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    profile_dir = os.path.abspath(".browser_session")
    url = "https://www.jobs.bg/front_job_search.php?from_page=0"
    
    cmd = [
        chrome_path,
        f"--user-data-dir={profile_dir}",
        "--no-first-run",
        "--no-default-browser-check",
        url
    ]
    print(f"🚀 Стартиране на видим Chrome прозорец...")
    print(f"👉 Команда: {' '.join(cmd)}")
    subprocess.Popen(cmd)
    print("✅ Chrome е стартиран на екрана ти!")

if __name__ == "__main__":
    open_browser()
