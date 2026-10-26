'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { CafeteriaDatabase, ExpenseCategory, OperatingExpense } from '@/lib/types';
import { formatLempira } from '@/lib/currency';

interface ExpensesModuleProps {
  db: CafeteriaDatabase;
  onRefresh: (newDb: CafeteriaDatabase) => void;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Canon / Alquiler Espacio Hospitalario',
  'Servicios Básicos y Refrigeración',
  'Pago a Proveedores de Alimentos y Tienda',
  'Nómina y Turnos (Mañana/Tarde/Guardia)',
  'Mantenimiento y Cadena de Frío',
  'Bioseguridad, Limpieza y Sanitización',
  'Otros Gastos',
];

export default function ExpensesModule({ db, onRefresh }: ExpensesModuleProps) {
  const [concept, setConcept] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>(
    'Canon / Alquiler Espacio Hospitalario'
  );
  const [expenseType, setExpenseType] = useState<'Fijo' | 'Variable'>('Fijo');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<OperatingExpense['paymentMethod']>('Efectivo (Caja)');
  const [submitting, setSubmitting] = useState(false);

  const totalExpenses = useMemo(
    () => db.expenses.reduce((acc, e) => acc + e.amount, 0),
    [db.expenses]
  );

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concept || !amount || Number(amount) <= 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/cafeteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_expense',
          payload: {
            concept,
            category,
            expenseType,
            amount: Number(amount),
            paymentMethod,
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onRefresh(data.db);
        setConcept('');
        setAmount('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const res = await fetch('/api/cafeteria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_expense',
        payload: { id },
      }),
    });
    const data = await res.json();
    if (res.ok) {
      onRefresh(data.db);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[#26302D]">
            Gastos Operativos
          </h2>
          <p className="text-xs text-[#6B7A74]">
            Registra pagos de alquiler, servicios, mantenimiento o limpieza.
          </p>
        </div>

        <div className="bg-white px-4 py-2 rounded-xl border border-[#E4E9E5] flex items-center gap-2">
          <span className="text-xs text-[#6B7A74]">Total Gastos:</span>
          <span className="text-base font-bold text-[#A84A3E]">
            {formatLempira(totalExpenses)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Compact Form */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E4E9E5] p-4">
          <h3 className="font-semibold text-sm text-[#26302D] mb-3">
            Nuevo Gasto
          </h3>

          <form onSubmit={handleAddExpense} className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-[#26302D] mb-1">
                Descripción *
              </label>
              <input
                type="text"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Ej. Pago de luz o limpieza"
                className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5]"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-[#26302D] mb-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5]"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-medium text-[#26302D] mb-1">Monto (L) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5] font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-[#26302D] mb-1">Tipo</label>
                <select
                  value={expenseType}
                  onChange={(e) => setExpenseType(e.target.value as 'Fijo' | 'Variable')}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5]"
                >
                  <option value="Fijo">Costo Fijo</option>
                  <option value="Variable">Costo Variable</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-medium text-[#26302D] mb-1">Medio de Pago</label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as OperatingExpense['paymentMethod'])
                }
                className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5]"
              >
                <option value="Efectivo (Caja)">Efectivo (Caja)</option>
                <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                <option value="Tarjeta Corporativa">Tarjeta</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-[#3D6B5E] text-white font-semibold hover:bg-[#2F574B] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {submitting ? 'Guardando...' : 'Registrar Gasto'}
            </button>
          </form>
        </div>

        {/* Responsive Expense List */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E4E9E5] overflow-hidden">
          {/* Mobile View */}
          <div className="sm:hidden divide-y divide-[#F2F5F3]">
            {db.expenses.map((exp) => (
              <div key={exp.id} className="p-3.5 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold text-[#26302D]">{exp.concept}</div>
                  <div className="text-[#6B7A74] mt-0.5">
                    {new Date(exp.date).toLocaleDateString('es-ES')} • {exp.expenseType}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-sm text-[#A84A3E]">
                    -{formatLempira(exp.amount)}
                  </span>
                  <button
                    onClick={() => handleDeleteExpense(exp.id)}
                    className="p-1.5 rounded-lg text-[#6B7A74] hover:text-[#A84A3E] hover:bg-[#FCEEED] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Tablet/Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#F7F8F6] text-[#6B7A74] text-xs border-b border-[#E4E9E5]">
                  <th className="py-3 px-4 font-medium">Fecha</th>
                  <th className="py-3 px-4 font-medium">Descripción</th>
                  <th className="py-3 px-4 font-medium">Tipo</th>
                  <th className="py-3 px-4 font-medium text-right">Monto</th>
                  <th className="py-3 px-4 font-medium text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F5F3]">
                {db.expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#F7F8F6]/60">
                    <td className="py-2.5 px-4 text-xs text-[#6B7A74] whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(exp.date).toLocaleDateString('es-ES')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-[#26302D]">{exp.concept}</div>
                      <div className="text-[11px] text-[#6B7A74]">{exp.category}</div>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-[#6B7A74]">{exp.expenseType}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-[#A84A3E] whitespace-nowrap">
                      -{formatLempira(exp.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1.5 rounded-lg text-[#6B7A74] hover:text-[#A84A3E] hover:bg-[#FCEEED] cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
