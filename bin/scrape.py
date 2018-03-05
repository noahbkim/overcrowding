import requests
import re


SCHOOL_LIST = "http://www.montgomeryschoolsmd.org/schools/#school_list"
SCHOOL_REPORT = "http://www.montgomeryschoolsmd.org/departments/regulatoryaccountability/glance/currentyear/schools/"

SCHOOL_ID_PATTERN = r"schooloverview\.aspx\?s\=(\d+)"


def scrape_school_ids(url: str=SCHOOL_LIST):
    """Scrape all school IDs using a regular expression."""

    page = requests.get(url)
    return re.findall(SCHOOL_ID_PATTERN, page.content.decode())


def scrape_school_report(id: str):
    """Scrape a school report."""

    
