import { DB } from '../store/database';
import { Order } from '../store/types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

export function buildShippingLabelPDF(order: Order, tracking: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: [420, 340], margin: 0 });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const addr = order.recipient_address;
    const trkNum = tracking.replace(/\D/g, '').slice(-6) || '000000';
    const zoneNum = (parseInt(trkNum.slice(0, 2), 10) % 9) + 1;
    const routeZone = `B-${400 + zoneNum * 7}-WGP-0${(zoneNum % 6) + 1}`;
    const sortCode = `B-${494 + zoneNum}-RLC-z${(zoneNum % 3) + 1}-0${(zoneNum % 4) + 2}`;
    const hubCode = `C-0${(zoneNum % 3) + 1}-MLMIG-0${(zoneNum % 5) + 1}`;
    const dropLetter = String.fromCharCode(65 + (zoneNum % 4));
    const dropCode = `${dropLetter}-0${(zoneNum % 3) + 1}-DGT.${(zoneNum % 4) + 1}-LR`;
    const boxL = String(5 + (zoneNum % 5)).padStart(2, '0');
    const boxR = String(3 + (zoneNum % 7)).padStart(2, '0');
    const totalQty = order.item_list.reduce((s, i) => s + i.model_quantity_purchased, 0);

    const ORANGE = '#EE4D2D';
    const BLACK = '#111111';
    const GRAY = '#555555';
    const W = 420;
    const H = 340;

    doc.rect(0, 0, W, H).fill('#ffffff');

    // Header bar
    doc.rect(0, 0, W, 36).fill(ORANGE);
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('SPX EXPRESS', 10, 9);
    doc.fontSize(9).font('Helvetica').text('STANDARD LOCAL  |  COD', 125, 13);
    doc.fontSize(10).font('Helvetica-Bold').text(routeZone, 300, 11, { width: 110, align: 'right' });

    // Zone / Sort Code row
    doc.rect(0, 36, W, 52).stroke(BLACK);
    doc.fillColor(BLACK).fontSize(15).font('Helvetica-Bold').text(routeZone, 10, 42);
    doc.fontSize(8).font('Helvetica').fillColor(GRAY).text(`RTS Sort: ${sortCode}`, 10, 61).text(`Hub: ${hubCode}`, 10, 72);

    doc.rect(240, 36, 44, 52).stroke(BLACK);
    doc.rect(284, 36, 44, 52).stroke(BLACK);
    doc.fillColor(BLACK).fontSize(20).font('Helvetica-Bold').text(boxL, 248, 46).text(boxR, 292, 46);

    doc.rect(328, 36, 92, 52).stroke(BLACK);
    doc.fontSize(11).font('Helvetica-Bold').text(dropCode, 332, 54, { width: 84, align: 'center' });

    // Order & Tracking barcode section
    doc.rect(0, 88, W, 62).stroke(BLACK);
    doc.fontSize(8).font('Helvetica').fillColor(GRAY).text(`Order ID: ${order.order_sn}`, 10, 94);

    let bx = 24;
    for (let i = 0; i < 68; i++) {
      const bw = (i % 3) + 1;
      if (i % 2 === 0) {
        doc.rect(bx, 108, bw, 24).fill(BLACK);
      }
      bx += bw + 2;
    }
    doc.fillColor(BLACK).fontSize(10).font('Helvetica-Bold').text(tracking, 0, 136, { width: W, align: 'center' });

    // Buyer section
    doc.rect(0, 150, W, 80).stroke(BLACK);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(GRAY).text('BUYER', 6, 185);
    doc.moveTo(30, 150).lineTo(30, 230).stroke(GRAY);
    doc.fillColor(BLACK).fontSize(10).font('Helvetica-Bold').text(`${addr.name}   (${addr.phone})`, 36, 156);
    doc.fontSize(8).font('Helvetica').fillColor(GRAY).text(addr.full_address, 36, 170, { width: 370 }).text(`${addr.city}, ${addr.state} ${addr.zipcode}`, 36, 204);

    // Seller section
    doc.rect(0, 230, W, 50).stroke(BLACK);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(GRAY).text('SELLER', 4, 250);
    doc.moveTo(30, 230).lineTo(30, 280).stroke(GRAY);
    doc.fillColor(BLACK).fontSize(10).font('Helvetica-Bold').text(DB.shop.shop_name, 36, 236);
    doc.fontSize(8).font('Helvetica').fillColor(GRAY).text('Metro Manila, Philippines (1550)', 36, 252);

    // Bottom info & footer
    doc.fontSize(8).font('Helvetica').fillColor(GRAY).text(`Qty: ${totalQty}   Weight: 1,000 g   Total: ${order.total_amount} ${order.currency}`, 10, 290);
    doc.rect(0, 310, W, 30).fill(ORANGE);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff').text('SHOPEE EXPRESS — MOCK AIRWAY BILL', 0, 319, { align: 'center', width: W });

    doc.end();
  });
}
