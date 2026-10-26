'use client';

import React, { useState, useMemo } from 'react';
import {
  Scale,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Coins,
} from 'lucide-react';
import { CafeteriaDatabase } from '@/lib/types';
import { formatLempira } from '@/lib/currency';

interface AuditAndReportsModuleProps {
  db: CafeteriaDatabase;
  onRefresh: (newDb: CafeteriaDatabase) => void;
}

export default function AuditAndReportsModule({
  db,
  onRefresh,
}: AuditAndReportsModuleProps) {
  const [subTab, setSubTab] = useState<'financiero' | 'auditoria'>('financiero');

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
      const rawVal = getPhysicalValue(item.id, item.currentStock);
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

  return (
    <div className="space-y-4">
      {/* Header & Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[#26302D]">
            Ganancias y Control de Pérdidas
          </h2>
          <p className="text-xs text-[#6B7A74]">
            Revisa tu utilidad neta y compara el inventario físico contra el sistema.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E4E9E5]">
          <button
            onClick={() => setSubTab('financiero')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              subTab === 'financiero'
                ? 'bg-[#3D6B5E] text-white'
                : 'text-[#5C6B66] hover:text-[#26302D]'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            Ganancias
          </button>
          <button
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

      {subTab === 'financiero' ? (
        <div className="space-y-4">
          {/* 3 Compact & Clear Summary Cards */}
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

          {/* Clean Visual Breakdown */}
          <div className="bg-white rounded-2xl border border-[#E4E9E5] p-4 sm:p-5 max-w-3xl">
            <h3 className="font-semibold text-sm text-[#26302D] mb-3">
              Desglose de Resultados
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
      ) : (
        /* Physical Count vs System Stock with Sticky Action Bar */
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

            {/* Always visible Save Bar right under the scrollable table */}
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
