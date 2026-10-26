'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  HeartPulse,
  LayoutGrid,
  ShoppingBag,
  Package,
  Wallet,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  RotateCcw,
  Receipt,
  CheckCircle2,
  Users,
  LogOut,
  ShieldCheck,
  UserCheck,
  Wifi,
} from 'lucide-react';
import { CafeteriaDatabase, SaleTransaction, SessionUser } from '@/lib/types';
import { formatLempira } from '@/lib/currency';
import PosModule from '@/components/PosModule';
import InventoryModule from '@/components/InventoryModule';
import ExpensesModule from '@/components/ExpensesModule';
import AuditAndReportsModule from '@/components/AuditAndReportsModule';
import UsersAndLanModule from '@/components/UsersAndLanModule';
import ReceiptModal from '@/components/ReceiptModal';
import LoginScreen from '@/components/LoginScreen';

type ActiveSection =
  | 'pos'
  | 'inventario'
  | 'gastos'
  | 'reportes'
  | 'resumen'
  | 'usuarios';

export default function CafeteriaHomePage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [db, setDb] = useState<CafeteriaDatabase | null>(null);
  const [loadingDb, setLoadingDb] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>('pos');
  const [selectedReceipt, setSelectedReceipt] = useState<SaleTransaction | null>(null);

  const fetchDatabase = useCallback(async () => {
    setLoadingDb(true);
    try {
      const res = await fetch('/api/cafeteria', { cache: 'no-store' });
      if (res.status === 401) {
        setCurrentUser(null);
        setDb(null);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setDb(data);
      }
    } finally {
      setLoadingDb(false);
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth', { cache: 'no-store' });
        const data = await res.json();
        if (data.lanUrls) {
          setLanUrls(data.lanUrls);
        }
        if (data.user) {
          setCurrentUser(data.user);
          await fetchDatabase();
        }
      } finally {
        setAuthChecked(true);
      }
    };
    checkSession();
  }, [fetchDatabase]);

  const handleLoginSuccess = async (user: SessionUser, urls: string[]) => {
    setCurrentUser(user);
    if (urls && urls.length > 0) {
      setLanUrls(urls);
    }
    setActiveSection('pos');
    await fetchDatabase();
  };

  const handleLogout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    setCurrentUser(null);
    setDb(null);
    setSelectedReceipt(null);
    setActiveSection('pos');
  };

  const isAdmin = currentUser?.role === 'administrador';

  // Enforce strict role-based section access:
  // Operador ONLY has access to Ventas ('pos') and Inventarios ('inventario')
  const safeSection: ActiveSection = useMemo(() => {
    if (!isAdmin) {
      return activeSection === 'inventario' ? 'inventario' : 'pos';
    }
    return activeSection;
  }, [isAdmin, activeSection]);

  const summary = useMemo(() => {
    if (!db) {
      return {
        totalSales: 0,
        totalCogs: 0,
        totalExpenses: 0,
        totalWaste: 0,
        netProfit: 0,
        lowStockItems: [],
      };
    }

    const totalSales = Number(db.sales.reduce((acc, s) => acc + s.total, 0).toFixed(2));
    const totalCogs = Number(db.sales.reduce((acc, s) => acc + s.estimatedCost, 0).toFixed(2));
    const totalExpenses = Number(db.expenses.reduce((acc, e) => acc + e.amount, 0).toFixed(2));
    const totalWaste = Number(
      db.movements
        .filter(
          (m) =>
            m.movementType === 'salida_merma' ||
            (m.movementType === 'ajuste_auditoria' && m.quantity < 0)
        )
        .reduce((acc, m) => acc + m.totalCost, 0)
        .toFixed(2)
    );

    const netProfit = Number(
      (totalSales - totalCogs - totalExpenses - totalWaste).toFixed(2)
    );

    const lowStockItems = db.inventory.filter(
      (i) => i.trackDirectStock && i.currentStock <= i.minStock
    );

    return {
      totalSales,
      totalCogs,
      totalExpenses,
      totalWaste,
      netProfit,
      lowStockItems,
    };
  }, [db]);

  const navItems = useMemo(() => {
    const baseItems: Array<{
      id: ActiveSection;
      label: string;
      shortLabel: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: number;
    }> = [
      {
        id: 'pos',
        label: 'Ventas',
        shortLabel: 'Ventas',
        icon: ShoppingBag,
      },
      {
        id: 'inventario',
        label: 'Inventario',
        shortLabel: 'Invent.',
        icon: Package,
        badge: summary.lowStockItems.length > 0 ? summary.lowStockItems.length : undefined,
      },
    ];

    if (isAdmin) {
      baseItems.push(
        {
          id: 'gastos',
          label: 'Gastos',
          shortLabel: 'Gastos',
          icon: Wallet,
        },
        {
          id: 'reportes',
          label: 'Ganancias',
          shortLabel: 'Ganancia',
          icon: BarChart3,
        },
        {
          id: 'resumen',
          label: 'Resumen',
          shortLabel: 'Resumen',
          icon: LayoutGrid,
        },
        {
          id: 'usuarios',
          label: 'Usuarios / LAN',
          shortLabel: 'Red/Usu.',
          icon: Users,
        }
      );
    }

    return baseItems;
  }, [isAdmin, summary.lowStockItems.length]);

  const handleResetDemo = async () => {
    if (!isAdmin) return;
    if (!confirm('¿Deseas restaurar los datos iniciales de ejemplo?')) return;
    const res = await fetch('/api/cafeteria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_demo' }),
    });
    const data = await res.json();
    if (res.ok) setDb(data.db);
  };

  if (!authChecked) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#F7F8F6]">
        <div className="text-center space-y-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#E8F0ED] text-[#3D6B5E] flex items-center justify-center mx-auto animate-pulse">
            <HeartPulse className="w-5 h-5" />
          </div>
          <p className="text-xs text-[#5C6B66]">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (loadingDb || !db) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#F7F8F6]">
        <div className="text-center space-y-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#E8F0ED] text-[#3D6B5E] flex items-center justify-center mx-auto animate-pulse">
            <HeartPulse className="w-5 h-5" />
          </div>
          <p className="text-xs text-[#5C6B66]">Cargando módulos del sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#F7F8F6] text-[#26302D]">
      {/* Compact Sticky Top Header (fits laptops, tablets & mobile) */}
      <header className="bg-white/95 backdrop-blur-xs border-b border-[#E4E9E5] sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5 h-13 sm:h-14 flex items-center justify-between gap-2">
          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-[#3D6B5E] text-white flex items-center justify-center shrink-0">
              <HeartPulse className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-sm sm:text-[15px] text-[#26302D] leading-tight truncate">
                VitaliMarket & Café
              </h1>
              <p className="text-[10px] text-[#6B7A74] hidden xl:block leading-tight">
                Tienda y Cafetería Hospitalaria
              </p>
            </div>
          </div>

          {/* Desktop & Tablet Navigation Pills (md and up) */}
          <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 bg-[#F2F5F3] p-1 rounded-xl overflow-x-auto no-scrollbar max-w-full">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = safeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-white text-[#26302D] shadow-2xs font-semibold'
                      : 'text-[#5C6B66] hover:text-[#26302D]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-[#3D6B5E]' : ''}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#FDF5E8] text-[#9A6728]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right User Badge, LAN info & Logout */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isAdmin && lanUrls.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveSection('usuarios')}
                title={`Acceso LAN activo: ${lanUrls[0]}`}
                className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EEF5F2] text-[#2F574B] text-[11px] font-medium hover:bg-[#E1EDE8] transition-colors cursor-pointer"
              >
                <Wifi className="w-3.5 h-3.5" />
                <span className="truncate max-w-[145px]">
                  {lanUrls[0].replace('http://', '')}
                </span>
              </button>
            )}

            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${
                isAdmin
                  ? 'bg-[#EEF5F2] border-[#CFE0D8] text-[#2F574B]'
                  : 'bg-[#F7F8F6] border-[#E4E9E5] text-[#26302D]'
              }`}
            >
              {isAdmin ? (
                <ShieldCheck className="w-3.5 h-3.5 text-[#3D6B5E] shrink-0" />
              ) : (
                <UserCheck className="w-3.5 h-3.5 text-[#5C6B66] shrink-0" />
              )}
              <div className="leading-tight">
                <span className="font-semibold hidden sm:inline">{currentUser.fullName}</span>
                <span className="font-semibold sm:hidden capitalize">{currentUser.role}</span>
                <span className="hidden xl:inline text-[10px] opacity-80 ml-1.5 capitalize">
                  ({currentUser.role})
                </span>
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={handleResetDemo}
                title="Restaurar datos iniciales de ejemplo"
                className="p-1.5 rounded-lg text-[#6B7A74] hover:text-[#26302D] hover:bg-[#F2F5F3] transition-colors cursor-pointer hidden sm:flex"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F2F5F3] hover:bg-[#FCEEED] text-[#5C6B66] hover:text-[#A84A3E] text-xs font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container (compact vertical spacing & safe bottom margin for mobile nav) */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-5 py-3.5 sm:py-5 pb-20 md:pb-6">
        {isAdmin && safeSection === 'resumen' && (
          <div className="space-y-5">
            {/* Compact Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#26302D]">Resumen del Negocio</h2>
                <p className="text-xs text-[#6B7A74]">
                  Vista rápida de ventas, costos, utilidad neta y productos por reponer.
                </p>
              </div>
              <button
                onClick={() => setActiveSection('pos')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#3D6B5E] text-white text-xs sm:text-sm font-medium hover:bg-[#2F574B] transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                Ir a Caja para Vender
              </button>
            </div>

            {/* 3 Compact KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E4E9E5]">
                <div className="flex items-center justify-between text-[#6B7A74] text-xs mb-2">
                  <span>Ventas Totales</span>
                  <Receipt className="w-4 h-4 text-[#3D6B5E]" />
                </div>
                <p className="text-2xl font-bold text-[#26302D]">
                  {formatLempira(summary.totalSales)}
                </p>
                <p className="text-[11px] text-[#6B7A74] mt-1">
                  {db.sales.length} ventas registradas
                </p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E4E9E5]">
                <div className="flex items-center justify-between text-[#6B7A74] text-xs mb-2">
                  <span>Costos, Gastos y Bajas</span>
                  <Wallet className="w-4 h-4 text-[#A84A3E]" />
                </div>
                <p className="text-2xl font-bold text-[#26302D]">
                  {formatLempira(summary.totalCogs + summary.totalExpenses + summary.totalWaste)}
                </p>
                <p className="text-[11px] text-[#6B7A74] mt-1">
                  Insumos: {formatLempira(summary.totalCogs)} • Gastos/Mermas:{' '}
                  {formatLempira(summary.totalExpenses + summary.totalWaste)}
                </p>
              </div>

              <div className="bg-[#EEF5F2] p-4 sm:p-5 rounded-2xl border border-[#CFE0D8]">
                <div className="flex items-center justify-between text-[#2F574B] text-xs font-medium mb-2">
                  <span>Ganancia Neta Real</span>
                  <TrendingUp className="w-4 h-4 text-[#2F574B]" />
                </div>
                <p className="text-2xl font-bold text-[#2F574B]">
                  {formatLempira(summary.netProfit)}
                </p>
                <p className="text-[11px] text-[#3D6B5E] mt-1">
                  Dinero libre después de todos los costos
                </p>
              </div>
            </div>

            {/* 2 Columns: Stock Bajo & Últimas Ventas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Alertas de Stock Bajo */}
              <div className="bg-white rounded-2xl border border-[#E4E9E5] p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-[#26302D] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#9A6728]" />
                    Productos por Reponer ({summary.lowStockItems.length})
                  </h3>
                  <button
                    onClick={() => setActiveSection('inventario')}
                    className="text-xs text-[#3D6B5E] font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Ver inventario <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {summary.lowStockItems.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-[#EEF5F2] text-[#2F574B] text-xs sm:text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Todo el inventario tiene existencias suficientes.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {summary.lowStockItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EDE6D8] flex items-center justify-between gap-2 text-xs sm:text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-[#26302D] truncate">{item.name}</p>
                          <p className="text-[11px] text-[#9A6728] mt-0.5">
                            Quedan{' '}
                            <strong>
                              {item.currentStock} {item.unit}
                            </strong>{' '}
                            (Mín: {item.minStock})
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveSection('inventario')}
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-[#DCE2DD] text-xs font-medium text-[#26302D] hover:bg-[#F2F5F3] shrink-0 cursor-pointer"
                        >
                          Reponer
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Últimas Ventas */}
              <div className="bg-white rounded-2xl border border-[#E4E9E5] p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-[#26302D]">Ventas Recientes</h3>
                  <button
                    onClick={() => setActiveSection('pos')}
                    className="text-xs text-[#3D6B5E] font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Ver historial <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="divide-y divide-[#F2F5F3]">
                  {db.sales.slice(0, 5).map((sale) => (
                    <div
                      key={sale.id}
                      className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs sm:text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[#26302D] truncate">
                          {sale.customerName}
                        </p>
                        <p className="text-[11px] text-[#6B7A74] truncate">
                          {sale.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="font-semibold text-[#26302D]">
                          {formatLempira(sale.total)}
                        </span>
                        <button
                          onClick={() => setSelectedReceipt(sale)}
                          className="px-2.5 py-1 rounded-lg bg-[#F2F5F3] hover:bg-[#E4E9E5] text-xs text-[#26302D] cursor-pointer"
                        >
                          Ticket
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {safeSection === 'pos' && (
          <PosModule
            db={db}
            onRefresh={setDb}
            onShowReceipt={(sale) => setSelectedReceipt(sale)}
          />
        )}

        {safeSection === 'inventario' && (
          <InventoryModule db={db} onRefresh={setDb} />
        )}

        {isAdmin && safeSection === 'gastos' && (
          <ExpensesModule db={db} onRefresh={setDb} />
        )}

        {isAdmin && safeSection === 'reportes' && (
          <AuditAndReportsModule db={db} onRefresh={setDb} />
        )}

        {isAdmin && safeSection === 'usuarios' && (
          <UsersAndLanModule
            db={db}
            currentUser={currentUser}
            lanUrls={lanUrls}
            onRefresh={setDb}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (< md) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-xs border-t border-[#E4E9E5] px-1.5 py-1">
        <div
          className={`grid gap-1 ${
            navItems.length === 2 ? 'grid-cols-2' : 'grid-cols-6'
          }`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = safeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#EEF5F2] text-[#2F574B] font-semibold'
                    : 'text-[#5C6B66] hover:text-[#26302D]'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-[#3D6B5E]' : ''}`} />
                <span className="text-[10px] leading-tight mt-0.5 truncate max-w-full">
                  {item.shortLabel}
                </span>
                {item.badge !== undefined && (
                  <span className="absolute top-1 right-2 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold bg-[#FDF5E8] text-[#9A6728] border border-[#EDE6D8] flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Receipt Print/Preview Modal */}
      <ReceiptModal sale={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
    </div>
  );
}
