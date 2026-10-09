"""
Integration test script for GeminiJobAnalyzer.
Verifies dynamic API routing:
1. Standard model (gemini-3.5-flash) using generate_content.
2. Agent model (antigravity-preview-latest) using Interactions API.
"""
import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv

# Ensure unbuffered standard output for real-time reporting
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

load_dotenv()

from src.intelligence.gemini_analyzer import (
    GeminiJobAnalyzer,
    JobMatchSchema,
    is_agent_model,
    _clean_json_text,
)


def run_unit_checks():
    """Validates model detection, clean_json_text, and fallback heuristics without API calls."""
    print("Running preliminary helper checks...", flush=True)
    # 1. Agent model detection tests
    assert is_agent_model("antigravity-preview-latest") is True
    assert is_agent_model("models/antigravity-preview-latest") is True
    assert is_agent_model("custom-agent-v1") is True
    assert is_agent_model("gemini-3.5-flash") is False
    assert is_agent_model("gemini-2.5-pro") is False
    assert is_agent_model(None) is False
    assert is_agent_model("") is False

    # 2. JSON cleaning tests
    assert _clean_json_text('{"a": 1}') == '{"a": 1}'
    assert _clean_json_text('```json\n{"a": 1}\n```') == '{"a": 1}'
    assert _clean_json_text('Here is the JSON:\n```json\n{"a": 1}\n```\nDone.') == '{"a": 1}'
    assert _clean_json_text('```[{"id": "1"}]```') == '[{"id": "1"}]'

    # 3. Fallback when unconfigured
    analyzer_unconfigured = GeminiJobAnalyzer(api_key="dummy_empty")
    analyzer_unconfigured.client = None
    fb = analyzer_unconfigured.analyze_job("Dev", "Co", "Remote", "Python agent")
    assert isinstance(fb, dict)
    assert "match_score" in fb and isinstance(fb["match_score"], int)
    print("[PASS] Preliminary helper checks passed.\n", flush=True)


def run_integration_tests():
    run_unit_checks()

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in environment or .env file.")

    dummy_profile = {
        "candidate": {
            "name": "Alex Dev",
            "title": "Junior Agentic AI Engineer",
            "summary": "Python developer passionate about Agentic AI, LangChain, and LLM orchestration.",
            "skills": ["Python", "LangChain", "FastAPI", "Prompt Engineering", "Git"],
            "goals": "Design multi-agent systems and agentic workflows."
        }
    }

    dummy_title = "Senior AI Engineer (Agentic Workflows)"
    dummy_company = "NeuroTech Innovations"
    dummy_location = "Remote"
    dummy_description = """
We are seeking an AI Engineer to build next-generation agentic workflows.
Responsibilities:
- Build multi-agent architectures using LangChain, CrewAI, and custom tool calling.
- Integrate LLM APIs with robust error handling and structured outputs.
- Build microservices in Python with FastAPI.
Requirements:
- Strong proficiency in Python and async programming.
- Hands-on experience with LLM agentic patterns, function calling, and RAG.
- Familiarity with MCP servers and vector databases is a plus.
"""

    expected_keys = [
        "match_score",
        "ai_summary",
        "matched_skills",
        "missing_skills",
        "cover_letter",
        "recommendation",
    ]

    print("=" * 60, flush=True)
    print("TEST 1: Standard Model (gemini-3.5-flash)", flush=True)
    print("=" * 60, flush=True)
    analyzer_flash = GeminiJobAnalyzer(
        api_key=api_key,
        model_name="gemini-3.5-flash",
        profile_data=dummy_profile,
    )
    assert not analyzer_flash.is_agent_model(), "gemini-3.5-flash should NOT be detected as agent model"

    result_flash = analyzer_flash.analyze_job(
        title=dummy_title,
        company=dummy_company,
        location=dummy_location,
        description=dummy_description,
    )

    print("\nResult for gemini-3.5-flash:", flush=True)
    print(json.dumps(result_flash, ensure_ascii=False, indent=2), flush=True)

    assert isinstance(result_flash, dict), "Result must be a dictionary"
    for key in expected_keys:
        assert key in result_flash, f"Key '{key}' missing from gemini-3.5-flash result"
    assert isinstance(result_flash["match_score"], int), "match_score must be an integer"
    assert 0 <= result_flash["match_score"] <= 100, "match_score must be between 0 and 100"
    print("\n[PASS] Standard model (gemini-3.5-flash) verification passed.", flush=True)

    print("\n" + "=" * 60, flush=True)
    print("TEST 2: Agent Model (antigravity-preview-latest)", flush=True)
    print("=" * 60, flush=True)
    analyzer_agent = GeminiJobAnalyzer(
        api_key=api_key,
        model_name="antigravity-preview-latest",
        profile_data=dummy_profile,
    )
    assert analyzer_agent.is_agent_model(), "antigravity-preview-latest MUST be detected as agent model"

    result_agent = analyzer_agent.analyze_job(
        title=dummy_title,
        company=dummy_company,
        location=dummy_location,
        description=dummy_description,
    )

    print("\nResult for antigravity-preview-latest:", flush=True)
    print(json.dumps(result_agent, ensure_ascii=False, indent=2), flush=True)

    assert isinstance(result_agent, dict), "Result must be a dictionary"
    for key in expected_keys:
        assert key in result_agent, f"Key '{key}' missing from antigravity-preview-latest result"
    assert isinstance(result_agent["match_score"], int), "match_score must be an integer"
    assert 0 <= result_agent["match_score"] <= 100, "match_score must be between 0 and 100"
    print("\n[PASS] Agent model (antigravity-preview-latest) verification passed.", flush=True)

    print("\n" + "=" * 60, flush=True)
    print("ALL TESTS PASSED SUCCESSFULLY!", flush=True)
    print("=" * 60, flush=True)


test_interactions_integration = run_integration_tests

if __name__ == "__main__":
    run_integration_tests()
