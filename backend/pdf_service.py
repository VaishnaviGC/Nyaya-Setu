"""Turns a plain-text complaint letter into a downloadable PDF."""

from fpdf import FPDF
from io import BytesIO


def letter_to_pdf_bytes(letter_text: str, title: str = "Complaint Letter") -> bytes:
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, title, ln=True, align="C")
    pdf.ln(4)

    pdf.set_font("Helvetica", size=11)
    # fpdf2's multi_cell wraps automatically; encode-safe for characters outside latin-1
    safe_text = letter_text.encode("latin-1", "replace").decode("latin-1")
    for paragraph in safe_text.split("\n"):
        # fpdf2 quirk: multi_cell(w=0) computes width from the CURRENT x
        # position, which it doesn't always reset to the left margin after
        # a single-line cell. Explicitly resetting x before every call
        # avoids "Not enough horizontal space" errors on the 2nd+ line.
        pdf.set_x(pdf.l_margin)
        if paragraph.strip() == "":
            pdf.ln(6.5)  # blank line - multi_cell can't render an empty string
        else:
            pdf.multi_cell(0, 6.5, paragraph)

    buffer = BytesIO()
    pdf.output(buffer)
    return buffer.getvalue()
