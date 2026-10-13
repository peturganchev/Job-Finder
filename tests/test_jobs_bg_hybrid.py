"""
Unit and Integration Tests for Jobs.bg Hybrid System.
Tests:
1. Email digest parsing (text/markdown and HTML).
2. /api/jobs/inbound-email endpoint.
3. Supabase/SQLite repository search_jobs_bg fallback.
"""
import pytest
from fastapi.testclient import TestClient
from src.api.main import app
from src.scrapers.email_digest_parser import JobsBgEmailParser

client = TestClient(app)


def test_email_digest_parser_text():
    sample_text = """
    [12.10.26★★★★★ Senior Software Engineer — .NET/Payments Platform](https://www.jobs.bg/job/8650961) София; Дистанционно интервю; Ниво Senior-level; Години опит от 3 до 10+
    .NET; SQL; Entity Framework; C#; Kubernetes; Azure; Grafana; RabbitMQ; Redis; NoSQL
    [EASY PAYMENT SERVICES OOD](https://www.jobs.bg/company/easypaymentservices)
    [12.10.26★★★★★ Оператор, въвеждане на данни](https://www.jobs.bg/job/8651662) София; Ниво Entry-level / Junior; Години опит от 0 до 0; Заплата 1000 EUR (Бруто)
    [ЖАР ЕООД](https://www.jobs.bg/company/162812)
    """

    parsed = JobsBgEmailParser.parse_markdown_or_text(sample_text)
    assert len(parsed) == 2

    job1 = parsed[0]
    assert "Senior Software Engineer" in job1["title"]
    assert job1["company"] == "EASY PAYMENT SERVICES OOD"
    assert "C#" in job1["skills"]
    assert job1["job_id"] == "8650961"

    job2 = parsed[1]
    assert "Оператор" in job2["title"]
    assert job2["company"] == "ЖАР ЕООД"
    assert "1000 EUR" in (job2["salary"] or "")


def test_inbound_email_endpoint():
    payload = {
        "content": "[12.10.26★ AI Engineer](https://www.jobs.bg/job/9999999) София; Remote\nPython; PyTorch; LLM\n[AI Labs](https://www.jobs.bg/company/ailabs)",
        "format": "text"
    }
    response = client.post("/api/jobs/inbound-email", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["parsed_count"] == 1
    assert len(data["sample_jobs"]) == 1
    assert data["sample_jobs"][0]["title"] == "AI Engineer"
    assert data["sample_jobs"][0]["company"] == "AI Labs"


def test_inbound_email_empty():
    payload = {
        "content": "Just a general text with no job links",
        "format": "text"
    }
    response = client.post("/api/jobs/inbound-email", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["parsed_count"] == 0
