import { Order, ShopProfile } from "../schemas";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require("pdfkit");

export function buildShippingLabelPDF(order: Order, shop: ShopProfile, trackingNo: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [298, 420], margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = 298;
    const addr = order.recipient_address;

    doc.rect(0, 0, W, 38).fill("#EE4D2D");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(13).text("Shopee", 12, 8);
    doc.fontSize(7).font("Helvetica").text("STANDARD LOCAL", 12, 23);
    doc.roundedRect(W - 88, 7, 76, 16, 3).fill("#ffffff");
    doc.fillColor("#EE4D2D").font("Helvetica-Bold").fontSize(9).text("SPX EXPRESS", W - 85, 11, {
      width: 70,
      align: "center",
    });
    doc
      .fillColor("#ffffff")
      .font("Helvetica")
      .fontSize(7)
      .text(order.cod ? "COD" : "NON-COD", W - 88, 25, { width: 76, align: "center" });

    doc.rect(0, 38, W, 56).fill("#fff8f6");
    doc.moveTo(0, 94).lineTo(W, 94).lineWidth(1.5).strokeColor("#EE4D2D").stroke();

    const bx = 24;
    const by = 43;
    const bh = 28;
    const bars = [2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2, 3, 1, 2, 1, 2, 3, 1, 1, 2, 3, 1, 2];
    let cx = bx;
    bars.forEach((w, i) => {
      if (i % 2 === 0) doc.rect(cx, by, w * 2.8, bh).fill("#111111");
      cx += w * 2.8 + 1.2;
    });
    doc.fillColor("#111111").font("Courier-Bold").fontSize(9.5).text(trackingNo, 0, by + bh + 4, {
      width: W,
      align: "center",
    });

    doc.rect(0, 94, W, 88).fill("#ffffff");
    doc.rect(10, 100, 22, 12).fill("#EE4D2D");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.5).text("TO", 10, 103, {
      width: 22,
      align: "center",
    });
    doc.fillColor("#111111").font("Helvetica-Bold").fontSize(11).text(addr?.name || "Buyer", 38, 99);
    doc.fillColor("#333333").font("Helvetica").fontSize(8.5).text(addr?.phone || "", 38, 113);
    doc.font("Helvetica").fontSize(8).fillColor("#222222").text(addr?.full_address || "", 10, 127, {
      width: W - 20,
      lineGap: 1.5,
    });
    doc.roundedRect(10, 162, 85, 14, 2).fill("#EE4D2D");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8).text((addr?.district || "METRO MANILA").toUpperCase(), 12, 165, {
      width: 81,
      align: "center",
    });
    doc.roundedRect(100, 162, 80, 14, 2).fill("#222222");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8).text("ZIP: " + (addr?.zipcode || "1000"), 102, 165, {
      width: 76,
      align: "center",
    });
    doc.moveTo(0, 182).lineTo(W, 182).lineWidth(0.8).strokeColor("#dddddd").stroke();

    doc.rect(0, 182, W, 44).fill("#fafafa");
    doc.rect(10, 188, 32, 11).fill("#888888");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7).text("FROM", 10, 190, {
      width: 32,
      align: "center",
    });
    doc.fillColor("#222222").font("Helvetica-Bold").fontSize(8.5).text(shop.shop_name, 48, 188);
    doc.fillColor("#555555").font("Helvetica").fontSize(7.5).text("123 Mock Warehouse St, Makati City, Metro Manila 1200", 10, 202, {
      width: W - 20,
    });
    doc.text("Seller ID: " + shop.shop_id + "  |  Region: PH", 10, 213);
    doc.moveTo(0, 226).lineTo(W, 226).lineWidth(0.8).strokeColor("#dddddd").stroke();

    const metaY = 226;
    const colW = W / 3;
    [
      { label: "ORDER SN", val: order.order_sn },
      { label: "WEIGHT", val: order.order_chargeable_weight_gram + "g" },
      { label: "PAYMENT", val: order.payment_method },
    ].forEach((cell, i) => {
      const x = i * colW;
      doc.rect(x, metaY, colW, 34).fill(i % 2 === 0 ? "#ffffff" : "#f5f5f5");
      if (i > 0) doc.moveTo(x, metaY).lineTo(x, metaY + 34).lineWidth(0.5).strokeColor("#dddddd").stroke();
      doc.fillColor("#888888").font("Helvetica-Bold").fontSize(6.5).text(cell.label, x + 6, metaY + 5, { width: colW - 12 });
      doc.fillColor("#111111").font("Helvetica-Bold").fontSize(7.5).text(cell.val, x + 6, metaY + 16, { width: colW - 12 });
    });
    doc.moveTo(0, metaY + 34).lineTo(W, metaY + 34).lineWidth(0.8).strokeColor("#dddddd").stroke();

    const itemY = metaY + 34;
    doc.rect(0, itemY, W, 16).fill("#333333");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7).text("ITEM DESCRIPTION", 10, itemY + 5);
    doc.text("SKU", 185, itemY + 5);
    doc.text("QTY", 258, itemY + 5);

    let rowY = itemY + 16;
    order.item_list.forEach((item, idx) => {
      const rowH = 22;
      doc.rect(0, rowY, W, rowH).fill(idx % 2 === 0 ? "#ffffff" : "#f9f9f9");
      doc.fillColor("#111111").font("Helvetica").fontSize(7.5).text(item.item_name, 10, rowY + 4, {
        width: 170,
        ellipsis: true,
      });
      doc.fillColor("#555555").font("Courier").fontSize(7).text(item.item_sku, 185, rowY + 7, { width: 68 });
      doc.fillColor("#EE4D2D").font("Helvetica-Bold").fontSize(9).text("x" + item.model_quantity_purchased, 256, rowY + 6, {
        width: 34,
        align: "center",
      });
      doc.moveTo(0, rowY + rowH).lineTo(W, rowY + rowH).lineWidth(0.4).strokeColor("#eeeeee").stroke();
      rowY += rowH;
    });

    const totalY = Math.max(rowY + 4, 348);
    doc.moveTo(0, totalY).lineTo(W, totalY).lineWidth(1).strokeColor("#EE4D2D").stroke();
    doc.rect(0, totalY, W, 34).fill("#fff3f0");
    doc.fillColor("#555555").font("Helvetica").fontSize(7.5).text("Ship By: " + new Date((order.ship_by_date || Math.floor(Date.now() / 1000)) * 1000).toLocaleDateString("en-PH"), 10, totalY + 6);
    doc.text("Shipping Fee: PHP " + Number(order.actual_shipping_fee || 0).toFixed(2), 10, totalY + 18);
    doc.fillColor("#EE4D2D").font("Helvetica-Bold").fontSize(11).text("TOTAL: PHP " + Number(order.total_amount || 0).toFixed(2), W - 145, totalY + 10, {
      width: 135,
      align: "right",
    });

    doc.rect(0, 392, W, 28).fill("#222222");
    doc.fillColor("#aaaaaa").font("Helvetica").fontSize(6.5).text("MOCK AIRWAY BILL – FOR ODOO SHOPEE CONNECTOR TESTING ONLY", 0, 398, {
      width: W,
      align: "center",
    });
    doc.fillColor("#EE4D2D").font("Helvetica-Bold").fontSize(6.5).text("shopee.ph  |  SPX Express Philippines", 0, 408, {
      width: W,
      align: "center",
    });

    doc.end();
  });
}
