"""
Email Digest Parser for Jobs.bg notifications.
Parses structured HTML and text digests received via email subscription.
"""
import re
import os
import json
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup


class JobsBgEmailParser:
    """Parses Jobs.bg daily digest email bodies (HTML or Markdown/Plain text)."""

    @staticmethod
    def parse_markdown_or_text(content: str) -> List[Dict[str, Any]]:
        """
        Parses text or markdown digest copied or forwarded from email.
        Matches lines with:
        [Date★ Title](https://www.jobs.bg/job/ID) Location; Remote; Level...
        Skill1; Skill2; Skill3
        [Company](https://www.jobs.bg/company/...)
        """
        jobs = []
        lines = [l.strip() for l in content.splitlines() if l.strip()]
        
        i = 0
        while i < len(lines):
            line = lines[i]
            # Match job title and url: [12.10.26★★★★★ Title](https://www.jobs.bg/job/1234567)
            title_match = re.search(r'\[(?:[\d\.]+[\★,\s\-]*)?(?P<title>[^\]]+)\]\((?P<url>https://www\.jobs\.bg/job/(?P<job_id>\d+))\)\s*(?P<meta>.*)', line)

            if title_match:
                title = title_match.group("title").strip()
                # Clean up any residual stars or date fragments
                title = re.sub(r'^[\★\s,\.\-]+', '', title).strip()
                url = title_match.group("url")
                job_id = title_match.group("job_id")
                meta = title_match.group("meta") or ""
                
                # Check for salary in meta
                salary = None
                salary_m = re.search(r'Заплата\s+([^;]+)', meta)
                if salary_m:
                    salary = salary_m.group(1).strip()
                
                # Location from meta
                location = "София"
                if "София" in meta:
                    location = "София"
                    if "работа от вкъщи" in meta.lower() or "remote" in meta.lower():
                        location += " (Remote / Хибридно)"
                elif meta:
                    loc_part = meta.split(";")[0].strip()
                    if loc_part:
                        location = loc_part

                skills = []
                company = "Работодател от Jobs.bg"
                
                # Look ahead for skills and company
                lookahead_idx = i + 1
                while lookahead_idx < len(lines) and lookahead_idx <= i + 3:
                    cand_line = lines[lookahead_idx]
                    
                    # Next job header? Stop looking ahead
                    if "https://www.jobs.bg/job/" in cand_line:
                        break
                    
                    # Company pattern: [Company Name](https://www.jobs.bg/company/...)
                    comp_match = re.search(r'\[([^\]]+)\]\(https://www\.jobs\.bg/company/[^\)]+\)', cand_line)
                    if comp_match:
                        company = comp_match.group(1).strip()
                        lookahead_idx += 1
                        break
                    elif cand_line.startswith("[") and cand_line.endswith("]"):
                        company = cand_line.strip("[]").strip()
                        lookahead_idx += 1
                        break
                    
                    # Skills line (separated by semicolons, no brackets)
                    if ";" in cand_line and not cand_line.startswith("["):
                        raw_skills = [s.strip() for s in cand_line.split(";") if s.strip()]
                        if len(raw_skills) >= 2 or any(k in cand_line for k in ["Python", "Java", "SQL", "C#", "Linux", "Docker"]):
                            skills = raw_skills
                    
                    lookahead_idx += 1
                
                i = max(i + 1, lookahead_idx)

                jobs.append({
                    "job_id": job_id,
                    "url": url,
                    "title": title,
                    "company": company,
                    "location": location,
                    "salary": salary,
                    "description": f"Мета: {meta}\nУмения: {', '.join(skills)}",
                    "skills": skills,
                    "category": None,
                    "posted_date": title_match.group("raw_date") if "raw_date" in title_match.groupdict() else None,
                    "is_active": True,
                })
            else:
                i += 1

        return jobs

    @staticmethod
    def parse_html(html_content: str) -> List[Dict[str, Any]]:
        """
        Parses raw HTML email body from Jobs.bg.
        """
        soup = BeautifulSoup(html_content, "html.parser")
        jobs = []

        # Find all links to job details
        job_links = soup.select("a[href*='jobs.bg/job/']")
        seen_urls = set()

        for a in job_links:
            href = a.get("href", "")
            if not href or href in seen_urls:
                continue
            seen_urls.add(href)

            job_id_m = re.search(r'/job/(\d+)', href)
            job_id = job_id_m.group(1) if job_id_m else ""

            raw_title = a.get_text(strip=True)
            # Remove date and stars prefix like 12.10.26★★★★★
            title = re.sub(r'^\d{2}\.\d{2}\.\d{2}[\★\s,]*', '', raw_title).strip()

            # Locate surrounding row or table container
            parent = a.find_parent("td") or a.find_parent("div") or a.parent
            text_context = parent.get_text(" ", strip=True) if parent else ""

            # Extract company
            comp_elem = parent.select_one("a[href*='jobs.bg/company/']") if parent else None
            company = comp_elem.get_text(strip=True) if comp_elem else "Работодател от Jobs.bg"

            jobs.append({
                "job_id": job_id,
                "url": href,
                "title": title or raw_title,
                "company": company,
                "location": "София",
                "salary": None,
                "description": text_context,
                "skills": [],
                "category": None,
                "is_active": True,
            })

        return jobs


def batch_categorize_jobs(jobs: List[Dict[str, Any]], gemini_api_key: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Uses dedicated Gemini API key to classify jobs into internal categories.
    Batch processes up to 30 jobs in one call to minimize latency and token usage.
    """
    api_key = gemini_api_key or os.getenv("GEMINI_JOBS_BG_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key or not jobs:
        return jobs

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        
        # Prepare list for prompt
        job_items = []
        for idx, j in enumerate(jobs):
            job_items.append({
                "index": idx,
                "title": j.get("title", ""),
                "company": j.get("company", ""),
                "skills": j.get("skills", [])
            })
            
        prompt = (
            "Класифицирай следните обяви за работа в Jobs.bg в една от следните точни категории:\n"
            "- IT - Software Development\n"
            "- IT - AI / Machine Learning\n"
            "- IT - DevOps & Cloud\n"
            "- IT - QA & Automation\n"
            "- IT - System Administration & Support\n"
            "- Business & Management\n"
            "- Finance & Accounting\n"
            "- Sales & Marketing\n"
            "- Customer Support & Operations\n"
            "- Engineering & Hardware\n"
            "- Other\n\n"
            "Върни САМО валиден JSON масив от обекти с ключове 'index' и 'category'.\n\n"
            f"Обяви:\n{json.dumps(job_items, ensure_ascii=False)}"
        )

        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=prompt
        )

        text = response.text.strip()
        # Clean markdown code fences if present
        text = re.sub(r'^```json\s*', '', text)
        text = re.sub(r'^```\s*', '', text)
        text = re.sub(r'\s*```$', '', text)

        cat_results = json.loads(text)
        cat_map = {item["index"]: item["category"] for item in cat_results if "index" in item and "category" in item}

        for idx, j in enumerate(jobs):
            if idx in cat_map:
                j["category"] = cat_map[idx]
            else:
                j["category"] = "IT - Software Development"

    except Exception as e:
        print(f"⚠️ Грешка при AI категоризация на Jobs.bg обяви: {e}")
        # Fallback default category
        for j in jobs:
            if not j.get("category"):
                j["category"] = "IT - Software Development"

    return jobs


def classify_job_rule_based(title: str, text: str = "", skills: Optional[List[str]] = None) -> str:
    """
    Zero-token deterministic classifier for Jobs.bg positions.
    Accurately categorizes positions across 12 distinct industries based on title and keywords.
    Does not consume any Google AI Studio API quota.
    """
    skills_text = " ".join(skills or [])
    combined = f"{title} {text} {skills_text}".lower()

    # 1. AI & Machine Learning
    if any(k in combined for k in [
        "ai engineer", "machine learning", "deep learning", "llm", "data scientist", 
        "nlp", "computer vision", "generative ai", "prompt engineer", "artificial intelligence",
        "mlops", "pytorch", "tensorflow"
    ]):
        return "IT - AI & Machine Learning"

    # 2. DevOps & Cloud
    if any(k in combined for k in [
        "devops", "cloud engineer", "kubernetes", "docker", "aws", "azure", "gcp", 
        "site reliability", "sre", "terraform", "infrastructure", "ansible", "ci/cd"
    ]):
        return "IT - DevOps & Cloud"

    # 3. QA & Testing
    if any(k in combined for k in [
        "qa", "quality assurance", "test engineer", "automation qa", "selenium", 
        "cypress", "tester", "софтуерен тестер"
    ]):
        return "IT - QA & Testing"

    # 4. Software Development
    if any(k in combined for k in [
        "developer", "software engineer", "frontend", "backend", "fullstack", "full stack", 
        "python", "java", "c#", ".net", "javascript", "typescript", "react", "angular", 
        "vue", "golang", "php", "c++", "ios", "android", "mobile developer", "програмист"
    ]):
        return "IT - Software Development"

    # 5. SysAdmin & Technical Support
    if any(k in combined for k in [
        "helpdesk", "help desk", "system administrator", "системен администратор", 
        "поддръжка", "it support", "network engineer", "технически сътрудник", "service desk"
    ]):
        return "IT - System Administration & Support"

    # 6. Finance & Accounting
    if any(k in combined for k in [
        "счетоводител", "счетоводство", "финанс", "accountant", "payroll", "одитор", 
        "audit", "фактуриране", "банкер", "кредитен", "трз"
    ]):
        return "Finance & Accounting"

    # 7. Sales & Marketing
    if any(k in combined for k in [
        "sales", "marketing", "търговски", "търговец", "продажби", "account manager", 
        "маркетинг", "seo", "social media", "business development", "консултант продажби"
    ]):
        return "Sales & Marketing"

    # 8. Human Resources
    if any(k in combined for k in [
        "hr", "human resources", "recruiter", "подбор", "специалист подбор", "talent acquisition"
    ]):
        return "Human Resources & Recruiting"

    # 9. Management & Operations
    if any(k in combined for k in [
        "project manager", "product manager", "scrum master", "директор", "управител", 
        "оператор въвеждане", "operations", "мениджър", "ръководител", "team lead"
    ]):
        return "Management & Operations"

    # 10. Logistics & Transport
    if any(k in combined for k in [
        "шофьор", "логистика", "склад", "складов", "спедитор", "куриер", "доставчик", "мотокарист"
    ]):
        return "Logistics & Transport"

    # 11. Engineering & Technical
    if any(k in combined for k in [
        "инженер", "електроинженер", "механик", "техник", "cnc", "стругар", 
        "електротехник", "заварчик", "конструктор"
    ]):
        return "Engineering & Technical"

    # 12. Customer Service & Hospitality
    if any(k in combined for k in [
        "хост", "хостеса", "сервитьор", "барман", "клиентско", "call center", 
        "рецепционист", "касиер", "продавач"
    ]):
        return "Customer Service & Hospitality"

    return "Other"

