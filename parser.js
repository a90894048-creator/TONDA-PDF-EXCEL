const pdfParse = require('pdf-parse');

async function parsePDF(buffer) {
  const pageTexts = [];

  const renderPage = (pageData) => {
    return pageData.getTextContent().then(content => {
      const byY = {};
      for (const item of content.items) {
        const y = Math.round(item.transform[5]);
        if (!byY[y]) byY[y] = [];
        byY[y].push({ x: item.transform[4], str: item.str });
      }
      const ys = Object.keys(byY).map(Number).sort((a, b) => b - a);
      const lines = ys.map(y =>
        byY[y].sort((a, b) => a.x - b.x).map(i => i.str).join(' ').trim()
      ).filter(l => l);
      const text = lines.join('\n');
      pageTexts.push(text);
      return text;
    });
  };

  await pdfParse(buffer, { pagerender: renderPage });
  return buildShipments(pageTexts);
}

const isBL = t => /H\.B\/L\s*:/.test(t) && !isInvoice(t) && !isPL(t);
const isInvoice = t => t.includes('COMMERCIAL INVOICE');
const isPL = t => t.includes('PACKING LIST') && !isInvoice(t);

function buildShipments(pages) {
  const shipments = [];
  let i = 0;

  while (i < pages.length) {
    const page = pages[i];

    if (isBL(page)) {
      const bl = parseBL(page);
      i++;

      let invoiceText = '';
      while (i < pages.length && !isBL(pages[i])) {
        const p = pages[i];
        if (isInvoice(p)) {
          invoiceText = p;
        } else if (invoiceText && !isPL(p)) {
          invoiceText += '\n' + p;
        }
        i++;
      }

      const items = parseInvoiceItems(invoiceText);
      shipments.push({
        hbl: bl.hbl,
        consignee: bl.consignee,
        shipper: bl.shipper,
        packages: bl.packages,
        grossWeight: bl.grossWeight,
        totalQty: bl.totalQty,
        items: items.length > 0 ? items : parseBLItems(page)
      });
    } else {
      i++;
    }
  }

  return shipments.filter(s => s.hbl && s.items.length > 0);
}

function parseBL(text) {
  const hbl = (text.match(/H\.B\/L\s*:\s*(\d+)/) || [])[1] || '';

  const consigneeM = text.match(/Consignee\s+\d{4}-\d{2}-\d{2}\s+\d{4}-\d{2}-\d{2}\s*\n([^\n]+)/);
  const consignee = consigneeM ? consigneeM[1].trim() : '';

  const shipperM = text.match(/M\.B\/L\s*:\s*\n\s*([A-Z][A-Z0-9]+)/);
  const shipper = shipperM ? shipperM[1].trim() : 'TONDA';

  const telM = text.match(/Tel\s*:\s*[\d\-]+\s+(\d+)\s+([\d.]+)/);
  const packages = telM ? parseInt(telM[1]) : 0;
  const grossWeight = telM ? parseFloat(telM[2]) : 0;

  const totalM = text.match(/Total\s+(\d[\d,]*)\s+[\d,.]+/);
  const totalQty = totalM ? parseInt(totalM[1].replace(',', '')) : 0;

  return { hbl, consignee, shipper, packages, grossWeight, totalQty };
}

function parseBLItems(text) {
  const startM = text.match(/Description\s+QTY\s+Value/);
  const endM = text.match(/\nTotal\s+\d/);
  if (!startM || !endM) return [];

  const section = text.slice(startM.index + startM[0].length, endM.index);
  const items = [];

  for (const line of section.split('\n')) {
    const m = line.match(/^([A-Z][A-Z\s\-]+?)\s{2,}(\d+)\s+([\d,.]+)\s*$/);
    if (m) {
      const desc = m[1].trim();
      if (!desc.match(/FLOOR|ROAD|LOGISTICS|CHUKHANG|JUNG-GU|BIKENZ|DANSHUN|TAICHENG/i)) {
        items.push({
          description: desc,
          qty: parseInt(m[2]),
          unitPrice: 0,
          amount: parseFloat(m[3].replace(',', ''))
        });
      }
    }
  }
  return items;
}

function parseInvoiceItems(text) {
  if (!text) return [];
  const items = [];
  const regex = /^(\d{2})\s+([A-Z][A-Z\s\-]+?)\s+(\d+)\s+([\d.]+)\s+([\d,.]+)\s*$/gm;
  let m;
  while ((m = regex.exec(text)) !== null) {
    items.push({
      description: m[2].trim(),
      qty: parseInt(m[3]),
      unitPrice: parseFloat(m[4]),
      amount: parseFloat(m[5].replace(',', ''))
    });
  }
  return items;
}

module.exports = { parsePDF };
