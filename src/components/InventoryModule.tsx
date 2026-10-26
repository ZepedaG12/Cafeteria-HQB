'use client';

import React, { useState, useMemo } from 'react';
import {
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  Edit3,
  Search,
  AlertTriangle,
  ClipboardList,
  Package,
  X,
  Trash2,
} from 'lucide-react';
import {
  CafeteriaDatabase,
  InventoryItem,
  ItemCategory,
  ItemType,
  MeasurementUnit,
  MovementReason,
  RecipeIngredient,
} from '@/lib/types';
import { formatLempira } from '@/lib/currency';

interface InventoryModuleProps {
  db: CafeteriaDatabase;
  onRefresh: (newDb: CafeteriaDatabase) => void;
}

const HOSPITAL_CATEGORIES: ItemCategory[] = [
  'Comidas y Sándwiches',
  'Bebidas e Hidratación',
  'Cafetería y Tés',
  'Snacks y Repostería',
  'Higiene y Uso Personal',
  'Insumos y Materias Primas',
  'Empaques y Descartables',
];

export default function InventoryModule({ db, onRefresh }: InventoryModuleProps) {
  const [subTab, setSubTab] = useState<'catalogo' | 'kardex'>('catalogo');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'producto_terminado' | 'insumo'>('todos');
  const [search, setSearch] = useState('');
  const [kardexFilter, setKardexFilter] = useState<string>('todos');

  // Modal states
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);

  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<'entrada_compra' | 'salida_merma'>('entrada_compra');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [movQuantity, setMovQuantity] = useState<string>('');
  const [movUnitCost, setMovUnitCost] = useState<string>('');
  const [movReason, setMovReason] = useState<MovementReason>('Compra a proveedor');
  const [movNotes, setMovNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Recipe builder inside Item Modal
  const [selectedInsumoForRecipe, setSelectedInsumoForRecipe] = useState<string>('');
  const [recipeQty, setRecipeQty] = useState<string>('');

  const insumosList = useMemo(
    () => db.inventory.filter((i) => i.type === 'insumo' || i.type === 'ambos'),
    [db.inventory]
  );

  const filteredInventory = useMemo(() => {
    return db.inventory.filter((item) => {
      const matchesType =
        typeFilter === 'todos' ||
        item.type === typeFilter ||
        (typeFilter === 'producto_terminado' && item.type === 'ambos');
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [db.inventory, typeFilter, search]);

  const filteredMovements = useMemo(() => {
    return db.movements.filter((m) => {
      if (kardexFilter === 'todos') return true;
      return m.movementType === kardexFilter;
    });
  }, [db.movements, kardexFilter]);

  const openNewItemModal = () => {
    setEditingItem({
      name: '',
      code: '',
      type: 'producto_terminado',
      category: 'Comidas y Sándwiches',
      unit: 'unid',
      currentStock: 15,
      minStock: 5,
      unitCost: 30,
      salePrice: 65,
      trackDirectStock: true,
      recipe: [],
    });
    setItemModalOpen(true);
  };

  const openEditItemModal = (item: InventoryItem) => {
    setEditingItem({ ...item, recipe: [...(item.recipe || [])] });
    setItemModalOpen(true);
  };

  const openQuickMovement = (
    type: 'entrada_compra' | 'salida_merma',
    item?: InventoryItem
  ) => {
    const target = item || db.inventory.find((i) => i.trackDirectStock) || db.inventory[0];
    setMovementType(type);
    setSelectedItemId(target?.id || '');
    setMovQuantity('');
    setMovUnitCost(target ? String(target.unitCost) : '');
    setMovReason(type === 'entrada_compra' ? 'Compra a proveedor' : 'Producto vencido');
    setMovNotes('');
    setMovementModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/cafeteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_item',
          payload: editingItem,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onRefresh(data.db);
        setItemModalOpen(false);
        setEditingItem(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !movQuantity) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/cafeteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_movement',
          payload: {
            itemId: selectedItemId,
            movementType,
            reasonCategory: movReason,
            quantity: Number(movQuantity),
            unitCost: Number(movUnitCost),
            notes: movNotes,
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onRefresh(data.db);
        setMovementModalOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const addRecipeIngredient = () => {
    if (!editingItem || !selectedInsumoForRecipe || !recipeQty) return;
    const insumo = db.inventory.find((i) => i.id === selectedInsumoForRecipe);
    if (!insumo) return;
    const newIng: RecipeIngredient = {
      insumoId: insumo.id,
      insumoName: insumo.name,
      quantity: Number(recipeQty),
      unit: insumo.unit,
    };
    const currentRecipe = editingItem.recipe || [];
    setEditingItem({
      ...editingItem,
      trackDirectStock: false,
      recipe: [...currentRecipe.filter((r) => r.insumoId !== insumo.id), newIng],
    });
    setRecipeQty('');
  };

  const removeRecipeIngredient = (insumoId: string) => {
    if (!editingItem) return;
    setEditingItem({
      ...editingItem,
      recipe: (editingItem.recipe || []).filter((r) => r.insumoId !== insumoId),
    });
  };

  return (
    <div className="space-y-4">
      {/* Compact Header & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[#26302D]">Inventario</h2>
          <p className="text-xs text-[#6B7A74]">
            Productos, insumos, entradas por compras y bajas por vencimiento/mermas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => openQuickMovement('entrada_compra')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#CFE0D8] text-[#2F574B] text-xs font-medium hover:bg-[#EEF5F2] transition-colors cursor-pointer"
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
            + Entrada
          </button>

          <button
            onClick={() => openQuickMovement('salida_merma')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#EBC7C3] text-[#A84A3E] text-xs font-medium hover:bg-[#FCEEED] transition-colors cursor-pointer"
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            - Salida / Merma
          </button>

          <button
            onClick={openNewItemModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#3D6B5E] text-white text-xs font-semibold hover:bg-[#2F574B] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E4E9E5]">
          <button
            onClick={() => setSubTab('catalogo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              subTab === 'catalogo'
                ? 'bg-[#3D6B5E] text-white'
                : 'text-[#5C6B66] hover:text-[#26302D]'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Catálogo ({db.inventory.length})
          </button>
          <button
            onClick={() => setSubTab('kardex')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              subTab === 'kardex'
                ? 'bg-[#3D6B5E] text-white'
                : 'text-[#5C6B66] hover:text-[#26302D]'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Movimientos ({db.movements.length})
          </button>
        </div>

        {subTab === 'catalogo' && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center bg-white p-1 rounded-xl border border-[#E4E9E5] text-xs">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'producto_terminado', label: 'De Venta' },
                { id: 'insumo', label: 'Insumos' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTypeFilter(tab.id as 'todos' | 'producto_terminado' | 'insumo')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    typeFilter === tab.id
                      ? 'bg-[#F2F5F3] text-[#26302D]'
                      : 'text-[#6B7A74]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 sm:w-52">
              <Search className="w-3.5 h-3.5 text-[#6B7A74] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-[#E4E9E5] text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {subTab === 'catalogo' ? (
        <div className="bg-white rounded-2xl border border-[#E4E9E5] overflow-hidden">
          {/* Mobile Cards (< md) so buttons are ALWAYS visible on phones & vertical tablets */}
          <div className="md:hidden divide-y divide-[#F2F5F3]">
            {filteredInventory.map((item) => {
              const isLow = item.trackDirectStock && item.currentStock <= item.minStock;
              return (
                <div key={item.id} className="p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm text-[#26302D]">{item.name}</div>
                      <div className="text-[#6B7A74] mt-0.5">{item.category}</div>
                    </div>
                    <div className="text-right shrink-0">
                      {item.salePrice > 0 && (
                        <div className="font-bold text-sm text-[#26302D]">
                          {formatLempira(item.salePrice)}
                        </div>
                      )}
                      <div
                        className={`text-xs font-medium ${
                          isLow ? 'text-[#9A6728]' : 'text-[#5C6B66]'
                        }`}
                      >
                        {item.trackDirectStock
                          ? `Stock: ${item.currentStock} ${item.unit}`
                          : 'Por receta'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    {item.trackDirectStock && (
                      <>
                        <button
                          onClick={() => openQuickMovement('entrada_compra', item)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#EEF5F2] text-[#2F574B] font-medium cursor-pointer"
                        >
                          + Entrada
                        </button>
                        <button
                          onClick={() => openQuickMovement('salida_merma', item)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#FCEEED] text-[#A84A3E] font-medium cursor-pointer"
                        >
                          - Salida
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => openEditItemModal(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F2F5F3] text-[#26302D] font-medium cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Editar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop/Tablet Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#F7F8F6] text-[#6B7A74] text-xs border-b border-[#E4E9E5]">
                  <th className="py-3 px-4 font-medium">Producto / Insumo</th>
                  <th className="py-3 px-4 font-medium">Categoría</th>
                  <th className="py-3 px-4 font-medium text-right">Disponible</th>
                  <th className="py-3 px-4 font-medium text-right">Precio Venta</th>
                  <th className="py-3 px-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F5F3]">
                {filteredInventory.map((item) => {
                  const isLow = item.trackDirectStock && item.currentStock <= item.minStock;
                  return (
                    <tr key={item.id} className="hover:bg-[#F7F8F6]/60 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-[#26302D]">{item.name}</div>
                        <div className="text-[11px] text-[#6B7A74]">
                          Costo: {formatLempira(item.unitCost, item.unitCost < 0.1 ? 3 : 2)} / {item.unit}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-[#5C6B66]">
                        {item.category}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {item.trackDirectStock ? (
                          <div className="inline-flex items-center gap-1">
                            {isLow && (
                              <AlertTriangle className="w-3.5 h-3.5 text-[#9A6728]" />
                            )}
                            <span
                              className={`font-semibold ${
                                isLow ? 'text-[#9A6728]' : 'text-[#26302D]'
                              }`}
                            >
                              {item.currentStock.toLocaleString()} {item.unit}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-[#6B7A74]">Por receta</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-[#26302D] whitespace-nowrap">
                        {item.salePrice > 0 ? formatLempira(item.salePrice) : '—'}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.trackDirectStock && (
                            <>
                              <button
                                onClick={() => openQuickMovement('entrada_compra', item)}
                                className="px-2.5 py-1 rounded-lg bg-[#EEF5F2] text-[#2F574B] hover:bg-[#dcebe4] text-xs font-medium cursor-pointer"
                              >
                                + Entrada
                              </button>
                              <button
                                onClick={() => openQuickMovement('salida_merma', item)}
                                className="px-2.5 py-1 rounded-lg bg-[#FCEEED] text-[#A84A3E] hover:bg-[#f7dedc] text-xs font-medium cursor-pointer"
                              >
                                - Salida
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openEditItemModal(item)}
                            className="p-1.5 rounded-lg bg-[#F2F5F3] text-[#5C6B66] hover:text-[#26302D] cursor-pointer"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Kardex de Movimientos */
        <div className="bg-white rounded-2xl border border-[#E4E9E5] overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-[#E4E9E5] flex flex-wrap items-center justify-between gap-2.5">
            <span className="font-semibold text-sm text-[#26302D]">
              Registro de Entradas y Salidas
            </span>

            <div className="flex items-center gap-1 bg-[#F2F5F3] p-1 rounded-xl text-xs overflow-x-auto no-scrollbar">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'entrada_compra', label: 'Entradas' },
                { id: 'salida_merma', label: 'Mermas / Vencidos' },
                { id: 'salida_venta', label: 'Ventas' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setKardexFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    kardexFilter === f.id
                      ? 'bg-white text-[#26302D] shadow-2xs'
                      : 'text-[#6B7A74]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#F7F8F6] text-[#6B7A74] text-xs border-b border-[#E4E9E5]">
                  <th className="py-2.5 px-4 font-medium">Fecha</th>
                  <th className="py-2.5 px-4 font-medium">Motivo</th>
                  <th className="py-2.5 px-4 font-medium">Producto</th>
                  <th className="py-2.5 px-4 font-medium text-right">Cantidad</th>
                  <th className="py-2.5 px-4 font-medium text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F5F3]">
                {filteredMovements.map((mov) => {
                  const isPositive = mov.quantity > 0;
                  return (
                    <tr key={mov.id} className="hover:bg-[#F7F8F6]/60">
                      <td className="py-2.5 px-4 text-xs text-[#6B7A74] whitespace-nowrap">
                        {new Date(mov.date).toLocaleString('es-ES', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-medium ${
                            isPositive
                              ? 'bg-[#EEF5F2] text-[#2F574B]'
                              : mov.movementType === 'salida_merma'
                              ? 'bg-[#FCEEED] text-[#A84A3E]'
                              : 'bg-[#F2F5F3] text-[#5C6B66]'
                          }`}
                        >
                          {mov.reasonCategory}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-[#26302D]">{mov.itemName}</div>
                        {mov.notes && (
                          <div className="text-[11px] text-[#6B7A74]">{mov.notes}</div>
                        )}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-semibold whitespace-nowrap ${
                          isPositive ? 'text-[#2F574B]' : 'text-[#A84A3E]'
                        }`}
                      >
                        {isPositive ? `+${mov.quantity}` : mov.quantity} {mov.itemUnit}
                      </td>
                      <td className="py-2.5 px-4 text-right text-[#26302D] whitespace-nowrap">
                        {formatLempira(mov.totalCost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Registrar Entrada o Salida/Merma (max-h-[90dvh] con botones siempre visibles) */}
      {movementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26302D]/45 backdrop-blur-[2px] p-3 sm:p-4">
          <div className="bg-white border border-[#E4E9E5] rounded-2xl shadow-xl max-w-md w-full max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#E4E9E5] flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-sm text-[#26302D]">
                {movementType === 'entrada_compra'
                  ? 'Registrar Entrada (Compra)'
                  : 'Registrar Salida o Merma'}
              </h3>
              <button
                onClick={() => setMovementModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7A74] hover:text-[#26302D] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterMovement} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
                <div>
                  <label className="block font-medium text-[#26302D] mb-1">
                    Producto o Insumo
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => {
                      setSelectedItemId(e.target.value);
                      const found = db.inventory.find((i) => i.id === e.target.value);
                      if (found) setMovUnitCost(String(found.unitCost));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5]"
                    required
                  >
                    {db.inventory
                      .filter((i) => i.trackDirectStock)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.currentStock} {item.unit})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-[#26302D] mb-1">Motivo</label>
                    <select
                      value={movReason}
                      onChange={(e) => setMovReason(e.target.value as MovementReason)}
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5]"
                    >
                      {movementType === 'entrada_compra' ? (
                        <>
                          <option value="Compra a proveedor">Compra a proveedor</option>
                          <option value="Reposición de stock">Reposición de stock</option>
                        </>
                      ) : (
                        <>
                          <option value="Producto vencido">Producto vencido</option>
                          <option value="Merma / Derrame">Merma / Dañado</option>
                          <option value="Consumo interno">Consumo interno</option>
                          <option value="Muestra / Cortesía">Cortesía</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-[#26302D] mb-1">
                      Cantidad ({db.inventory.find((i) => i.id === selectedItemId)?.unit || 'unid'})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={movQuantity}
                      onChange={(e) => setMovQuantity(e.target.value)}
                      placeholder="Ej. 10"
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5] font-semibold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-[#26302D] mb-1">
                    Nota opcional
                  </label>
                  <input
                    type="text"
                    value={movNotes}
                    onChange={(e) => setMovNotes(e.target.value)}
                    placeholder="Ej. Proveedor o detalle..."
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5]"
                  />
                </div>
              </div>

              <div className="px-4 py-3 border-t border-[#E4E9E5] bg-white flex justify-end gap-2 shrink-0 text-xs">
                <button
                  type="button"
                  onClick={() => setMovementModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#DCE2DD] text-[#6B7A74] font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2 rounded-xl text-white font-semibold cursor-pointer ${
                    movementType === 'entrada_compra'
                      ? 'bg-[#3D6B5E] hover:bg-[#2F574B]'
                      : 'bg-[#A84A3E] hover:bg-[#8e3d33]'
                  }`}
                >
                  {submitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Crear / Editar Producto (max-h-[90dvh] con footer fijo siempre visible) */}
      {itemModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26302D]/45 backdrop-blur-[2px] p-3 sm:p-4">
          <div className="bg-white border border-[#E4E9E5] rounded-2xl shadow-xl max-w-lg w-full max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#E4E9E5] flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-sm text-[#26302D]">
                {editingItem.id ? 'Editar Producto' : 'Nuevo Producto o Insumo'}
              </h3>
              <button
                onClick={() => setItemModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7A74] hover:text-[#26302D] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
                <div>
                  <label className="block font-medium text-[#26302D] mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={editingItem.name || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    placeholder="Ej. Sándwich de Pollo, Agua 600ml..."
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5]"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-[#26302D] mb-1">Tipo</label>
                    <select
                      value={editingItem.type || 'producto_terminado'}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          type: e.target.value as ItemType,
                          trackDirectStock:
                            e.target.value === 'insumo' ? true : editingItem.trackDirectStock,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5]"
                    >
                      <option value="producto_terminado">Producto de Venta</option>
                      <option value="insumo">Insumo / Materia Prima</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-[#26302D] mb-1">Categoría</label>
                    <select
                      value={editingItem.category || 'Comidas y Sándwiches'}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          category: e.target.value as ItemCategory,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5]"
                    >
                      {HOSPITAL_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-medium text-[#26302D] mb-1">Costo (L)</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={editingItem.unitCost ?? 0}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, unitCost: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5]"
                    />
                  </div>

                  {editingItem.type !== 'insumo' && (
                    <div>
                      <label className="block font-medium text-[#26302D] mb-1">
                        Precio (L)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingItem.salePrice ?? 0}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, salePrice: Number(e.target.value) })
                        }
                        className="w-full px-2.5 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5] font-semibold"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-medium text-[#26302D] mb-1">Unidad</label>
                    <select
                      value={editingItem.unit || 'unid'}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          unit: e.target.value as MeasurementUnit,
                        })
                      }
                      className="w-full px-2.5 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5]"
                    >
                      <option value="unid">Unidades</option>
                      <option value="g">Gramos (g)</option>
                      <option value="ml">Mililitros (ml)</option>
                    </select>
                  </div>
                </div>

                {editingItem.trackDirectStock && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-[#26302D] mb-1">
                        Stock Actual
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingItem.currentStock ?? 0}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            currentStock: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5]"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-[#26302D] mb-1">
                        Stock Mínimo
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingItem.minStock ?? 0}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, minStock: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5]"
                      />
                    </div>
                  </div>
                )}

                {editingItem.type !== 'insumo' && (
                  <div className="p-3 rounded-xl bg-[#F7F8F6] space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[#6B7A74]">Descuento al vender:</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingItem({ ...editingItem, trackDirectStock: true })
                          }
                          className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${
                            editingItem.trackDirectStock
                              ? 'bg-[#3D6B5E] text-white'
                              : 'bg-white text-[#6B7A74]'
                          }`}
                        >
                          Por Unidad
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingItem({ ...editingItem, trackDirectStock: false })
                          }
                          className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${
                            !editingItem.trackDirectStock
                              ? 'bg-[#3D6B5E] text-white'
                              : 'bg-white text-[#6B7A74]'
                          }`}
                        >
                          Por Receta
                        </button>
                      </div>
                    </div>

                    {!editingItem.trackDirectStock && (
                      <div className="space-y-2 pt-2 border-t border-[#E4E9E5]">
                        <div className="flex gap-1.5">
                          <select
                            value={selectedInsumoForRecipe}
                            onChange={(e) => setSelectedInsumoForRecipe(e.target.value)}
                            className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-white border border-[#DCE2DD]"
                          >
                            <option value="">Elegir insumo...</option>
                            {insumosList.map((ins) => (
                              <option key={ins.id} value={ins.id}>
                                {ins.name} ({ins.unit})
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.1"
                            value={recipeQty}
                            onChange={(e) => setRecipeQty(e.target.value)}
                            placeholder="Cant."
                            className="w-18 px-2 py-1.5 rounded-lg bg-white border border-[#DCE2DD]"
                          />
                          <button
                            type="button"
                            onClick={addRecipeIngredient}
                            className="px-2.5 py-1.5 rounded-lg bg-[#3D6B5E] text-white cursor-pointer shrink-0"
                          >
                            +
                          </button>
                        </div>

                        {(editingItem.recipe || []).map((r) => (
                          <div
                            key={r.insumoId}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white"
                          >
                            <span className="truncate pr-2">
                              {r.quantity} {r.unit} de {r.insumoName}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeRecipeIngredient(r.insumoId)}
                              className="text-[#A84A3E] cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-4 py-3 border-t border-[#E4E9E5] bg-white flex justify-end gap-2 shrink-0 text-xs">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#DCE2DD] text-[#6B7A74] font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#3D6B5E] text-white font-semibold hover:bg-[#2F574B] cursor-pointer"
                >
                  {submitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
