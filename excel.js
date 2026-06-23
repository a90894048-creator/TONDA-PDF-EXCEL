const XLSX = require('./node_modules/xlsx');

function generateExcel(shipments) {
  const wb = XLSX.utils.book_new();

  const headers = [
    '납세자', '수입자통관고유부호', '화주명', '비엘번호', '해외거래처상호',
    '세번부호', '세율구분', '규격1', '규격2', '규격3', '가공공정', '성분1',
    '수량', '수량\r\n단위', '단가', '금액', '순중량', 'FILE 1',
    '총수량', '총중량', '총순중량', ''
  ];

  const rows = [headers];

  for (const s of shipments) {
    const { hbl, consignee, shipper, grossWeight, totalQty, items } = s;

    items.forEach((item, idx) => {
      rows.push([
        '',
        '',
        consignee,
        hbl,
        shipper,
        '',
        '',
        item.description,
        '',
        '',
        '',
        '',
        item.qty,
        'PC',
        item.unitPrice || '',
        item.amount,
        '',
        '',
        idx === 0 ? (totalQty || '') : '',
        idx === 0 ? (grossWeight || '') : '',
        '',
        ''
      ]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 26 },
    { wch: 14 }, { wch: 10 }, { wch: 32 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 15 }, { wch: 8  }, { wch: 6  }, { wch: 8  },
    { wch: 10 }, { wch: 10 }, { wch: 8  }, { wch: 8  }, { wch: 10 },
    { wch: 10 }, { wch: 6  }
  ];

  XLSX.utils.book_append_sheet(wb, ws, '입력값');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { generateExcel };
