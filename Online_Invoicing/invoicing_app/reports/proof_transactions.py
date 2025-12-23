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
    """
    Build proof of transaction PDF.
    Pass `request` so we can generate absolute URLs for QR code (works with localhost or tunnel).
    """
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

    if seller.get("profile_picture"):
        try:
            c.drawImage(
                ImageReader(seller["profile_picture"]),
                width - margin_x - 60,
                y - 6,
                50,
                50,
                mask="auto"
            )
        except Exception:
            pass

    y -= 40

    # ================= BUYER =================
    buyer = data["buyer"]
    y = section_header(c, "Buyer Information", y)

    label_value(c, "Full Name", buyer.get("fullname", ""), margin_x, y); y -= 14
    label_value(c, "Email Address", buyer.get("email", ""), margin_x, y); y -= 14
    label_value(c, "Contact Number", buyer.get("phone", ""), margin_x, y); y -= 14
    label_value(c, "Social Media", buyer.get("social_media", ""), margin_x, y)

    if buyer.get("profile_picture"):
        try:
            c.drawImage(
                ImageReader(buyer["profile_picture"]),
                width - margin_x - 60,
                y - 6,
                50,
                50,
                mask="auto"
            )
        except Exception:
            pass

    y -= 40

    # ================= INVOICE =================
    invoice = data["invoice"]
    y = section_header(c, "Invoice Details", y)

    label_value(c, "Invoice Date", invoice.get("invoice_date", ""), margin_x, y); y -= 14
    label_value(c, "Due Date", invoice.get("due_date", ""), margin_x, y); y -= 14
    label_value(c, "Description", invoice.get("description", ""), margin_x, y); y -= 14
    label_value(c, "Quantity", invoice.get("quantity", ""), margin_x, y); y -= 14
    label_value(c, "Unit Price", format_amount(invoice.get("unit_price")), margin_x, y); y -= 14
    label_value(c, "Total Amount", format_amount(invoice.get("total_amount")), margin_x, y); y -= 14
    label_value(c, "Payment Status", invoice.get("status", ""), margin_x, y)

    # Invoice border
    c.setStrokeColor(colors.black)
    c.rect(margin_x - 10, y - 10, 505, 150, fill=0)

   # ================= QR =================
    if "room_hash" in data:
        c.setFont("Helvetica-Bold", 9)
        c.drawString(width - margin_x - 115, 215, "Verification Link")

    # Build full URL - use the host from the request
    if request is not None:
        # Get the full scheme and host from the request
        scheme = request.scheme  # http or https
        host = request.get_host()  # includes port if non-standard
        base_url = f"{scheme}://{host}"
    else:
        base_url = "http://localhost:8000"  # fallback

    # Prefer buyer_invoice_room link if buyer_hash is available
    if "buyer" in data and data["buyer"].get("buyer_hash"):
        qr_link = f"https://kt2980zx-8000.asse.devtunnels.ms/buyer_invoice_room/{data['room_hash']}/{data['buyer']['buyer_hash']}/"
    else:
        qr_link = f"https://kt2980zx-8000.asse.devtunnels.ms/proof_transaction/{data['room_hash']}/"

    draw_qr_code(c, qr_link, width - margin_x - 115, 110, 85)


    # ================= FOOTER =================
    c.line(50, 65, width - 50, 65)
    c.setFont("Helvetica-Oblique", 8.5)
    c.setFillColor(colors.grey)
    c.drawCentredString(width / 2, 48, "System-generated document. No signature required.")

    c.showPage()
    c.save()
    return response