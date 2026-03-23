from datetime import datetime

from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.graphics.shapes import Drawing, Rect
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import qr


W               = 80 * mm
MARGIN          = 10
CW              = W - MARGIN * 2


def generate_filename(date_created=None):
    if date_created is None:
        date_str = datetime.now().strftime("%Y%m%d")
    elif isinstance(date_created, datetime):
        date_str = date_created.strftime("%Y%m%d")
    else:
        date_str = str(date_created).replace("-","").replace("/","").replace(" ","").replace(":","")[:8]
    return f"Proof_Transaction_{date_str}.pdf"


def fmt(value):
    try:
        return f"{float(value):,.2f}"
    except (TypeError, ValueError):
        return "0.00"


def sf(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def wrap(c, text, max_w, font, size):
    words = str(text).split()
    lines, cur = [], []
    for w in words:
        probe = " ".join(cur + [w])
        if c.stringWidth(probe, font, size) <= max_w:
            cur.append(w)
        else:
            if cur:
                lines.append(" ".join(cur))
            cur = [w]
    if cur:
        lines.append(" ".join(cur))
    return lines or [""]


def put(c, text, x, y, max_w, font, size, lh, align="left"):
    lines = wrap(c, text, max_w, font, size)
    c.setFont(font, size)
    for line in lines:
        if align == "center":
            c.drawCentredString(x, y, line)
        elif align == "right":
            c.drawRightString(x, y, line)
        else:
            c.drawString(x, y, line)
        y -= lh
    return y


def qr_code(c, data, x, y, size):
    widget = qr.QrCodeWidget(data)
    bx0, by0, bx1, by1 = widget.getBounds()
    d = Drawing(size, size, transform=[size / (bx1 - bx0), 0, 0, size / (by1 - by0), 0, 0])
    d.add(widget)
    renderPDF.draw(d, c, x, y)


def _qr_block(c, data, y, width, request):
    if not data.get("room_hash"):
        return y
    base = f"{request.scheme}://{request.get_host()}" if request else "http://localhost:8000"
    bh = data.get("buyer", {}).get("buyer_hash")
    url = f"{base}/buyer_invoice_room/{data['room_hash']}/{bh}/" if bh else f"{base}/proof_transaction/{data['room_hash']}/"
    sz = 64
    qx = (width - sz) / 2
    c.setFont("Helvetica", 6)
    c.setFillColor(colors.HexColor("#666666"))
    c.drawCentredString(width / 2, y, "Scan to verify")
    y -= 10
    qr_code(c, url, qx, y - sz, sz)
    y -= sz + 8
    c.setFont("Helvetica-Bold", 6)
    c.setFillColor(colors.black)
    lbl = "Room: "
    lw = c.stringWidth(lbl, "Helvetica-Bold", 6)
    c.drawString(MARGIN, y, lbl)
    c.setFillColor(colors.HexColor("#BB0000"))
    c.drawString(MARGIN + lw, y, data["room_hash"])
    y -= 9
    c.setFont("Helvetica", 5.5)
    c.setFillColor(colors.HexColor("#888888"))
    y = put(c, "Keep this hash — required to decrypt transaction data.", MARGIN, y, CW, "Helvetica", 5.5, 8)
    return y - 4


def _footer(c, y, width):
    c.setStrokeColor(colors.HexColor("#CCCCCC"))
    c.setDash(1, 3)
    c.line(MARGIN, y, width - MARGIN, y)
    c.setDash()
    y -= 8
    c.setFont("Helvetica-Oblique", 5.5)
    c.setFillColor(colors.HexColor("#AAAAAA"))
    c.drawCentredString(width / 2, y, "System-generated document. No signature required.")
    return y


def _estimate(value, chars=28):
    return 8 * max(1, len(str(value)) // chars + 1) + 3


def _height_single(data):
    h = 60
    inv = data.get("invoice", {})
    h += 30 + _estimate(inv.get("description", ""), 22) + 20
    for p in (data.get("seller", {}), data.get("buyer", {})):
        h += 18
        for f in ("fullname", "email", "phone", "social_media"):
            if p.get(f):
                h += _estimate(p[f], 30) + 6
    h += 36
    if data.get("room_hash"):
        h += 108
    h += 30
    return max(h, 380)


def _height_multi(data):
    h = 50
    inv = data.get("invoice", {})
    for f in ("invoice_date", "due_date", "payment_method", "status"):
        if inv.get(f):
            h += 11
    h += 8
    for item in inv.get("items", []):
        h += 10
        if item.get("description"):
            h += _estimate(item["description"], 32)
        h += 10
    h += 20
    for p in (data.get("seller", {}), data.get("buyer", {})):
        h += 14
        for f in ("fullname", "email", "phone", "social_media"):
            if p.get(f):
                h += 9
    h += 16
    if data.get("room_hash"):
        h += 108
    h += 24
    return max(h, 420)


def _build_single(c, data, request):
    width = W
    inv = data.get("invoice", {})
    seller = data.get("seller", {})
    buyer = data.get("buyer", {})

    page_h = _height_single(data)
    c._pagesize = (width, page_h)
    y = page_h - 18

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(width / 2, y, "PROOF OF TRANSACTION")
    y -= 13

    c.setFont("Helvetica", 6)
    c.setFillColor(colors.HexColor("#888888"))
    c.drawCentredString(width / 2, y, "Official Transaction Verification")
    y -= 10

    c.setStrokeColor(colors.black)
    c.setLineWidth(1.5)
    c.line(MARGIN, y, width - MARGIN, y)
    c.setLineWidth(1)
    y -= 4
    c.setStrokeColor(colors.HexColor("#BBBBBB"))
    c.line(MARGIN + 4, y, width - MARGIN - 4, y)
    y -= 16

    description = str(inv.get("description", "")).strip()
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(colors.black)
    y = put(c, description.upper(), width / 2, y, CW, "Helvetica-Bold", 9, 11, align="center")
    y -= 6

    qty       = sf(inv.get("quantity", 1))
    unit      = sf(inv.get("unit_price", 0))
    stored    = sf(inv.get("total_amount", 0))
    total     = stored if stored else qty * unit

    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(colors.black)
    c.drawCentredString(width / 2, y, f"PHP {fmt(total)}")
    y -= 14

    if qty > 1:
        c.setFont("Helvetica", 6.5)
        c.setFillColor(colors.HexColor("#666666"))
        qty_int = int(qty) if qty == int(qty) else qty
        c.drawCentredString(width / 2, y, f"{qty_int} unit(s)  x  PHP {fmt(unit)}  each")
        y -= 10

    y -= 6
    c.setStrokeColor(colors.HexColor("#DDDDDD"))
    c.setDash(3, 3)
    c.line(MARGIN, y, width - MARGIN, y)
    c.setDash()
    y -= 12

    meta_rows = []
    if inv.get("invoice_date"):
        meta_rows.append(("Date",    inv["invoice_date"]))
    if inv.get("due_date"):
        meta_rows.append(("Due",     inv["due_date"]))
    if inv.get("payment_method"):
        meta_rows.append(("Payment", inv["payment_method"]))
    if inv.get("status"):
        meta_rows.append(("Status",  inv["status"].upper()))

    for label, val in meta_rows:
        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(colors.HexColor("#444444"))
        c.drawString(MARGIN, y, label)
        c.setFont("Helvetica", 6.5)
        c.setFillColor(colors.black)
        c.drawRightString(width - MARGIN, y, str(val))
        y -= 10

    y -= 4
    c.setStrokeColor(colors.HexColor("#DDDDDD"))
    c.setDash(3, 3)
    c.line(MARGIN, y, width - MARGIN, y)
    c.setDash()
    y -= 14

    for section_label, party in (("SOLD BY", seller), ("PURCHASED BY", buyer)):
        c.setFont("Helvetica-Bold", 6)
        c.setFillColor(colors.HexColor("#888888"))
        c.drawCentredString(width / 2, y, section_label)
        y -= 9

        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(colors.black)
        y = put(c, party.get("fullname", ""), width / 2, y, CW, "Helvetica-Bold", 7.5, 9, align="center")

        for field in ("email", "phone", "social_media"):
            val = party.get(field, "")
            if val:
                c.setFont("Helvetica", 6)
                c.setFillColor(colors.HexColor("#555555"))
                y = put(c, val, width / 2, y, CW, "Helvetica", 6, 8, align="center")

        y -= 10

    y -= 2
    y = _qr_block(c, data, y, width, request)
    y -= 4
    _footer(c, y, width)


def _build_multi(c, data, request):
    width = W
    inv = data.get("invoice", {})
    items = inv.get("items", [])
    seller = data.get("seller", {})
    buyer = data.get("buyer", {})

    page_h = _height_multi(data)
    c._pagesize = (width, page_h)
    y = page_h - 14

    c.setFillColor(colors.black)
    c.rect(0, y - 2, width, 20, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(width / 2, y + 3, "PROOF OF TRANSACTION")
    y -= 10

    c.setFillColor(colors.HexColor("#222222"))
    c.rect(0, y - 2, width, 12, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 6)
    c.drawCentredString(width / 2, y + 1, "Official Transaction Verification")
    y -= 14

    c.setFillColor(colors.black)
    meta_left = []
    if inv.get("invoice_date"):
        meta_left.append(("Date",    inv["invoice_date"]))
    if inv.get("due_date"):
        meta_left.append(("Due",     inv["due_date"]))

    meta_right = []
    if inv.get("payment_method"):
        meta_right.append(("Payment", inv["payment_method"]))
    if inv.get("status"):
        meta_right.append(("Status",  inv["status"].upper()))

    rows = max(len(meta_left), len(meta_right))
    for i in range(rows):
        if i < len(meta_left):
            lbl, val = meta_left[i]
            c.setFont("Helvetica-Bold", 6)
            c.setFillColor(colors.HexColor("#555555"))
            c.drawString(MARGIN, y, lbl + ":")
            c.setFont("Helvetica", 6)
            c.setFillColor(colors.black)
            c.drawString(MARGIN + 24, y, str(val))
        if i < len(meta_right):
            lbl, val = meta_right[i]
            c.setFont("Helvetica-Bold", 6)
            c.setFillColor(colors.HexColor("#555555"))
            c.drawRightString(width - MARGIN - c.stringWidth(str(val), "Helvetica", 6) - 2, y, lbl + ":")
            c.setFont("Helvetica", 6)
            c.setFillColor(colors.black)
            c.drawRightString(width - MARGIN, y, str(val))
        y -= 10

    y -= 4
    c.setFillColor(colors.black)
    c.rect(MARGIN, y - 1, CW, 11, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 6.5)
    col_desc  = MARGIN + 3
    col_qty   = MARGIN + 100
    col_unit  = MARGIN + 128
    col_total = width - MARGIN - 3
    c.drawString(col_desc, y + 2, "DESCRIPTION")
    c.drawCentredString(col_qty,  y + 2, "QTY")
    c.drawCentredString(col_unit, y + 2, "UNIT")
    c.drawRightString(col_total,  y + 2, "AMOUNT")
    y -= 13

    grand_total = 0.0
    stripe = colors.HexColor("#F5F5F5")

    for idx, item in enumerate(items):
        product = str(item.get("product_name", "Item"))
        desc    = str(item.get("description", "")).strip()
        qty     = sf(item.get("quantity", 1))
        unit    = sf(item.get("unit_price", 0))
        line    = sf(item.get("line_total", qty * unit))
        grand_total += line

        desc_lines = wrap(c, product, col_qty - col_desc - 4, "Helvetica-Bold", 6.5)
        extra_lines = wrap(c, desc, col_qty - col_desc - 6, "Helvetica", 5.5) if desc else []
        row_h = len(desc_lines) * 8 + (len(extra_lines) * 7 if extra_lines else 0) + 6

        if idx % 2 == 0:
            c.setFillColor(stripe)
            c.rect(MARGIN, y - row_h + 8, CW, row_h, fill=1, stroke=0)

        ry = y
        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(colors.black)
        for ln in desc_lines:
            c.drawString(col_desc, ry, ln)
            ry -= 8
        if extra_lines:
            c.setFont("Helvetica", 5.5)
            c.setFillColor(colors.HexColor("#666666"))
            for ln in extra_lines:
                c.drawString(col_desc + 2, ry, ln)
                ry -= 7

        mid_y = y - (row_h / 2) + 4
        qty_str = str(int(qty)) if qty == int(qty) else str(qty)
        c.setFont("Helvetica", 6.5)
        c.setFillColor(colors.black)
        c.drawCentredString(col_qty,   mid_y, qty_str)
        c.drawCentredString(col_unit,  mid_y, fmt(unit))
        c.setFont("Helvetica-Bold", 6.5)
        c.drawRightString(col_total,   mid_y, fmt(line))

        y -= row_h

    c.setStrokeColor(colors.HexColor("#BBBBBB"))
    c.line(MARGIN, y, width - MARGIN, y)
    y -= 12

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 6.5)
    c.drawString(MARGIN, y, f"{len(items)} item(s)")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGIN + 60, y, "TOTAL")
    c.drawRightString(width - MARGIN, y, f"PHP {fmt(grand_total)}")
    y -= 18

    c.setStrokeColor(colors.HexColor("#BBBBBB"))
    c.line(MARGIN, y, width - MARGIN, y)
    y -= 8

    for section_label, party in (("SELLER", seller), ("BUYER", buyer)):
        row_start = y
        c.setFont("Helvetica-Bold", 6)
        c.setFillColor(colors.HexColor("#888888"))
        c.drawString(MARGIN, y, section_label)
        y -= 9

        name_x = MARGIN + c.stringWidth(section_label + "  ", "Helvetica-Bold", 6)
        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(colors.black)
        c.drawString(MARGIN, y, party.get("fullname", ""))
        y -= 8

        for field in ("email", "phone", "social_media"):
            val = party.get(field, "")
            if val:
                c.setFont("Helvetica", 6)
                c.setFillColor(colors.HexColor("#555555"))
                c.drawString(MARGIN + 4, y, val)
                y -= 8
        y -= 5

    y -= 2
    y = _qr_block(c, data, y, width, request)
    y -= 4
    _footer(c, y, width)


def build_proof_transaction_pdf(response, data, request=None, date_created=None):
    inv = data.get("invoice", {})
    is_multi = bool(inv.get("items"))

    if is_multi:
        page_h = _height_multi(data)
    else:
        page_h = _height_single(data)

    c = canvas.Canvas(response, pagesize=(W, page_h))

    if is_multi:
        _build_multi(c, data, request)
    else:
        _build_single(c, data, request)

    c.showPage()
    c.save()
    return response