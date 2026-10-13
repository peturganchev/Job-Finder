import os
import sys
import json
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from src.scrapers.email_digest_parser import JobsBgEmailParser, classify_job_rule_based
from src.database.repository import get_repository

TRANSCRIPT_PATH = r"C:\Users\Petur\.gemini\antigravity\brain\f056641e-472b-4d6a-9ec3-318cfc88d38f\.system_generated\logs\transcript_full.jsonl"

def main():
    load_dotenv()
    repo = get_repository()

    print("🔍 Reading seed jobs from user's email digest in transcript...")
    seed_text = None
    if os.path.exists(TRANSCRIPT_PATH):
        with open(TRANSCRIPT_PATH, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    entry = json.loads(line)
                    if entry.get("step_index") == 2482:
                        seed_text = entry.get("content", "")
                        break
                except Exception:
                    pass

    if not seed_text:
        print("❌ Could not find step 2482 in transcript.")
        return

    # Remove outer tags like <USER_REQUEST> if present
    if "<USER_REQUEST>" in seed_text:
        seed_text = seed_text.split("<USER_REQUEST>")[1].split("</USER_REQUEST>")[0]

    os.makedirs("data", exist_ok=True)
    with open("data/seed_jobs_digest.txt", "w", encoding="utf-8") as f:
        f.write(seed_text)

    print(f"📄 Saved seed digest ({len(seed_text)} chars). Parsing jobs...")
    jobs = JobsBgEmailParser.parse_markdown_or_text(seed_text)
    print(f"📦 Parsed {len(jobs)} jobs from email digest.")

    # Classify each job with zero tokens rule-based
    for j in jobs:
        cat = classify_job_rule_based(j["title"], j["description"], j.get("skills", []))
        j["category"] = cat

    print("💾 Upserting into Supabase `jobs_bg` catalog table...")
    saved_count = repo.upsert_jobs_bg(jobs)
    print(f"🎉 Successfully upserted {saved_count} jobs into `jobs_bg`!")

    # Verify breakdown
    from collections import Counter
    cats = Counter([j["category"] for j in jobs])
    print("\n📊 Category Breakdown:")
    for cat, count in cats.most_common():
        print(f"  • {cat}: {count}")

if __name__ == "__main__":
    main()
