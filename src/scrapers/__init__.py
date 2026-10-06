"""Scrapers package for Job Finder."""
from src.scrapers.base_scraper import BaseScraper
from src.scrapers.dev_bg import DevBgScraper
from src.scrapers.jobs_bg import JobsBgScraper
from src.scrapers.linkedin import LinkedInScraper

__all__ = ["BaseScraper", "DevBgScraper", "JobsBgScraper", "LinkedInScraper"]
