from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

_TEMPLATE_DIR = Path(__file__).parent / "templates"
_jinja_env = Environment(loader=FileSystemLoader(str(_TEMPLATE_DIR)), autoescape=True)


def generate_pdf(report_data: dict[str, Any]) -> bytes:
    template = _jinja_env.get_template("report.html")
    html_content = template.render(**report_data)
    return HTML(string=html_content, base_url=str(_TEMPLATE_DIR)).write_pdf()


def generate_call_sheet_pdf(data: dict[str, Any]) -> bytes:
    template = _jinja_env.get_template("call_sheet.html")
    html_content = template.render(**data)
    return HTML(string=html_content, base_url=str(_TEMPLATE_DIR)).write_pdf()


def generate_workload_schedule_pdf(data: dict[str, Any]) -> bytes:
    template = _jinja_env.get_template("workload_schedule.html")
    html_content = template.render(**data)
    return HTML(string=html_content, base_url=str(_TEMPLATE_DIR)).write_pdf()
