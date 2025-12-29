from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import qr


# ---------------- Utility ----------------

def format_amount(value):
    try:
        return f"{float(value):,.2f}"
    except Exception:
        return "0.00"


def draw_qr_code(c, data, x, y, size):
    qr_code = qr.QrCodeWidget(data)
    bounds = qr_code.getBounds()
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[0]

    d = Drawing(
        size,
        size,
        transform=[size / width, 0, 0, size / height, 0, 0]
    )
    d.add(qr_code)
    renderPDF.draw(d, c, x, y)


def section_header(c, title, y):
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, title)
    c.setStrokeColor(colors.black)
    c.line(50, y - 3, 545, y - 3)
    return y - 22


def label_value(c, label, value, x, y):
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(x, y, label)
    c.setFont("Helvetica", 9.5)
    c.drawString(x + 120, y, str(value))


# ---------------- Main PDF ----------------

def build_proof_transaction_pdf(response, data, request=None):
    c = canvas.Canvas(response, pagesize=A4)
    width, height = A4

    margin_x = 50
    y = height - 70

    # ================= HEADER =================
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(width / 2, y, "PROOF OF TRANSACTION")
    y -= 18

    c.setFont("Helvetica", 10)
    c.drawCentredString(width / 2, y, "Official Transaction Verification Document")
    y -= 12

    c.line(50, y, width - 50, y)
    y -= 30

    # ================= SELLER =================
    seller = data["seller"]
    y = section_header(c, "Seller Information", y)
    label_value(c, "Full Name", seller.get("fullname", ""), margin_x, y); y -= 14
    label_value(c, "Email Address", seller.get("email", ""), margin_x, y); y -= 14
    label_value(c, "Contact Number", seller.get("phone", ""), margin_x, y); y -= 14
    label_value(c, "Social Media", seller.get("social_media", ""), margin_x, y)
    y -= 40

    # ================= BUYER =================
    buyer = data["buyer"]
    y = section_header(c, "Buyer Information", y)
    label_value(c, "Full Name", buyer.get("fullname", ""), margin_x, y); y -= 14
    label_value(c, "Email Address", buyer.get("email", ""), margin_x, y); y -= 14
    label_value(c, "Contact Number", buyer.get("phone", ""), margin_x, y); y -= 14
    label_value(c, "Social Media", buyer.get("social_media", ""), margin_x, y)
    y -= 40

    # ================= INVOICE =================
    invoice = data["invoice"]
    y = section_header(c, "Invoice Details", y)

    label_value(c, "Invoice Date", invoice.get("invoice_date", ""), margin_x, y); y -= 14
    label_value(c, "Due Date", invoice.get("due_date", ""), margin_x, y); y -= 14
    label_value(c, "Payment Status", invoice.get("status", ""), margin_x, y); y -= 20

    # --- Multi-item support ---
    items = invoice.get("items", [])
    if items:
        # Table header
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(margin_x, y, "Product")
        c.drawString(margin_x + 150, y, "Description")
        c.drawString(margin_x + 300, y, "Qty")
        c.drawString(margin_x + 340, y, "Unit Price")
        c.drawString(margin_x + 420, y, "Line Total")
        y -= 12
        c.setStrokeColor(colors.black)
        c.line(margin_x, y, width - margin_x, y)
        y -= 14

        # Table rows
        c.setFont("Helvetica", 9.5)
        for item in items:
            c.drawString(margin_x, y, str(item.get("product_name", "")))
            c.drawString(margin_x + 150, y, str(item.get("description", "")))
            c.drawString(margin_x + 300, y, str(item.get("quantity", "")))
            c.drawString(margin_x + 340, y, format_amount(item.get("unit_price", 0)))
            c.drawString(margin_x + 420, y, format_amount(item.get("line_total", 0)))
            y -= 14

        y -= 10
        label_value(c, "Grand Total", format_amount(invoice.get("total_amount", 0)), margin_x, y)
    else:
        # Single-item fallback
        label_value(c, "Description", invoice.get("description", ""), margin_x, y); y -= 14
        label_value(c, "Quantity", invoice.get("quantity", ""), margin_x, y); y -= 14
        label_value(c, "Unit Price", format_amount(invoice.get("unit_price")), margin_x, y); y -= 14
        total = invoice.get("quantity", 0) * invoice.get("unit_price", 0)
        label_value(c, "Total Amount", format_amount(total), margin_x, y); y -= 14

    # ================= QR =================
    if "room_hash" in data:
        c.setFont("Helvetica-Bold", 9)
        c.drawString(width - margin_x - 115, 215, "Verification Link")

    if request is not None:
        scheme = request.scheme
        host = request.get_host()
        base_url = f"{scheme}://{host}"
    else:
        base_url = "http://localhost:8000"

    if "buyer" in data and data["buyer"].get("buyer_hash"):
        qr_link = f"{base_url}/buyer_invoice_room/{data['room_hash']}/{data['buyer']['buyer_hash']}/"
    else:
        qr_link = f"{base_url}/proof_transaction/{data['room_hash']}/"

    draw_qr_code(c, qr_link, width - margin_x - 115, 110, 85)

    # ================= FOOTER =================
    c.line(50, 65, width - 50, 65)
    c.setFont("Helvetica-Oblique", 8.5)
    c.setFillColor(colors.grey)
    c.drawCentredString(width / 2, 48, "System-generated document. No signature required.")

    c.showPage()
    c.save()
    return response
