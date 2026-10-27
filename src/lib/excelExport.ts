import {
  CafeteriaDatabase,
  EmployeeCreditAccount,
  InventoryMovement,
  OperatingExpense,
  SaleTransaction,
} from './types';

export const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export interface MonthlyAccountingMetrics {
  year: number;
  monthIndex: number;
  monthLabelUpper: string;
  salesInMonth: SaleTransaction[];
  expensesInMonth: OperatingExpense[];
  purchasesInMonth: InventoryMovement[];
  creditPaymentsInMonth: Array<{
    employeeName: string;
    department: string;
    date: string;
    amount: number;
    paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia';
    notes?: string;
    receivedBy: string;
  }>;
  salesEfectivo: number;
  salesTarjeta: number;
  salesCredito: number;
  salesTransferencia: number;
  ventaMensual: number;
  comprasMensuales: number;
  gastoOperativoMensual: number;
  totalSalidasMensuales: number;
  gananciaMensual: number;
  abonosEfectivoMes: number;
  ventaEfectivoCaja: number;
  salidasEfectivoMes: number;
  efectivoEntregado: number;
  productBreakdown: Array<{
    productName: string;
    quantity: number;
    grossSales: number;
  }>;
}

export function computeMonthlyAccountingMetrics(
  db: CafeteriaDatabase,
  year: number,
  monthIndex: number
): MonthlyAccountingMetrics {
  const isSameMonth = (isoDate: string) => {
    const d = new Date(isoDate);
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  };

  const salesInMonth = db.sales.filter((s) => isSameMonth(s.date));
  const expensesInMonth = db.expenses.filter((e) => isSameMonth(e.date));
  const purchasesInMonth = db.movements.filter(
    (m) => m.movementType === 'entrada_compra' && isSameMonth(m.date)
  );

  const creditPaymentsInMonth: MonthlyAccountingMetrics['creditPaymentsInMonth'] = [];
  for (const acc of db.credits || []) {
    for (const pay of acc.payments || []) {
      if (isSameMonth(pay.date)) {
        creditPaymentsInMonth.push({
          employeeName: acc.employeeName,
          department: acc.department,
          date: pay.date,
          amount: pay.amount,
          paymentMethod: pay.paymentMethod,
          notes: pay.notes,
          receivedBy: pay.receivedBy,
        });
      }
    }
  }

  const sumByMethod = (method: SaleTransaction['paymentMethod']) =>
    Number(
      salesInMonth
        .filter((s) => s.paymentMethod === method)
        .reduce((acc, s) => acc + s.total, 0)
        .toFixed(2)
    );

  const salesEfectivo = sumByMethod('Efectivo');
  const salesTarjeta = sumByMethod('Tarjeta');
  const salesCredito = sumByMethod('Crédito');
  const salesTransferencia = sumByMethod('Transferencia');

  const ventaMensual = Number(
    (salesEfectivo + salesTarjeta + salesCredito + salesTransferencia).toFixed(2)
  );

  const comprasMensuales = Number(
    purchasesInMonth.reduce((acc, m) => acc + m.totalCost, 0).toFixed(2)
  );
  const gastoOperativoMensual = Number(
    expensesInMonth.reduce((acc, e) => acc + e.amount, 0).toFixed(2)
  );
  const totalSalidasMensuales = Number(
    (comprasMensuales + gastoOperativoMensual).toFixed(2)
  );

  const gananciaMensual = Number(
    (ventaMensual - totalSalidasMensuales).toFixed(2)
  );

  const abonosEfectivoMes = Number(
    creditPaymentsInMonth
      .filter((p) => p.paymentMethod === 'Efectivo')
      .reduce((acc, p) => acc + p.amount, 0)
      .toFixed(2)
  );

  // Efectivo que entró físicamente a caja = Ventas en efectivo + Abonos de crédito en efectivo
  const ventaEfectivoCaja = Number((salesEfectivo + abonosEfectivoMes).toFixed(2));

  const gastosEfectivo = expensesInMonth
    .filter((e) => e.paymentMethod === 'Efectivo (Caja)')
    .reduce((acc, e) => acc + e.amount, 0);

  const salidasEfectivoMes = Number(
    (gastosEfectivo + comprasMensuales).toFixed(2)
  );

  const efectivoEntregado = Number(
    (ventaEfectivoCaja - salidasEfectivoMes).toFixed(2)
  );

  const prodMap = new Map<string, { productName: string; quantity: number; grossSales: number }>();
  for (const sale of salesInMonth) {
    for (const item of sale.items) {
      const existing = prodMap.get(item.productId) || {
        productName: item.productName,
        quantity: 0,
        grossSales: 0,
      };
      existing.quantity += item.quantity;
      existing.grossSales = Number((existing.grossSales + item.subtotal).toFixed(2));
      prodMap.set(item.productId, existing);
    }
  }

  const productBreakdown = Array.from(prodMap.values()).sort(
    (a, b) => b.grossSales - a.grossSales
  );

  return {
    year,
    monthIndex,
    monthLabelUpper: `${MONTH_NAMES_ES[monthIndex].toUpperCase()}${year}`,
    salesInMonth,
    expensesInMonth,
    purchasesInMonth,
    creditPaymentsInMonth,
    salesEfectivo,
    salesTarjeta,
    salesCredito,
    salesTransferencia,
    ventaMensual,
    comprasMensuales,
    gastoOperativoMensual,
    totalSalidasMensuales,
    gananciaMensual,
    abonosEfectivoMes,
    ventaEfectivoCaja,
    salidasEfectivoMes,
    efectivoEntregado,
    productBreakdown,
  };
}

function formatNum(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Dibuja el Gráfico 1 (estilo Excel: Ventas por Modalidad con barras azules y leyenda)
 */
function renderSalesChartBase64(metrics: MonthlyAccountingMetrics): string {
  const scale = 2;
  const width = 760;
  const height = 310;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(scale, scale);

  // Fondo blanco con borde gris estilo Excel
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#D1D5DB';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  // Título
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 15px Calibri, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Total', width / 2 - 40, 28);

  const items = [
    { label: 'TOTAL VENTAS EFECTIVO', short: ['TOTAL VENTAS', 'EFECTIVO'], value: metrics.salesEfectivo },
    { label: 'TOTAL VENTAS CREDITO', short: ['TOTAL VENTAS', 'CREDITO'], value: metrics.salesCredito },
    { label: 'TOTAL VENTAS TARJETA', short: ['TOTAL VENTAS', 'TARJETA'], value: metrics.salesTarjeta },
    { label: 'TOTAL VENTAS TRANSFERENCIA', short: ['TOTAL VENTAS', 'TRANSFERENCIA'], value: metrics.salesTransferencia },
  ];

  const maxVal = Math.max(100, ...items.map((i) => i.value)) * 1.18;
  const chartLeft = 40;
  const chartRight = 545;
  const chartTop = 52;
  const chartBottom = 248;
  const chartHeight = chartBottom - chartTop;
  const colWidth = (chartRight - chartLeft) / items.length;

  // Líneas horizontales y verticales suaves estilo Excel
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = chartTop + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();
  }

  for (let i = 0; i <= items.length; i++) {
    const x = chartLeft + colWidth * i;
    ctx.beginPath();
    ctx.moveTo(x, chartTop);
    ctx.lineTo(x, chartBottom);
    ctx.stroke();
  }

  // Barras azules + valores arriba + etiquetas eje X
  items.forEach((item, idx) => {
    const barW = 28;
    const centerX = chartLeft + colWidth * idx + colWidth / 2;
    const barH = Math.max(item.value > 0 ? 4 : 0, (item.value / maxVal) * chartHeight);
    const barX = centerX - barW / 2;
    const barY = chartBottom - barH;

    // Barra azul Excel (#1E56C5)
    ctx.fillStyle = '#1E56C5';
    ctx.fillRect(barX, barY, barW, barH);

    // Etiqueta de valor arriba de la barra
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 10px Calibri, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`L ${formatNum(item.value)}`, centerX, barY - 7);

    // Etiquetas abajo
    ctx.fillStyle = '#4B5563';
    ctx.font = '9.5px Calibri, Arial, sans-serif';
    item.short.forEach((line, lineIdx) => {
      ctx.fillText(line, centerX, chartBottom + 16 + lineIdx * 12);
    });
  });

  // Leyenda derecha
  const legendX = 562;
  let legendY = 120;
  items.forEach((item) => {
    ctx.fillStyle = '#1E56C5';
    ctx.fillRect(legendX, legendY - 6, 6, 6);
    ctx.fillStyle = '#4B5563';
    ctx.font = '8.5px Calibri, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.label, legendX + 10, legendY);
    legendY += 18;
  });

  return canvas.toDataURL('image/png');
}

/**
 * Dibuja el Gráfico 2 (estilo Foto 2: Barras Azul / Naranja / Gris para Venta, Compras/Gastos y Ganancia)
 */
function renderProfitChartBase64(metrics: MonthlyAccountingMetrics): string {
  const scale = 2;
  const width = 650;
  const height = 310;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(scale, scale);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#D1D5DB';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  // Título
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 15px Calibri, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Desglose de Ganancia — ${metrics.monthLabelUpper}`, width / 2, 28);

  const series = [
    { label: 'VENTA MENSUAL', value: metrics.ventaMensual, color: '#1E56C5' },
    { label: 'COMPRAS / GASTOS', value: metrics.totalSalidasMensuales, color: '#E0661F' },
    { label: 'GANANCIA DEL MES', value: Math.max(0, metrics.gananciaMensual), rawValue: metrics.gananciaMensual, color: '#7A8086' },
  ];

  // Leyenda superior horizontal (igual a Foto 2)
  let legX = 145;
  series.forEach((s) => {
    ctx.fillStyle = s.color;
    ctx.fillRect(legX, 43, 7, 7);
    ctx.fillStyle = '#4B5563';
    ctx.font = '9px Calibri, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(s.label, legX + 10, 50);
    legX += 130;
  });

  const maxVal = Math.max(100, ...series.map((s) => s.value)) * 1.22;
  const chartLeft = 85;
  const chartRight = width - 85;
  const chartTop = 70;
  const chartBottom = 262;
  const chartHeight = chartBottom - chartTop;

  // Líneas horizontales suaves
  ctx.strokeStyle = '#E5E7EB';
  for (let i = 0; i <= 5; i++) {
    const y = chartTop + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();
  }

  // 3 bloques pegados al centro exactamente como en Excel agrupado (Foto 2)
  const totalBarsWidth = 390;
  const singleBarW = totalBarsWidth / 3;
  const startX = (width - totalBarsWidth) / 2;

  series.forEach((s, idx) => {
    const barH = Math.max(s.value > 0 ? 4 : 0, (s.value / maxVal) * chartHeight);
    const x = startX + idx * singleBarW;
    const y = chartBottom - barH;

    ctx.fillStyle = s.color;
    ctx.fillRect(x, y, singleBarW, barH);

    const displayVal = 'rawValue' in s && s.rawValue !== undefined ? s.rawValue : s.value;
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 11px Calibri, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`L ${formatNum(displayVal)}`, x + singleBarW / 2, y - 8);
  });

  // Etiqueta inferior eje X
  ctx.fillStyle = '#4B5563';
  ctx.font = '10.5px Calibri, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Suma de TOTAL', width / 2, chartBottom + 22);

  return canvas.toDataURL('image/png');
}

function triggerBlobDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Genera el archivo Excel mensual idéntico al formato contable de Camila's Coffee
 * con las 4 pestañas (DESCRIPCIÓN, ENTRADAS, SALIDAS, RESUMEN) y sus 2 gráficos incrustados.
 */
export async function exportMonthlyReportToExcel(
  db: CafeteriaDatabase,
  year: number,
  monthIndex: number
): Promise<void> {
  const ExcelJS = await import('exceljs');
  const metrics = computeMonthlyAccountingMetrics(db, year, monthIndex);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Camila's Coffee";
  workbook.created = new Date();

  const currencyFmt = '"L "#,##0.00;[Red]-"L "#,##0.00;"L "-';
  const thinBorder = {
    top: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
  };

  // =========================================================================
  // PESTAÑA 1: DESCRIPCIÓN (Ventas agrupadas por producto en el mes)
  // =========================================================================
  const wsDesc = workbook.addWorksheet('DESCRIPCIÓN');
  wsDesc.columns = [
    { width: 8 },
    { width: 46 },
    { width: 18 },
    { width: 22 },
  ];
  wsDesc.mergeCells('A1:D1');
  const descTitle = wsDesc.getCell('A1');
  descTitle.value = `CAMILA'S COFFEE — DETALLE DE PRODUCTOS VENDIDOS (${metrics.monthLabelUpper})`;
  descTitle.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  descTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3D6B5E' } };
  descTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsDesc.getRow(1).height = 26;

  const descHead = wsDesc.addRow(['N°', 'PRODUCTO', 'CANTIDAD VENDIDA', 'SUBTOTAL BRUTO']);
  descHead.font = { bold: true, size: 10, color: { argb: 'FF1E293B' } };
  descHead.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    c.border = thinBorder;
  });

  metrics.productBreakdown.forEach((p, idx) => {
    const r = wsDesc.addRow([idx + 1, p.productName, p.quantity, p.grossSales]);
    r.getCell(4).numFmt = currencyFmt;
    r.eachCell((c) => {
      c.border = thinBorder;
    });
  });

  // =========================================================================
  // PESTAÑA 2: ENTRADAS (Todas las ventas del mes + abonos de créditos)
  // =========================================================================
  const wsEntradas = workbook.addWorksheet('ENTRADAS');
  wsEntradas.columns = [
    { width: 20 },
    { width: 18 },
    { width: 32 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];
  wsEntradas.mergeCells('A1:F1');
  const entTitle = wsEntradas.getCell('A1');
  entTitle.value = `CAMILA'S COFFEE — ENTRADAS Y VENTAS (${metrics.monthLabelUpper})`;
  entTitle.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  entTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3D6B5E' } };
  entTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsEntradas.getRow(1).height = 26;

  const entHead = wsEntradas.addRow([
    'FECHA',
    'COMPROBANTE',
    'CLIENTE / EMPLEADO',
    'RTN',
    'MODALIDAD PAGO',
    'TOTAL (L)',
  ]);
  entHead.font = { bold: true, size: 10 };
  entHead.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    c.border = thinBorder;
  });

  metrics.salesInMonth.forEach((s) => {
    const r = wsEntradas.addRow([
      new Date(s.date).toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'short' }),
      s.invoiceNumber,
      s.customerName,
      s.customerRtn || 'C/F',
      s.paymentMethod.toUpperCase(),
      s.total,
    ]);
    r.getCell(6).numFmt = currencyFmt;
    r.eachCell((c) => {
      c.border = thinBorder;
    });
  });

  if (metrics.creditPaymentsInMonth.length > 0) {
    wsEntradas.addRow([]);
    const abonoSub = wsEntradas.addRow(['ABONOS RECIBIDOS DE CRÉDITOS DE EMPLEADOS']);
    abonoSub.font = { bold: true, color: { argb: 'FF2F574B' } };
    metrics.creditPaymentsInMonth.forEach((p) => {
      const r = wsEntradas.addRow([
        new Date(p.date).toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'short' }),
        'ABONO-CRED',
        `${p.employeeName} (${p.department})`,
        '—',
        `ABONO (${p.paymentMethod.toUpperCase()})`,
        p.amount,
      ]);
      r.getCell(6).numFmt = currencyFmt;
      r.eachCell((c) => {
        c.border = thinBorder;
      });
    });
  }

  // =========================================================================
  // PESTAÑA 3: SALIDAS (Gastos operativos + Compras de inventario del mes)
  // =========================================================================
  const wsSalidas = workbook.addWorksheet('SALIDAS');
  wsSalidas.columns = [
    { width: 20 },
    { width: 20 },
    { width: 42 },
    { width: 24 },
    { width: 18 },
  ];
  wsSalidas.mergeCells('A1:E1');
  const salTitle = wsSalidas.getCell('A1');
  salTitle.value = `CAMILA'S COFFEE — COMPRAS Y GASTOS MENSUALES (${metrics.monthLabelUpper})`;
  salTitle.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  salTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA84A3E' } };
  salTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSalidas.getRow(1).height = 26;

  const salHead = wsSalidas.addRow([
    'FECHA',
    'TIPO SALIDA',
    'CONCEPTO / PRODUCTO',
    'MEDIO DE PAGO / REF',
    'MONTO (L)',
  ]);
  salHead.font = { bold: true, size: 10 };
  salHead.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    c.border = thinBorder;
  });

  metrics.expensesInMonth.forEach((e) => {
    const r = wsSalidas.addRow([
      new Date(e.date).toLocaleDateString('es-HN'),
      `GASTO (${e.expenseType.toUpperCase()})`,
      e.concept,
      e.paymentMethod,
      e.amount,
    ]);
    r.getCell(5).numFmt = currencyFmt;
    r.eachCell((c) => {
      c.border = thinBorder;
    });
  });

  metrics.purchasesInMonth.forEach((m) => {
    const r = wsSalidas.addRow([
      new Date(m.date).toLocaleDateString('es-HN'),
      'COMPRA INVENTARIO',
      `${m.itemName} (+${m.quantity} ${m.itemUnit})`,
      m.supplierOrReference || 'Efectivo / Caja',
      m.totalCost,
    ]);
    r.getCell(5).numFmt = currencyFmt;
    r.eachCell((c) => {
      c.border = thinBorder;
    });
  });

  // =========================================================================
  // PESTAÑA 4: RESUMEN (Idéntico a Fotos 1 y 2 con sus 2 gráficos incrustados)
  // =========================================================================
  const wsRes = workbook.addWorksheet('RESUMEN');
  wsRes.columns = [
    { width: 34 }, // A
    { width: 16 }, // B
    { width: 4 },  // C
    { width: 4 },  // D
    { width: 34 }, // E
    { width: 18 }, // F
    { width: 14 }, // G
    { width: 14 }, // H
    { width: 14 }, // I
  ];

  // Título Principal (Fila 1, E1:F1 como en Foto 1)
  wsRes.mergeCells('E1:F1');
  const t1 = wsRes.getCell('E1');
  t1.value = `DESGLOCE DE VENTA MENSUAL ${metrics.monthLabelUpper}`;
  t1.font = { bold: true, underline: true, size: 11, name: 'Calibri' };
  t1.alignment = { horizontal: 'center' };

  // Marca en A1:B1
  wsRes.mergeCells('A1:B1');
  const brandCell = wsRes.getCell('A1');
  brandCell.value = "CAMILA'S COFFEE — CONTABILIDAD";
  brandCell.font = { bold: true, size: 11, color: { argb: 'FF3D6B5E' } };

  // Tabla izquierda A4:B11 (Foto 1)
  const leftSummaryRows: Array<[string, number, boolean?]> = [
    ['TOTAL VENTAS EFECTIVO', metrics.salesEfectivo],
    ['TOTAL VENTAS TARJETA', metrics.salesTarjeta],
    ['TOTAL VENTAS CREDITO', metrics.salesCredito],
    ['TOTAL VENTAS TRANSFERENCIA', metrics.salesTransferencia],
    ['VENTA MENSUAL', metrics.ventaMensual, true],
    ['GASTO MENSUAL', metrics.totalSalidasMensuales],
    ['GANANCIA', metrics.gananciaMensual, true],
  ];

  wsRes.getCell('A4').value = 'DESCRIPCIÓN';
  wsRes.getCell('B4').value = 'TOTAL';
  ['A4', 'B4'].forEach((addr) => {
    const cell = wsRes.getCell(addr);
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = thinBorder;
  });

  leftSummaryRows.forEach(([label, val, isBold], idx) => {
    const rowNum = 5 + idx;
    const cA = wsRes.getCell(`A${rowNum}`);
    const cB = wsRes.getCell(`B${rowNum}`);
    cA.value = label;
    cB.value = val;
    cB.numFmt = currencyFmt;
    cA.border = thinBorder;
    cB.border = thinBorder;
    if (isBold) {
      cA.font = { bold: true, size: 10 };
      cB.font = { bold: true, size: 10 };
      cA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    } else {
      cA.font = { size: 10 };
      cB.font = { size: 10 };
    }
  });

  // Tabla derecha E4:F9 (Tabla dinámica / Suma de TOTAL como en Foto 1)
  wsRes.getCell('E4').value = 'DESCRIPCIÓN';
  wsRes.getCell('F4').value = 'Suma de TOTAL';
  ['E4', 'F4'].forEach((addr) => {
    const cell = wsRes.getCell(addr);
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
    cell.border = thinBorder;
  });

  const rightPivotRows: Array<[string, number, boolean?]> = [
    ['TOTAL VENTAS EFECTIVO', metrics.salesEfectivo],
    ['TOTAL VENTAS CREDITO', metrics.salesCredito],
    ['TOTAL VENTAS TARJETA', metrics.salesTarjeta],
    ['TOTAL VENTAS TRANSFERENCIA', metrics.salesTransferencia],
    ['Total general', metrics.ventaMensual, true],
  ];

  rightPivotRows.forEach(([label, val, isTotal], idx) => {
    const rowNum = 5 + idx;
    const cE = wsRes.getCell(`E${rowNum}`);
    const cF = wsRes.getCell(`F${rowNum}`);
    cE.value = label;
    cF.value = val;
    cF.numFmt = currencyFmt;
    cE.border = thinBorder;
    cF.border = thinBorder;
    if (isTotal) {
      cE.font = { bold: true, size: 10 };
      cF.font = { bold: true, size: 10 };
      cE.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
      cF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
    } else {
      cE.font = { size: 10 };
      cF.font = { size: 10 };
    }
  });

  // Incrustar Gráfico 1 (Filas 12 a 26)
  const salesChartBase64 = renderSalesChartBase64(metrics);
  if (salesChartBase64) {
    const imgId1 = workbook.addImage({
      base64: salesChartBase64,
      extension: 'png',
    });
    wsRes.addImage(imgId1, {
      tl: { col: 3, row: 11 },
      ext: { width: 680, height: 275 },
    });
  }

  // =========================================================================
  // SECCIÓN 2 EN RESUMEN: DESGLOCE DE GANANCIA MENSUAL (Foto 2 arriba)
  // =========================================================================
  wsRes.mergeCells('E28:F28');
  const t2 = wsRes.getCell('E28');
  t2.value = `DESGLOCE DE GANANCIA MENSUAL ${metrics.monthLabelUpper}`;
  t2.font = { bold: true, underline: true, size: 11 };
  t2.alignment = { horizontal: 'center' };

  wsRes.getCell('E30').value = 'Etiquetas de fila';
  wsRes.getCell('F30').value = 'Suma de TOTAL';
  ['E30', 'F30'].forEach((addr) => {
    const cell = wsRes.getCell(addr);
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF95B3D7' } };
    cell.border = thinBorder;
  });

  const profitTableRows: Array<[string, number, boolean?]> = [
    ['VENTA MENSUAL', metrics.ventaMensual],
    ['COMPRAS MENSUALES', metrics.totalSalidasMensuales],
    ['GANANCIA DEL MES', metrics.gananciaMensual, true],
  ];

  profitTableRows.forEach(([label, val, isTotal], idx) => {
    const rowNum = 31 + idx;
    const cE = wsRes.getCell(`E${rowNum}`);
    const cF = wsRes.getCell(`F${rowNum}`);
    cE.value = label;
    cF.value = val;
    cF.numFmt = currencyFmt;
    cE.border = thinBorder;
    cF.border = thinBorder;
    if (isTotal) {
      cE.font = { bold: true, size: 10 };
      cF.font = { bold: true, size: 10 };
      cE.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF95B3D7' } };
      cF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF95B3D7' } };
    }
  });

  // Incrustar Gráfico 2 (Barras Azul / Naranja / Gris igual a Foto 2)
  const profitChartBase64 = renderProfitChartBase64(metrics);
  if (profitChartBase64) {
    const imgId2 = workbook.addImage({
      base64: profitChartBase64,
      extension: 'png',
    });
    wsRes.addImage(imgId2, {
      tl: { col: 3, row: 34 },
      ext: { width: 590, height: 280 },
    });
  }

  // =========================================================================
  // SECCIÓN 3 EN RESUMEN: DESGLOCE MOVIMIENTO DE EFECTIVO (Foto 2 abajo)
  // =========================================================================
  wsRes.mergeCells('E50:F50');
  const t3 = wsRes.getCell('E50');
  t3.value = `DESGLOCE MOVIMIENTO DE EFECTIVO ${metrics.monthLabelUpper}`;
  t3.font = { bold: true, underline: true, size: 11 };
  t3.alignment = { horizontal: 'center' };

  wsRes.getCell('E52').value = 'Etiquetas de fila';
  wsRes.getCell('F52').value = 'Suma de TOTAL';
  ['E52', 'F52'].forEach((addr) => {
    const cell = wsRes.getCell(addr);
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
    cell.border = thinBorder;
  });

  const cashFlowRows: Array<[string, number, boolean?]> = [
    ['VENTA EFECTIVO', metrics.ventaEfectivoCaja],
    ['COMPRAS MENSUALES (EFECTIVO)', metrics.salidasEfectivoMes],
    ['EFECTIVO ENTREGADO', metrics.efectivoEntregado, true],
  ];

  cashFlowRows.forEach(([label, val, isTotal], idx) => {
    const rowNum = 53 + idx;
    const cE = wsRes.getCell(`E${rowNum}`);
    const cF = wsRes.getCell(`F${rowNum}`);
    cE.value = label;
    cF.value = val;
    cF.numFmt = currencyFmt;
    cE.border = thinBorder;
    cF.border = thinBorder;
    if (isTotal) {
      cE.font = { bold: true, size: 10 };
      cF.font = { bold: true, size: 10 };
      cE.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
      cF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
    }
  });

  // Abrir directamente en la pestaña RESUMEN tal como en la foto
  workbook.views = [
    {
      x: 0,
      y: 0,
      width: 10000,
      height: 20000,
      firstSheet: 0,
      activeTab: 3,
      visibility: 'visible',
    },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  triggerBlobDownload(
    buffer as ArrayBuffer,
    `FORMATO_DE_CONTABILIDAD_${MONTH_NAMES_ES[monthIndex].toUpperCase()}_${year}_Camilas_Coffee.xlsx`
  );
}

/**
 * Exporta la tabla de Créditos de Empleados Hospitalarios y el historial de cargos/abonos a Excel (.xlsx)
 */
export async function exportCreditsToExcel(
  credits: EmployeeCreditAccount[]
): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Camila's Coffee";
  workbook.created = new Date();

  const currencyFmt = '"L "#,##0.00;[Red]-"L "#,##0.00;"L "0.00';
  const thinBorder = {
    top: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
  };

  // Hoja 1: Tabla general de empleados con crédito
  const ws = workbook.addWorksheet('Empleados con Crédito');
  ws.columns = [
    { width: 6 },
    { width: 30 },
    { width: 24 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
    { width: 20 },
  ];

  ws.mergeCells('A1:J1');
  const title = ws.getCell('A1');
  title.value = "CAMILA'S COFFEE — CUENTAS POR COBRAR (CRÉDITOS DE EMPLEADOS HOSPITALARIOS)";
  title.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3D6B5E' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  const head = ws.addRow([
    'N°',
    'EMPLEADO',
    'ÁREA / DEPARTAMENTO',
    'TELÉFONO / CÓDIGO',
    'LÍMITE CRÉDITO',
    'TOTAL CONSUMIDO',
    'TOTAL ABONADO',
    'SALDO PENDIENTE',
    'ESTADO',
    'ÚLTIMO MOVIMIENTO',
  ]);
  head.font = { bold: true, size: 10, color: { argb: 'FF1E293B' } };
  head.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    c.border = thinBorder;
  });

  let sumCharged = 0;
  let sumPaid = 0;
  let sumBalance = 0;

  credits.forEach((acc, idx) => {
    sumCharged += acc.totalCharged;
    sumPaid += acc.totalPaid;
    sumBalance += acc.balance;

    const r = ws.addRow([
      idx + 1,
      acc.employeeName,
      acc.department,
      acc.employeeCodeOrPhone || '—',
      acc.creditLimit && acc.creditLimit > 0 ? acc.creditLimit : 0,
      acc.totalCharged,
      acc.totalPaid,
      acc.balance,
      acc.balance > 0 ? 'PENDIENTE' : 'CANCELADO / AL DÍA',
      new Date(acc.updatedAt).toLocaleDateString('es-HN'),
    ]);

    [5, 6, 7, 8].forEach((colIdx) => {
      r.getCell(colIdx).numFmt = currencyFmt;
    });

    if (acc.balance > 0) {
      r.getCell(8).font = { bold: true, color: { argb: 'FF9A6728' } };
      r.getCell(9).font = { bold: true, color: { argb: 'FF9A6728' } };
    } else {
      r.getCell(8).font = { color: { argb: 'FF2F574B' } };
      r.getCell(9).font = { bold: true, color: { argb: 'FF2F574B' } };
    }

    r.eachCell((c) => {
      c.border = thinBorder;
    });
  });

  const totalRow = ws.addRow([
    '',
    'TOTALES GENERALES',
    '',
    '',
    '',
    Number(sumCharged.toFixed(2)),
    Number(sumPaid.toFixed(2)),
    Number(sumBalance.toFixed(2)),
    '',
    '',
  ]);
  totalRow.font = { bold: true, size: 10.5 };
  [6, 7, 8].forEach((colIdx) => {
    totalRow.getCell(colIdx).numFmt = currencyFmt;
  });
  totalRow.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF5F2' } };
    c.border = thinBorder;
  });

  // Hoja 2: Bitácora detallada de consumos y abonos
  const wsHist = workbook.addWorksheet('Detalle Consumos y Abonos');
  wsHist.columns = [
    { width: 20 },
    { width: 28 },
    { width: 22 },
    { width: 16 },
    { width: 44 },
    { width: 18 },
    { width: 22 },
  ];

  wsHist.mergeCells('A1:G1');
  const hTitle = wsHist.getCell('A1');
  hTitle.value = "CAMILA'S COFFEE — HISTORIAL DE CARGOS AL CRÉDITO Y ABONOS RECIBIDOS";
  hTitle.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  hTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3D6B5E' } };
  hTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsHist.getRow(1).height = 26;

  const hHead = wsHist.addRow([
    'FECHA',
    'EMPLEADO',
    'ÁREA',
    'MOVIMIENTO',
    'DETALLE / MÉTODO DE PAGO',
    'MONTO (L)',
    'REGISTRADO POR',
  ]);
  hHead.font = { bold: true, size: 10 };
  hHead.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    c.border = thinBorder;
  });

  const flatEvents: Array<{
    date: string;
    employeeName: string;
    department: string;
    kind: 'CARGO CRÉDITO' | 'ABONO / PAGO';
    detail: string;
    amount: number;
    actor: string;
  }> = [];

  credits.forEach((acc) => {
    acc.charges.forEach((ch) => {
      flatEvents.push({
        date: ch.date,
        employeeName: acc.employeeName,
        department: acc.department,
        kind: 'CARGO CRÉDITO',
        detail: `${ch.invoiceNumber ? `[${ch.invoiceNumber}] ` : ''}${ch.description}`,
        amount: ch.amount,
        actor: ch.createdBy,
      });
    });
    acc.payments.forEach((py) => {
      flatEvents.push({
        date: py.date,
        employeeName: acc.employeeName,
        department: acc.department,
        kind: 'ABONO / PAGO',
        detail: `Pago en ${py.paymentMethod}${py.notes ? ` — ${py.notes}` : ''}`,
        amount: py.amount,
        actor: py.receivedBy,
      });
    });
  });

  flatEvents
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .forEach((ev) => {
      const r = wsHist.addRow([
        new Date(ev.date).toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'short' }),
        ev.employeeName,
        ev.department,
        ev.kind,
        ev.detail,
        ev.kind === 'ABONO / PAGO' ? -ev.amount : ev.amount,
        ev.actor,
      ]);
      r.getCell(6).numFmt = currencyFmt;
      r.eachCell((c) => {
        c.border = thinBorder;
      });
    });

  const buffer = await workbook.xlsx.writeBuffer();
  const todayStr = new Date().toISOString().slice(0, 10);
  triggerBlobDownload(
    buffer as ArrayBuffer,
    `Creditos_Empleados_Camilas_Coffee_${todayStr}.xlsx`
  );
}
