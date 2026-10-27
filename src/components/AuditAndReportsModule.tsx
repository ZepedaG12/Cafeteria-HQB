'use client';

import React, { useState, useMemo } from 'react';
import {
  Scale,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Coins,
  FileSpreadsheet,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { CafeteriaDatabase } from '@/lib/types';
import { formatLempira } from '@/lib/currency';
import {
  computeMonthlyAccountingMetrics,
  exportMonthlyReportToExcel,
  MONTH_NAMES_ES,
} from '@/lib/excelExport';

interface AuditAndReportsModuleProps {
  db: CafeteriaDatabase;
  onRefresh: (newDb: CafeteriaDatabase) => void;
}

const AVAILABLE_YEARS = [2024, 2025, 2026, 2027, 2028];

export default function AuditAndReportsModule({
  db,
  onRefresh,
}: AuditAndReportsModuleProps) {
  const [subTab, setSubTab] = useState<'mensual' | 'financiero' | 'auditoria'>('mensual');

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(
    AVAILABLE_YEARS.includes(now.getFullYear()) ? now.getFullYear() : 2026
  );
  const [exportingMonthly, setExportingMonthly] = useState(false);

  const monthlyMetrics = useMemo(
    () => computeMonthlyAccountingMetrics(db, selectedYear, selectedMonth),
    [db, selectedYear, selectedMonth]
  );

  const handleDownloadMonthlyExcel = async () => {
    setExportingMonthly(true);
    try {
      await exportMonthlyReportToExcel(db, selectedYear, selectedMonth);
    } finally {
      setExportingMonthly(false);
    }
  };

  const stockableItems = useMemo(
    () => db.inventory.filter((i) => i.trackDirectStock),
    [db.inventory]
  );

  const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const item of db.inventory.filter((i) => i.trackDirectStock)) {
      map[item.id] = String(item.currentStock);
    }
    return map;
  });

  const [applyAdjustment, setApplyAdjustment] = useState(true);
  const [submittingAudit, setSubmittingAudit] = useState(false);
  const [auditSavedBanner, setAuditSavedBanner] = useState(false);

  const getPhysicalValue = (itemId: string, fallback: number) => {
    if (physicalCounts[itemId] !== undefined) {
      return physicalCounts[itemId];
    }
    return String(fallback);
  };

  const financials = useMemo(() => {
    const totalSalesRevenue = Number(
      db.sales.reduce((acc, s) => acc + s.total, 0).toFixed(2)
    );
    const totalCostOfGoodsSold = Number(
      db.sales.reduce((acc, s) => acc + s.estimatedCost, 0).toFixed(2)
    );
    const totalPurchasesEntries = Number(
      db.movements
        .filter((m) => m.movementType === 'entrada_compra')
        .reduce((acc, m) => acc + m.totalCost, 0)
        .toFixed(2)
    );
    const totalWasteLosses = Number(
      db.movements
        .filter(
          (m) =>
            m.movementType === 'salida_merma' ||
            (m.movementType === 'ajuste_auditoria' && m.quantity < 0)
        )
        .reduce((acc, m) => acc + m.totalCost, 0)
        .toFixed(2)
    );
    const totalOperatingExpenses = Number(
      db.expenses.reduce((acc, e) => acc + e.amount, 0).toFixed(2)
    );

    const netOperatingProfit = Number(
      (
        totalSalesRevenue -
        totalCostOfGoodsSold -
        totalOperatingExpenses -
        totalWasteLosses
      ).toFixed(2)
    );

    const inventoryValuation = Number(
      db.inventory
        .filter((i) => i.trackDirectStock)
        .reduce((acc, i) => acc + i.currentStock * i.unitCost, 0)
        .toFixed(2)
    );

    return {
      totalSalesRevenue,
      totalCostOfGoodsSold,
      totalPurchasesEntries,
      totalWasteLosses,
      totalOperatingExpenses,
      netOperatingProfit,
      inventoryValuation,
    };
  }, [db]);

  const liveAuditPreview = useMemo(() => {
    return stockableItems.map((item) => {
      const rawVal =
        physicalCounts[item.id] !== undefined
          ? physicalCounts[item.id]
          : String(item.currentStock);
      const physical = rawVal === '' ? item.currentStock : Number(rawVal);
      const diff = Number((physical - item.currentStock).toFixed(2));
      const impact = Number((diff * item.unitCost).toFixed(2));
      return {
        item,
        physical,
        diff,
        impact,
      };
    });
  }, [stockableItems, physicalCounts]);

  const totalLiveDiscrepancy = useMemo(
    () =>
      Number(liveAuditPreview.reduce((acc, row) => acc + row.impact, 0).toFixed(2)),
    [liveAuditPreview]
  );

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAudit(true);
    setAuditSavedBanner(false);
    try {
      const counts = stockableItems.map((item) => ({
        itemId: item.id,
        physicalStock: Number(getPhysicalValue(item.id, item.currentStock)),
      }));

      const res = await fetch('/api/cafeteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_audit',
          payload: {
            notes: 'Conteo físico desde el sistema',
            applyAdjustment,
            counts,
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onRefresh(data.db);
        const updatedMap: Record<string, string> = {};
        for (const it of data.db.inventory.filter(
          (i: { trackDirectStock: boolean }) => i.trackDirectStock
        )) {
          updatedMap[it.id] = String(it.currentStock);
        }
        setPhysicalCounts(updatedMap);
        setAuditSavedBanner(true);
      }
    } finally {
      setSubmittingAudit(false);
    }
  };

  // Alturas proporcionales para gráficos en pantalla
  const salesChartBars = [
    { label: 'EFECTIVO', value: monthlyMetrics.salesEfectivo },
    { label: 'CRÉDITO', value: monthlyMetrics.salesCredito },
    { label: 'TARJETA', value: monthlyMetrics.salesTarjeta },
    { label: 'TRANSFERENCIA', value: monthlyMetrics.salesTransferencia },
  ];
  const maxSalesBar = Math.max(100, ...salesChartBars.map((b) => b.value));

  const profitChartBars = [
    { label: 'VENTA MENSUAL', value: monthlyMetrics.ventaMensual, color: '#1E56C5' },
    {
      label: 'COMPRAS / GASTOS',
      value: monthlyMetrics.totalSalidasMensuales,
      color: '#E0661F',
    },
    {
      label: 'GANANCIA DEL MES',
      value: Math.max(0, monthlyMetrics.gananciaMensual),
      raw: monthlyMetrics.gananciaMensual,
      color: '#7A8086',
    },
  ];
  const maxProfitBar = Math.max(100, ...profitChartBars.map((b) => b.value));

  return (
    <div className="space-y-4">
      {/* Header & Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[#26302D]">
            Reportes Contables, Ganancias y Conteo Físico
          </h2>
          <p className="text-xs text-[#6B7A74]">
            Genera el formato contable mensual en Excel con gráficos, revisa ganancias y audita stock.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-[#E4E9E5]">
          <button
            type="button"
            onClick={() => setSubTab('mensual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              subTab === 'mensual'
                ? 'bg-[#3D6B5E] text-white'
                : 'text-[#5C6B66] hover:text-[#26302D]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Reporte Mensual (Excel)
          </button>

          <button
            type="button"
            onClick={() => setSubTab('financiero')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              subTab === 'financiero'
                ? 'bg-[#3D6B5E] text-white'
                : 'text-[#5C6B66] hover:text-[#26302D]'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            Ganancias Globales
          </button>

          <button
            type="button"
            onClick={() => setSubTab('auditoria')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              subTab === 'auditoria'
                ? 'bg-[#3D6B5E] text-white'
                : 'text-[#5C6B66] hover:text-[#26302D]'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            Conteo Físico
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUBTAB 1: REPORTE MENSUAL + EXPORTACIÓN EXCEL CON GRÁFICOS            */}
      {/* ===================================================================== */}
      {subTab === 'mensual' && (
        <div className="space-y-4">
          {/* Selector de Mes y Año + Botón Excel */}
          <div className="bg-white p-4 rounded-2xl border border-[#E4E9E5] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#26302D]">
                <Calendar className="w-4 h-4 text-[#3D6B5E]" />
                <span>Periodo Contable:</span>
              </div>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#DCE2DD] text-xs font-semibold text-[#26302D]"
              >
                {MONTH_NAMES_ES.map((mName, idx) => (
                  <option key={mName} value={idx}>
                    {mName}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#DCE2DD] text-xs font-semibold text-[#26302D]"
              >
                {AVAILABLE_YEARS.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>

              <span className="text-xs text-[#6B7A74]">
                ({monthlyMetrics.salesInMonth.length} ventas en{' '}
                {MONTH_NAMES_ES[selectedMonth]} {selectedYear})
              </span>
            </div>

            <button
              type="button"
              onClick={handleDownloadMonthlyExcel}
              disabled={exportingMonthly}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3D6B5E] text-white text-xs sm:text-sm font-semibold hover:bg-[#2F574B] disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>
                {exportingMonthly
                  ? 'Generando Libro Excel...'
                  : `Descargar Excel ${MONTH_NAMES_ES[selectedMonth]} ${selectedYear} (.xlsx)`}
              </span>
            </button>
          </div>

          {/* SECCIÓN 1: DESGLOSE DE VENTA MENSUAL + GRÁFICO AZUL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E4E9E5] overflow-hidden">
              <div className="px-4 py-3 bg-[#EDF3FA] border-b border-[#D5E1F0]">
                <h3 className="font-bold text-xs sm:text-sm text-[#1E3A5F]">
                  DESGLOCE DE VENTA MENSUAL {monthlyMetrics.monthLabelUpper}
                </h3>
              </div>

              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F7F8F6] text-[#5C6B66] border-b border-[#E4E9E5]">
                    <th className="py-2.5 px-4 text-left font-semibold">DESCRIPCIÓN</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Suma de TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F5F3]">
                  <tr>
                    <td className="py-2.5 px-4 text-[#26302D]">TOTAL VENTAS EFECTIVO</td>
                    <td className="py-2.5 px-4 text-right font-medium">
                      {formatLempira(monthlyMetrics.salesEfectivo)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-[#26302D]">TOTAL VENTAS CREDITO</td>
                    <td className="py-2.5 px-4 text-right font-medium text-[#9A6728]">
                      {formatLempira(monthlyMetrics.salesCredito)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-[#26302D]">TOTAL VENTAS TARJETA</td>
                    <td className="py-2.5 px-4 text-right font-medium">
                      {formatLempira(monthlyMetrics.salesTarjeta)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-[#26302D]">TOTAL VENTAS TRANSFERENCIA</td>
                    <td className="py-2.5 px-4 text-right font-medium">
                      {formatLempira(monthlyMetrics.salesTransferencia)}
                    </td>
                  </tr>
                  <tr className="bg-[#EDF3FA] font-bold text-[#1E3A5F]">
                    <td className="py-3 px-4">Total general (Venta Mensual)</td>
                    <td className="py-3 px-4 text-right">
                      {formatLempira(monthlyMetrics.ventaMensual)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Gráfico 1: Barras Azules por Modalidad */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E4E9E5] p-4 flex flex-col justify-between">
              <div className="text-center mb-2">
                <h4 className="font-bold text-sm text-[#374151]">
                  Total de Ventas por Modalidad ({MONTH_NAMES_ES[selectedMonth]} {selectedYear})
                </h4>
              </div>

              <div className="h-52 pt-6 pb-2 px-2 sm:px-6 border-b border-[#E5E7EB] grid grid-cols-4 gap-3 items-end">
                {salesChartBars.map((bar) => {
                  const pct = Math.max(
                    bar.value > 0 ? 4 : 1,
                    Math.round((bar.value / maxSalesBar) * 100)
                  );
                  return (
                    <div
                      key={bar.label}
                      className="h-full flex flex-col items-center justify-end gap-1.5"
                    >
                      <span className="text-[10px] sm:text-xs font-bold text-[#1F2937] whitespace-nowrap">
                        {formatLempira(bar.value)}
                      </span>
                      <div className="w-8 sm:w-11 bg-[#1E56C5] rounded-t-sm transition-all" style={{ height: `${pct}%` }} />
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-4 gap-2 pt-2 text-center">
                {salesChartBars.map((bar) => (
                  <div key={bar.label} className="text-[10px] font-semibold text-[#4B5563] leading-tight">
                    TOTAL VENTAS
                    <br />
                    {bar.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECCIÓN 2 Y 3: GANANCIA MENSUAL + MOVIMIENTO DE EFECTIVO + GRÁFICO TRICOLOR */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 space-y-4">
              {/* Tabla Ganancia Mensual */}
              <div className="bg-white rounded-2xl border border-[#E4E9E5] overflow-hidden">
                <div className="px-4 py-2.5 bg-[#95B3D7]/35 border-b border-[#95B3D7]/60">
                  <h3 className="font-bold text-xs sm:text-sm text-[#1E3A5F]">
                    DESGLOCE DE GANANCIA MENSUAL {monthlyMetrics.monthLabelUpper}
                  </h3>
                </div>
                <table className="w-full text-xs border-collapse">
                  <tbody className="divide-y divide-[#F2F5F3]">
                    <tr>
                      <td className="py-2.5 px-4 text-[#26302D]">VENTA MENSUAL</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-[#1E56C5]">
                        {formatLempira(monthlyMetrics.ventaMensual)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-[#26302D]">
                        COMPRAS Y GASTOS MENSUALES
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-[#E0661F]">
                        {formatLempira(monthlyMetrics.totalSalidasMensuales)}
                      </td>
                    </tr>
                    <tr className="bg-[#95B3D7]/30 font-bold text-[#1E3A5F]">
                      <td className="py-3 px-4">GANANCIA DEL MES</td>
                      <td className="py-3 px-4 text-right">
                        {formatLempira(monthlyMetrics.gananciaMensual)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tabla Movimiento de Efectivo */}
              <div className="bg-white rounded-2xl border border-[#E4E9E5] overflow-hidden">
                <div className="px-4 py-2.5 bg-[#DCE6F1] border-b border-[#C5D6E8]">
                  <h3 className="font-bold text-xs sm:text-sm text-[#1E3A5F]">
                    DESGLOCE MOVIMIENTO DE EFECTIVO {monthlyMetrics.monthLabelUpper}
                  </h3>
                </div>
                <table className="w-full text-xs border-collapse">
                  <tbody className="divide-y divide-[#F2F5F3]">
                    <tr>
                      <td className="py-2.5 px-4 text-[#26302D]">
                        VENTA EFECTIVO (+ Abonos Efectivo)
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium">
                        {formatLempira(monthlyMetrics.ventaEfectivoCaja)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-[#26302D]">
                        COMPRAS Y GASTOS EN EFECTIVO
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-[#A84A3E]">
                        {formatLempira(monthlyMetrics.salidasEfectivoMes)}
                      </td>
                    </tr>
                    <tr className="bg-[#DCE6F1] font-bold text-[#1E3A5F]">
                      <td className="py-3 px-4">EFECTIVO ENTREGADO</td>
                      <td className="py-3 px-4 text-right">
                        {formatLempira(monthlyMetrics.efectivoEntregado)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Gráfico 2: Barras Agrupadas Azul / Naranja / Gris (como en Foto 2) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E4E9E5] p-4 flex flex-col justify-between">
              <div className="space-y-2 text-center">
                <h4 className="font-bold text-sm text-[#374151]">
                  Comparativo Venta vs. Compras/Gastos vs. Ganancia
                </h4>
                <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-[#4B5563]">
                  {profitChartBars.map((b) => (
                    <span key={b.label} className="inline-flex items-center gap-1.5 font-medium">
                      <span
                        className="w-2.5 h-2.5 inline-block rounded-[2px]"
                        style={{ backgroundColor: b.color }}
                      />
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="h-56 pt-8 pb-0 px-6 sm:px-16 border-b border-[#E5E7EB] flex items-end justify-center">
                <div className="w-full max-w-md h-full grid grid-cols-3 items-end">
                  {profitChartBars.map((b) => {
                    const pct = Math.max(
                      b.value > 0 ? 4 : 1,
                      Math.round((b.value / maxProfitBar) * 100)
                    );
                    const shownVal = 'raw' in b && b.raw !== undefined ? b.raw : b.value;
                    return (
                      <div
                        key={b.label}
                        className="h-full flex flex-col items-center justify-end gap-1.5"
                      >
                        <span className="text-[11px] sm:text-xs font-bold text-[#111827] whitespace-nowrap">
                          {formatLempira(shownVal)}
                        </span>
                        <div
                          className="w-full transition-all"
                          style={{ height: `${pct}%`, backgroundColor: b.color }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 text-center text-xs text-[#4B5563] font-medium">
                Suma de TOTAL ({MONTH_NAMES_ES[selectedMonth]} {selectedYear}) — El Excel incluye las
                pestañas DESCRIPCIÓN, ENTRADAS, SALIDAS y RESUMEN con ambos gráficos.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 2: GANANCIAS GLOBALES                                          */}
      {/* ===================================================================== */}
      {subTab === 'financiero' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-[#E4E9E5]">
              <span className="text-xs text-[#6B7A74]">1. Ingresos por Ventas</span>
              <p className="text-2xl font-bold text-[#26302D] mt-1">
                +{formatLempira(financials.totalSalesRevenue)}
              </p>
              <span className="text-[11px] text-[#6B7A74] mt-0.5 block">
                {db.sales.length} ventas registradas
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E4E9E5]">
              <span className="text-xs text-[#6B7A74]">2. Costos, Gastos y Mermas</span>
              <p className="text-2xl font-bold text-[#A84A3E] mt-1">
                -
                {formatLempira(
                  financials.totalCostOfGoodsSold +
                    financials.totalOperatingExpenses +
                    financials.totalWasteLosses
                )}
              </p>
              <span className="text-[11px] text-[#6B7A74] mt-0.5 block">
                Productos + gastos + bajas
              </span>
            </div>

            <div className="bg-[#EEF5F2] p-4 rounded-2xl border border-[#CFE0D8]">
              <span className="text-xs font-medium text-[#2F574B]">
                3. Utilidad Neta (Ganancia Real)
              </span>
              <p className="text-2xl font-bold text-[#2F574B] mt-1 flex items-center gap-1.5">
                <TrendingUp className="w-5 h-5" />
                {formatLempira(financials.netOperatingProfit)}
              </p>
              <span className="text-[11px] text-[#3D6B5E] mt-0.5 block">
                Ganancia libre del negocio
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E4E9E5] p-4 sm:p-5 max-w-3xl">
            <h3 className="font-semibold text-sm text-[#26302D] mb-3">
              Desglose Acumulado de Resultados
            </h3>

            <div className="space-y-2.5 text-xs sm:text-sm">
              <div className="flex justify-between py-2 border-b border-[#F2F5F3]">
                <span className="text-[#5C6B66]">(+) Ventas totales en caja</span>
                <span className="font-semibold text-[#2F574B]">
                  +{formatLempira(financials.totalSalesRevenue)}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-[#F2F5F3]">
                <span className="text-[#5C6B66]">
                  (-) Costo de productos e insumos vendidos
                </span>
                <span className="font-medium text-[#26302D]">
                  -{formatLempira(financials.totalCostOfGoodsSold)}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-[#F2F5F3]">
                <span className="text-[#5C6B66]">
                  (-) Gastos operativos (alquiler, servicios, limpieza)
                </span>
                <span className="font-medium text-[#A84A3E]">
                  -{formatLempira(financials.totalOperatingExpenses)}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-[#F2F5F3]">
                <span className="text-[#5C6B66]">
                  (-) Pérdidas por mermas, vencimientos o faltantes
                </span>
                <span className="font-medium text-[#A84A3E]">
                  -{formatLempira(financials.totalWasteLosses)}
                </span>
              </div>

              <div className="flex justify-between items-center p-3.5 rounded-xl bg-[#EEF5F2] font-bold text-sm sm:text-base text-[#2F574B]">
                <span>(=) Ganancia Neta Real</span>
                <span>{formatLempira(financials.netOperatingProfit)}</span>
              </div>

              <div className="pt-2 flex justify-between text-xs text-[#6B7A74]">
                <span>Valor actual del stock en vitrinas y bodega (al costo):</span>
                <strong className="text-[#26302D]">
                  {formatLempira(financials.inventoryValuation)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 3: CONTEO FÍSICO VS SISTEMA                                    */}
      {/* ===================================================================== */}
      {subTab === 'auditoria' && (
        <div className="bg-white rounded-2xl border border-[#E4E9E5] overflow-hidden">
          <div className="p-4 border-b border-[#E4E9E5] flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <h3 className="font-semibold text-sm text-[#26302D]">
                Comparador Físico vs. Sistema
              </h3>
              <p className="text-xs text-[#6B7A74]">
                Ingresa el conteo físico real para detectar faltantes.
              </p>
            </div>

            <div
              className={`px-3 py-1 rounded-xl text-xs font-semibold ${
                totalLiveDiscrepancy === 0
                  ? 'bg-[#EEF5F2] text-[#2F574B]'
                  : 'bg-[#FCEEED] text-[#A84A3E]'
              }`}
            >
              Diferencia:{' '}
              {totalLiveDiscrepancy > 0
                ? `+${formatLempira(totalLiveDiscrepancy)}`
                : formatLempira(totalLiveDiscrepancy)}
            </div>
          </div>

          <form onSubmit={handleSaveAudit} className="p-4 space-y-3.5">
            {auditSavedBanner && (
              <div className="p-2.5 rounded-xl bg-[#EEF5F2] text-[#2F574B] text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Conteo guardado y existencias actualizadas.
              </div>
            )}

            <div className="overflow-x-auto border border-[#E4E9E5] rounded-xl max-h-[52dvh] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead className="sticky top-0 bg-[#F7F8F6] z-10">
                  <tr className="text-[#6B7A74] text-xs border-b border-[#E4E9E5]">
                    <th className="py-2.5 px-3 sm:px-4 font-medium">Producto</th>
                    <th className="py-2.5 px-3 sm:px-4 font-medium text-right">Sistema</th>
                    <th className="py-2.5 px-3 sm:px-4 font-medium text-center w-32">En Físico</th>
                    <th className="py-2.5 px-3 sm:px-4 font-medium text-right">Dif.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F5F3]">
                  {liveAuditPreview.map(({ item, diff }) => (
                    <tr key={item.id} className="hover:bg-[#F7F8F6]/60">
                      <td className="py-2 px-3 sm:px-4 font-medium text-[#26302D]">
                        {item.name}
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-right text-[#6B7A74] whitespace-nowrap">
                        {item.currentStock} {item.unit}
                      </td>
                      <td className="py-2 px-3 sm:px-4 text-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={getPhysicalValue(item.id, item.currentStock)}
                          onChange={(e) =>
                            setPhysicalCounts({
                              ...physicalCounts,
                              [item.id]: e.target.value,
                            })
                          }
                          className="w-20 sm:w-24 px-2 py-1 rounded-lg bg-[#F7F8F6] border border-[#DCE2DD] text-right font-semibold text-[#26302D]"
                        />
                      </td>
                      <td
                        className={`py-2 px-3 sm:px-4 text-right font-semibold whitespace-nowrap ${
                          diff === 0
                            ? 'text-[#2F574B]'
                            : diff < 0
                            ? 'text-[#A84A3E]'
                            : 'text-[#9A6728]'
                        }`}
                      >
                        {diff === 0 ? (
                          'OK'
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            {diff < 0 && <AlertTriangle className="w-3 h-3" />}
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-[#5C6B66]">
                <input
                  type="checkbox"
                  checked={applyAdjustment}
                  onChange={(e) => setApplyAdjustment(e.target.checked)}
                  className="rounded accent-[#3D6B5E] w-4 h-4"
                />
                <span>Ajustar stock del sistema a las cantidades físicas</span>
              </label>

              <button
                type="submit"
                disabled={submittingAudit}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#3D6B5E] text-white font-semibold hover:bg-[#2F574B] transition-colors cursor-pointer"
              >
                {submittingAudit ? 'Guardando...' : 'Guardar Conteo'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
