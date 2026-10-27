'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  FileSpreadsheet,
  Banknote,
  CreditCard,
  Smartphone,
  History,
  CheckCircle2,
  AlertCircle,
  X,
  Edit3,
  Trash2,
  PlusCircle,
  Wallet,
  Building2,
  Phone,
} from 'lucide-react';
import {
  CafeteriaDatabase,
  EmployeeCreditAccount,
  SessionUser,
} from '@/lib/types';
import { formatLempira } from '@/lib/currency';
import { exportCreditsToExcel } from '@/lib/excelExport';

interface CreditsModuleProps {
  db: CafeteriaDatabase;
  currentUser: SessionUser;
  onRefresh: (newDb: CafeteriaDatabase) => void;
}

const HOSPITAL_DEPARTMENTS = [
  'Enfermería',
  'Médicos / Residentes',
  'Emergencias',
  'Laboratorio',
  'Farmacia',
  'Administración',
  'Quirófano / UCI',
  'Seguridad y Mantenimiento',
];

export default function CreditsModule({
  db,
  currentUser,
  onRefresh,
}: CreditsModuleProps) {
  const isAdmin = currentUser.role === 'administrador';
  const credits = useMemo(() => db.credits || [], [db.credits]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendientes' | 'aldia'>('todos');
  const [exporting, setExporting] = useState(false);

  // Modal: Nuevo / Editar Empleado
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EmployeeCreditAccount | null>(null);
  const [empName, setEmpName] = useState('');
  const [empDept, setEmpDept] = useState('Enfermería');
  const [empPhone, setEmpPhone] = useState('');
  const [empLimit, setEmpLimit] = useState('');
  const [initAmount, setInitAmount] = useState('');
  const [initDesc, setInitDesc] = useState('');

  // Modal: Abonar / Cancelar Deuda
  const [paymentAccount, setPaymentAccount] = useState<EmployeeCreditAccount | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'Efectivo' | 'Transferencia' | 'Tarjeta'>('Efectivo');
  const [payNotes, setPayNotes] = useState('');

  // Modal: Cargo Manual
  const [chargeAccount, setChargeAccount] = useState<EmployeeCreditAccount | null>(null);
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeDesc, setChargeDesc] = useState('');

  // Modal: Historial de Cuenta
  const [historyAccountId, setHistoryAccountId] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<'todos' | 'cargos' | 'abonos'>('todos');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const historyAccount = useMemo(
    () => credits.find((c) => c.id === historyAccountId) || null,
    [credits, historyAccountId]
  );

  const kpis = useMemo(() => {
    const totalPending = Number(
      credits.reduce((acc, c) => acc + c.balance, 0).toFixed(2)
    );
    const totalPaid = Number(
      credits.reduce((acc, c) => acc + c.totalPaid, 0).toFixed(2)
    );
    const totalCharged = Number(
      credits.reduce((acc, c) => acc + c.totalCharged, 0).toFixed(2)
    );
    const activeDebtors = credits.filter((c) => c.balance > 0).length;
    return { totalPending, totalPaid, totalCharged, activeDebtors };
  }, [credits]);

  const filteredCredits = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return credits.filter((acc) => {
      if (statusFilter === 'pendientes' && acc.balance <= 0) return false;
      if (statusFilter === 'aldia' && acc.balance > 0) return false;
      if (!q) return true;
      return (
        acc.employeeName.toLowerCase().includes(q) ||
        acc.department.toLowerCase().includes(q) ||
        (acc.employeeCodeOrPhone || '').toLowerCase().includes(q)
      );
    });
  }, [credits, searchQuery, statusFilter]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await exportCreditsToExcel(filteredCredits);
    } finally {
      setExporting(false);
    }
  };

  const openNewEmployeeModal = () => {
    setEditingAccount(null);
    setEmpName('');
    setEmpDept('Enfermería');
    setEmpPhone('');
    setEmpLimit('');
    setInitAmount('');
    setInitDesc('');
    setErrorMsg(null);
    setAccountModalOpen(true);
  };

  const openEditEmployeeModal = (acc: EmployeeCreditAccount) => {
    setEditingAccount(acc);
    setEmpName(acc.employeeName);
    setEmpDept(acc.department);
    setEmpPhone(acc.employeeCodeOrPhone || '');
    setEmpLimit(acc.creditLimit && acc.creditLimit > 0 ? String(acc.creditLimit) : '');
    setInitAmount('');
    setInitDesc('');
    setErrorMsg(null);
    setAccountModalOpen(true);
  };

  const openPaymentModal = (acc: EmployeeCreditAccount) => {
    setPaymentAccount(acc);
    setPayAmount(acc.balance.toFixed(2));
    setPayMethod('Efectivo');
    setPayNotes('');
    setErrorMsg(null);
  };

  const openChargeModal = (acc: EmployeeCreditAccount) => {
    setChargeAccount(acc);
    setChargeAmount('');
    setChargeDesc('');
    setErrorMsg(null);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/cafeteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_credit_account',
          payload: {
            id: editingAccount?.id,
            employeeName: empName,
            department: empDept,
            employeeCodeOrPhone: empPhone,
            creditLimit: Number(empLimit) || 0,
            initialChargeAmount: editingAccount ? 0 : Number(initAmount) || 0,
            initialChargeDescription: initDesc,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'No se pudo guardar el empleado.');
      } else {
        onRefresh(data.db);
        setAccountModalOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAccount) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/cafeteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_credit_payment',
          payload: {
            accountId: paymentAccount.id,
            amount: Number(payAmount),
            paymentMethod: payMethod,
            notes: payNotes,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'No se pudo registrar el abono.');
      } else {
        onRefresh(data.db);
        setPaymentAccount(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddManualCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chargeAccount) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/cafeteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_credit_charge',
          payload: {
            accountId: chargeAccount.id,
            amount: Number(chargeAmount),
            description: chargeDesc,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'No se pudo registrar el cargo.');
      } else {
        onRefresh(data.db);
        setChargeAccount(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async (acc: EmployeeCreditAccount) => {
    if (!isAdmin) return;
    const msg =
      acc.balance > 0
        ? `¿Seguro que deseas eliminar la cuenta de "${acc.employeeName}"? Tiene un saldo pendiente de ${formatLempira(acc.balance)}.`
        : `¿Deseas eliminar a "${acc.employeeName}" del registro de créditos?`;
    if (!confirm(msg)) return;

    const res = await fetch('/api/cafeteria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_credit_account',
        payload: { id: acc.id },
      }),
    });
    const data = await res.json();
    if (res.ok) {
      onRefresh(data.db);
      if (historyAccountId === acc.id) setHistoryAccountId(null);
    }
  };

  const remainingAfterPay = useMemo(() => {
    if (!paymentAccount) return 0;
    const val = Number(payAmount) || 0;
    return Number(Math.max(0, paymentAccount.balance - val).toFixed(2));
  }, [paymentAccount, payAmount]);

  return (
    <div className="space-y-4">
      {/* Header & Main Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[#26302D]">
            Créditos de Empleados del Hospital
          </h2>
          <p className="text-xs text-[#6B7A74]">
            Controla cuentas por cobrar, registra abonos o cancelaciones y exporta la tabla a Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting || filteredCredits.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#CFE0D8] text-[#2F574B] text-xs font-semibold hover:bg-[#EEF5F2] disabled:opacity-50 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#3D6B5E]" />
            <span>{exporting ? 'Generando Excel...' : 'Exportar Tabla (.xlsx)'}</span>
          </button>

          <button
            type="button"
            onClick={openNewEmployeeModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#3D6B5E] text-white text-xs font-semibold hover:bg-[#2F574B] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Empleado</span>
          </button>
        </div>
      </div>

      {/* 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#EDE6D8]">
          <div className="flex items-center justify-between text-xs text-[#9A6728] font-medium">
            <span>Total Pendiente por Cobrar</span>
            <Wallet className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-[#26302D] mt-1">
            {formatLempira(kpis.totalPending)}
          </p>
          <span className="text-[11px] text-[#6B7A74] mt-0.5 block">
            {kpis.activeDebtors} empleado{kpis.activeDebtors === 1 ? '' : 's'} con saldo pendiente
          </span>
        </div>

        <div className="bg-[#EEF5F2] p-4 rounded-2xl border border-[#CFE0D8]">
          <div className="flex items-center justify-between text-xs text-[#2F574B] font-medium">
            <span>Total Abonado / Recuperado</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-2xl font-bold text-[#2F574B] mt-1">
            {formatLempira(kpis.totalPaid)}
          </p>
          <span className="text-[11px] text-[#3D6B5E] mt-0.5 block">
            Pagos recibidos de empleados
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E4E9E5]">
          <div className="flex items-center justify-between text-xs text-[#6B7A74]">
            <span>Empleados Registrados</span>
            <Users className="w-4 h-4 text-[#3D6B5E]" />
          </div>
          <p className="text-2xl font-bold text-[#26302D] mt-1">{credits.length}</p>
          <span className="text-[11px] text-[#6B7A74] mt-0.5 block">
            Consumo histórico: {formatLempira(kpis.totalCharged)}
          </span>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="bg-white rounded-2xl border border-[#E4E9E5] overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-[#E4E9E5] flex flex-wrap items-center justify-between gap-2.5">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#6B7A74] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar empleado, área o teléfono..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5] text-xs focus:outline-none focus:border-[#3D6B5E]"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#F2F5F3] p-1 rounded-xl text-xs">
            {[
              { id: 'todos', label: `Todos (${credits.length})` },
              { id: 'pendientes', label: `Con Saldo (${kpis.activeDebtors})` },
              { id: 'aldia', label: `Al Día (${credits.length - kpis.activeDebtors})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as 'todos' | 'pendientes' | 'aldia')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-[#26302D] shadow-2xs font-semibold'
                    : 'text-[#5C6B66] hover:text-[#26302D]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredCredits.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6B7A74]">
            No se encontraron empleados con ese criterio.
          </div>
        ) : (
          <>
            {/* Mobile Cards (< md) */}
            <div className="md:hidden divide-y divide-[#F2F5F3]">
              {filteredCredits.map((acc) => {
                const hasDebt = acc.balance > 0;
                return (
                  <div key={acc.id} className="p-3.5 space-y-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm text-[#26302D]">{acc.employeeName}</p>
                        <p className="text-[11px] text-[#6B7A74]">
                          {acc.department}
                          {acc.employeeCodeOrPhone ? ` • ${acc.employeeCodeOrPhone}` : ''}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                          hasDebt
                            ? 'bg-[#FDF5E8] text-[#9A6728]'
                            : 'bg-[#EEF5F2] text-[#2F574B]'
                        }`}
                      >
                        {hasDebt ? 'Con Saldo' : 'Al Día'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#F7F8F6] text-[11px]">
                      <div>
                        <span className="text-[#6B7A74] block">Consumido</span>
                        <strong className="text-[#26302D]">
                          {formatLempira(acc.totalCharged)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#6B7A74] block">Abonado</span>
                        <strong className="text-[#2F574B]">{formatLempira(acc.totalPaid)}</strong>
                      </div>
                      <div>
                        <span className="text-[#6B7A74] block">Saldo</span>
                        <strong className={hasDebt ? 'text-[#9A6728]' : 'text-[#2F574B]'}>
                          {formatLempira(acc.balance)}
                        </strong>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!hasDebt}
                        onClick={() => openPaymentModal(acc)}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#3D6B5E] text-white font-semibold disabled:opacity-35 cursor-pointer"
                      >
                        Abonar / Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => openChargeModal(acc)}
                        className="py-1.5 px-2.5 rounded-lg bg-[#F2F5F3] text-[#26302D] font-medium cursor-pointer"
                      >
                        + Cargo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryAccountId(acc.id);
                          setHistoryTab('todos');
                        }}
                        className="py-1.5 px-2.5 rounded-lg bg-[#F2F5F3] text-[#26302D] font-medium cursor-pointer"
                      >
                        Historial
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop & Tablet Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#F7F8F6] text-[#6B7A74] text-xs border-b border-[#E4E9E5]">
                    <th className="py-3 px-4 font-medium">Empleado Hospitalario</th>
                    <th className="py-3 px-4 font-medium">Área / Servicio</th>
                    <th className="py-3 px-4 font-medium text-right">Consumido</th>
                    <th className="py-3 px-4 font-medium text-right">Abonado</th>
                    <th className="py-3 px-4 font-medium text-right">Saldo Pendiente</th>
                    <th className="py-3 px-4 font-medium text-center">Estado</th>
                    <th className="py-3 px-4 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F5F3]">
                  {filteredCredits.map((acc) => {
                    const hasDebt = acc.balance > 0;
                    return (
                      <tr key={acc.id} className="hover:bg-[#F7F8F6]/60">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#26302D]">{acc.employeeName}</div>
                          {acc.employeeCodeOrPhone && (
                            <div className="text-[11px] text-[#6B7A74]">
                              {acc.employeeCodeOrPhone}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#5C6B66]">{acc.department}</td>
                        <td className="py-3 px-4 text-right text-xs text-[#5C6B66] whitespace-nowrap">
                          {formatLempira(acc.totalCharged)}
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-[#2F574B] font-medium whitespace-nowrap">
                          {formatLempira(acc.totalPaid)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span
                            className={`font-bold ${
                              hasDebt ? 'text-[#9A6728]' : 'text-[#2F574B]'
                            }`}
                          >
                            {formatLempira(acc.balance)}
                          </span>
                          {acc.creditLimit && acc.creditLimit > 0 ? (
                            <div className="text-[10px] text-[#6B7A74]">
                              Tope: {formatLempira(acc.creditLimit)}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              hasDebt
                                ? 'bg-[#FDF5E8] text-[#9A6728]'
                                : 'bg-[#EEF5F2] text-[#2F574B]'
                            }`}
                          >
                            {hasDebt ? 'Pendiente' : 'Cancelado / Al Día'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={!hasDebt}
                              onClick={() => openPaymentModal(acc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#3D6B5E] text-white text-xs font-semibold hover:bg-[#2F574B] disabled:opacity-35 transition-colors cursor-pointer"
                              title="Registrar abono parcial o liquidar saldo completo"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              <span>Abonar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openChargeModal(acc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F2F5F3] hover:bg-[#E4E9E5] text-[#26302D] text-xs font-medium cursor-pointer"
                              title="Agregar consumo manual al crédito"
                            >
                              <PlusCircle className="w-3.5 h-3.5 text-[#3D6B5E]" />
                              <span>Cargo</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setHistoryAccountId(acc.id);
                                setHistoryTab('todos');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F2F5F3] hover:bg-[#E4E9E5] text-[#26302D] text-xs font-medium cursor-pointer"
                              title="Ver historial de consumos y abonos"
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>Detalle</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditEmployeeModal(acc)}
                              className="p-1.5 rounded-lg text-[#5C6B66] hover:bg-[#F2F5F3] cursor-pointer"
                              title="Editar datos del empleado"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAccount(acc)}
                                className="p-1.5 rounded-lg text-[#A84A3E] hover:bg-[#FCEEED] cursor-pointer"
                                title="Eliminar cuenta de crédito"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: ABONAR / CANCELAR SALDO                                      */}
      {/* ===================================================================== */}
      {paymentAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26302D]/45 backdrop-blur-[2px] p-3 sm:p-4">
          <div className="bg-white border border-[#E4E9E5] rounded-2xl shadow-xl max-w-md w-full max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#E4E9E5] flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-sm text-[#26302D]">
                  Registrar Abono o Cancelación
                </h3>
                <p className="text-[11px] text-[#6B7A74]">
                  {paymentAccount.employeeName} ({paymentAccount.department})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentAccount(null)}
                className="p-1 rounded-lg text-[#6B7A74] hover:text-[#26302D] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterPayment} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-[#FCEEED] text-[#A84A3E] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EDE6D8] flex items-center justify-between">
                  <span className="text-[#5C6B66] font-medium">Saldo actual pendiente:</span>
                  <span className="text-lg font-bold text-[#9A6728]">
                    {formatLempira(paymentAccount.balance)}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-[#26302D]">Monto a abonar (L) *</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setPayAmount((paymentAccount.balance / 2).toFixed(2))
                        }
                        className="px-2 py-0.5 rounded-md bg-[#F2F5F3] text-[#5C6B66] hover:text-[#26302D] text-[11px] font-medium cursor-pointer"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayAmount(paymentAccount.balance.toFixed(2))}
                        className="px-2 py-0.5 rounded-md bg-[#EEF5F2] text-[#2F574B] text-[11px] font-semibold cursor-pointer"
                      >
                        Cancelar Todo ({formatLempira(paymentAccount.balance)})
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={paymentAccount.balance}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F7F8F6] border border-[#DCE2DD] text-base font-bold text-[#26302D]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#26302D] mb-1.5">
                    Medio en que paga el abono
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'Efectivo', icon: Banknote },
                      { id: 'Transferencia', icon: Smartphone },
                      { id: 'Tarjeta', icon: CreditCard },
                    ].map(({ id, icon: Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          setPayMethod(id as 'Efectivo' | 'Transferencia' | 'Tarjeta')
                        }
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border font-medium transition-colors cursor-pointer ${
                          payMethod === id
                            ? 'bg-[#EEF5F2] border-[#3D6B5E] text-[#2F574B] font-semibold'
                            : 'bg-[#F7F8F6] border-[#DCE2DD] text-[#5C6B66]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{id}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-[#26302D] mb-1">
                    Nota o referencia (opcional)
                  </label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="Ej. Abono quincena, Transferencia BAC..."
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#DCE2DD]"
                  />
                </div>

                <div
                  className={`p-3 rounded-xl border flex items-center justify-between font-semibold ${
                    remainingAfterPay === 0
                      ? 'bg-[#EEF5F2] border-[#CFE0D8] text-[#2F574B]'
                      : 'bg-[#F7F8F6] border-[#E4E9E5] text-[#26302D]'
                  }`}
                >
                  <span>
                    {remainingAfterPay === 0
                      ? '¡La cuenta quedará cancelada al día!'
                      : 'Saldo que quedará pendiente:'}
                  </span>
                  <span>{formatLempira(remainingAfterPay)}</span>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-[#E4E9E5] bg-white flex justify-end gap-2 shrink-0 text-xs">
                <button
                  type="button"
                  onClick={() => setPaymentAccount(null)}
                  className="px-4 py-2 rounded-xl border border-[#DCE2DD] text-[#6B7A74] font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#3D6B5E] text-white font-semibold hover:bg-[#2F574B] cursor-pointer"
                >
                  {submitting ? 'Guardando...' : 'Confirmar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: NUEVO / EDITAR EMPLEADO CON CRÉDITO                          */}
      {/* ===================================================================== */}
      {accountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26302D]/45 backdrop-blur-[2px] p-3 sm:p-4">
          <div className="bg-white border border-[#E4E9E5] rounded-2xl shadow-xl max-w-md w-full max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#E4E9E5] flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-sm text-[#26302D]">
                {editingAccount
                  ? 'Editar Empleado con Crédito'
                  : 'Registrar Empleado del Hospital'}
              </h3>
              <button
                type="button"
                onClick={() => setAccountModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7A74] hover:text-[#26302D] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-[#FCEEED] text-[#A84A3E]">{errorMsg}</div>
                )}

                <div>
                  <label className="block font-medium text-[#26302D] mb-1">
                    Nombre completo del empleado *
                  </label>
                  <input
                    type="text"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    placeholder="Ej. Dra. Gabriela Pineda / Lic. Mario Reyes"
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#DCE2DD]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#26302D] mb-1">
                    Área / Departamento hospitalario *
                  </label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 text-[#6B7A74] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      list="hospital-depts"
                      value={empDept}
                      onChange={(e) => setEmpDept(e.target.value)}
                      placeholder="Ej. Enfermería, Emergencias, Laboratorio..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#DCE2DD]"
                      required
                    />
                  </div>
                  <datalist id="hospital-depts">
                    {HOSPITAL_DEPARTMENTS.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-medium text-[#26302D] mb-1">
                      Teléfono o Código
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-[#6B7A74] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={empPhone}
                        onChange={(e) => setEmpPhone(e.target.value)}
                        placeholder="Ej. 9988-7766"
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#DCE2DD]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-[#26302D] mb-1">
                      Límite de crédito (L, opc.)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={empLimit}
                      onChange={(e) => setEmpLimit(e.target.value)}
                      placeholder="Sin límite (0)"
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#DCE2DD]"
                    />
                  </div>
                </div>

                {!editingAccount && (
                  <div className="p-3 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5] space-y-2.5">
                    <p className="font-semibold text-[#26302D]">
                      ¿Ya tiene saldo pendiente anterior? (Opcional)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[#6B7A74] mb-1">Saldo inicial (L)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={initAmount}
                          onChange={(e) => setInitAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#DCE2DD]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#6B7A74] mb-1">Detalle inicial</label>
                        <input
                          type="text"
                          value={initDesc}
                          onChange={(e) => setInitDesc(e.target.value)}
                          placeholder="Ej. Saldo quincena anterior"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#DCE2DD]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-4 py-3 border-t border-[#E4E9E5] bg-white flex justify-end gap-2 shrink-0 text-xs">
                <button
                  type="button"
                  onClick={() => setAccountModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#DCE2DD] text-[#6B7A74] font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#3D6B5E] text-white font-semibold hover:bg-[#2F574B] cursor-pointer"
                >
                  {submitting ? 'Guardando...' : 'Guardar Empleado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: AGREGAR CARGO MANUAL AL CRÉDITO                              */}
      {/* ===================================================================== */}
      {chargeAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26302D]/45 backdrop-blur-[2px] p-3 sm:p-4">
          <div className="bg-white border border-[#E4E9E5] rounded-2xl shadow-xl max-w-md w-full max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#E4E9E5] flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-sm text-[#26302D]">
                  Agregar Cargo Manual al Crédito
                </h3>
                <p className="text-[11px] text-[#6B7A74]">
                  {chargeAccount.employeeName} • Saldo actual:{' '}
                  {formatLempira(chargeAccount.balance)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChargeAccount(null)}
                className="p-1 rounded-lg text-[#6B7A74] hover:text-[#26302D] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualCharge} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-[#FCEEED] text-[#A84A3E]">{errorMsg}</div>
                )}

                <div className="p-2.5 rounded-xl bg-[#F7F8F6] text-[11px] text-[#5C6B66]">
                  Tip: También puedes cobrarle desde <strong>Ventas</strong> eligiendo método de
                  pago <strong>Crédito</strong> para descontar inventario automáticamente.
                </div>

                <div>
                  <label className="block font-medium text-[#26302D] mb-1">
                    Monto del consumo (L) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F7F8F6] border border-[#DCE2DD] text-base font-bold text-[#26302D]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#26302D] mb-1">
                    Descripción del consumo *
                  </label>
                  <input
                    type="text"
                    value={chargeDesc}
                    onChange={(e) => setChargeDesc(e.target.value)}
                    placeholder="Ej. Almuerzo del día + Café Americano"
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#DCE2DD]"
                    required
                  />
                </div>
              </div>

              <div className="px-4 py-3 border-t border-[#E4E9E5] bg-white flex justify-end gap-2 shrink-0 text-xs">
                <button
                  type="button"
                  onClick={() => setChargeAccount(null)}
                  className="px-4 py-2 rounded-xl border border-[#DCE2DD] text-[#6B7A74] font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#3D6B5E] text-white font-semibold hover:bg-[#2F574B] cursor-pointer"
                >
                  {submitting ? 'Agregando...' : 'Registrar Cargo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: HISTORIAL COMPLETO DE CONSUMOS Y ABONOS                      */}
      {/* ===================================================================== */}
      {historyAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26302D]/45 backdrop-blur-[2px] p-3 sm:p-4">
          <div className="bg-white border border-[#E4E9E5] rounded-2xl shadow-xl max-w-xl w-full max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#E4E9E5] flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-sm text-[#26302D]">
                  Estado de Cuenta — {historyAccount.employeeName}
                </h3>
                <p className="text-[11px] text-[#6B7A74]">
                  {historyAccount.department}
                  {historyAccount.employeeCodeOrPhone
                    ? ` • ${historyAccount.employeeCodeOrPhone}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryAccountId(null)}
                className="p-1 rounded-lg text-[#6B7A74] hover:text-[#26302D] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 overflow-y-auto flex-1 min-h-0 text-xs">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5]">
                  <span className="text-[#6B7A74] block text-[11px]">Consumido</span>
                  <strong className="text-sm text-[#26302D]">
                    {formatLempira(historyAccount.totalCharged)}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-[#EEF5F2] border border-[#CFE0D8]">
                  <span className="text-[#2F574B] block text-[11px]">Abonado</span>
                  <strong className="text-sm text-[#2F574B]">
                    {formatLempira(historyAccount.totalPaid)}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EDE6D8]">
                  <span className="text-[#9A6728] block text-[11px]">Saldo Actual</span>
                  <strong className="text-sm text-[#9A6728]">
                    {formatLempira(historyAccount.balance)}
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-[#F2F5F3] p-1 rounded-xl">
                {[
                  { id: 'todos', label: 'Todo el Historial' },
                  { id: 'cargos', label: `Consumos (${historyAccount.charges.length})` },
                  { id: 'abonos', label: `Abonos (${historyAccount.payments.length})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setHistoryTab(t.id as 'todos' | 'cargos' | 'abonos')}
                    className={`flex-1 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                      historyTab === t.id
                        ? 'bg-white text-[#26302D] font-semibold shadow-2xs'
                        : 'text-[#5C6B66]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="divide-y divide-[#F2F5F3] border border-[#E4E9E5] rounded-xl overflow-hidden">
                {(() => {
                  const events: Array<{
                    id: string;
                    date: string;
                    kind: 'cargo' | 'abono';
                    title: string;
                    subtitle: string;
                    amount: number;
                  }> = [];

                  if (historyTab !== 'abonos') {
                    historyAccount.charges.forEach((c) =>
                      events.push({
                        id: c.id,
                        date: c.date,
                        kind: 'cargo',
                        title: c.description,
                        subtitle: `${c.invoiceNumber ? `${c.invoiceNumber} • ` : ''}Atendió: ${c.createdBy}`,
                        amount: c.amount,
                      })
                    );
                  }

                  if (historyTab !== 'cargos') {
                    historyAccount.payments.forEach((p) =>
                      events.push({
                        id: p.id,
                        date: p.date,
                        kind: 'abono',
                        title: `Abono recibido (${p.paymentMethod})`,
                        subtitle: `${p.notes ? `${p.notes} • ` : ''}Recibió: ${p.receivedBy}`,
                        amount: p.amount,
                      })
                    );
                  }

                  events.sort(
                    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                  );

                  if (events.length === 0) {
                    return (
                      <div className="p-6 text-center text-[#6B7A74]">
                        Sin movimientos registrados en esta vista.
                      </div>
                    );
                  }

                  return events.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 flex items-center justify-between gap-3 bg-white"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              ev.kind === 'abono'
                                ? 'bg-[#EEF5F2] text-[#2F574B]'
                                : 'bg-[#FDF5E8] text-[#9A6728]'
                            }`}
                          >
                            {ev.kind === 'abono' ? 'ABONO' : 'CRÉDITO'}
                          </span>
                          <span className="text-[11px] text-[#6B7A74]">
                            {new Date(ev.date).toLocaleString('es-HN', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                        <p className="font-medium text-[#26302D] mt-0.5">{ev.title}</p>
                        <p className="text-[11px] text-[#6B7A74] truncate">{ev.subtitle}</p>
                      </div>
                      <span
                        className={`font-bold whitespace-nowrap ${
                          ev.kind === 'abono' ? 'text-[#2F574B]' : 'text-[#9A6728]'
                        }`}
                      >
                        {ev.kind === 'abono'
                          ? `-${formatLempira(ev.amount)}`
                          : `+${formatLempira(ev.amount)}`}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className="px-4 py-3 border-t border-[#E4E9E5] bg-white flex items-center justify-between gap-2 shrink-0 text-xs">
              {historyAccount.balance > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const target = historyAccount;
                    setHistoryAccountId(null);
                    openPaymentModal(target);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#3D6B5E] text-white font-semibold hover:bg-[#2F574B] cursor-pointer"
                >
                  Abonar a esta cuenta ({formatLempira(historyAccount.balance)})
                </button>
              ) : (
                <span className="text-[#2F574B] font-semibold">Cuenta al día (L 0.00)</span>
              )}

              <button
                type="button"
                onClick={() => setHistoryAccountId(null)}
                className="px-4 py-2 rounded-xl border border-[#DCE2DD] text-[#26302D] font-medium cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
