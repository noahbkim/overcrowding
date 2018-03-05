import requests
import re
import os


SCHOOL_LIST = "http://www.montgomeryschoolsmd.org/schools/#school_list"
SCHOOL_REPORT = "http://www.montgomeryschoolsmd.org/departments/regulatoryaccountability/glance/currentyear/schools/"

SCHOOL_ID_PATTERN = r"schooloverview\.aspx\?s\=(\d+)"

ROOT_DIRECTORY = os.path.dirname(os.path.dirname(__file__))
REPORT_DIRECTORY = os.path.join(ROOT_DIRECTORY, "data", "reports")


def with_directories(*directories):
    """Wrapper to make sure file system directories are in place."""

    def wrapper(func):
        def wrapped(*args, **kwargs):
            for directory in directories:
                os.makedirs(directory, exist_ok=True)
            func(*args, **kwargs)
        return wrapped
    return wrapper


def scrape_school_ids(url: str=SCHOOL_LIST):
    """Scrape all school IDs using a regular expression."""

    page = requests.get(url)
    return re.findall(SCHOOL_ID_PATTERN, page.content.decode())


@with_directories(REPORT_DIRECTORY)
def download_school_reports():
    """Scrape a school report."""

    for school_id in scrape_school_ids():
        print("Downloading " + school_id)
        with open(os.path.join(REPORT_DIRECTORY, school_id + ".pdf"), "wb") as file:
            data = requests.get(SCHOOL_REPORT + school_id + ".pdf").content
            file.write(data)


download_school_reports()
