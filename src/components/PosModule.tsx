'use client';

import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  Search,
  History,
  CheckCircle2,
  Eye,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Percent,
} from 'lucide-react';
import {
  CafeteriaDatabase,
  CustomerProfile,
  InventoryItem,
  SaleTransaction,
} from '@/lib/types';
import { formatLempira } from '@/lib/currency';

interface PosModuleProps {
  db: CafeteriaDatabase;
  onRefresh: (newDb: CafeteriaDatabase) => void;
  onShowReceipt: (sale: SaleTransaction) => void;
}

const QUICK_DISCOUNT_PERCENTS = [0, 5, 10, 15, 25];

export default function PosModule({ db, onRefresh, onShowReceipt }: PosModuleProps) {
  const [subTab, setSubTab] = useState<'caja' | 'historial'>('caja');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Mobile/Tablet cart drawer state
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Cart state
  const [cart, setCart] = useState<Array<{ product: InventoryItem; quantity: number }>>([]);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [documentType, setDocumentType] = useState<'Ticket' | 'Factura'>('Ticket');
  const [customerProfile, setCustomerProfile] =
    useState<CustomerProfile>('Visitante / Familiar');
  const [paymentMethod, setPaymentMethod] =
    useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
  const [customerName, setCustomerName] = useState('Consumidor Final');
  const [customerRtn, setCustomerRtn] = useState('C/F');
  const [discountPercent, setDiscountPercent] = useState<string>('0');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // History filter
  const [historySearch, setHistorySearch] = useState('');

  const sellableProducts = useMemo(() => {
    return db.inventory.filter(
      (item) => (item.type === 'producto_terminado' || item.type === 'ambos') && item.active
    );
  }, [db.inventory]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(sellableProducts.map((p) => p.category)));
    return ['Todos', ...cats];
  }, [sellableProducts]);

  const filteredProducts = useMemo(() => {
    return sellableProducts.filter((p) => {
      const matchesCat = selectedCategory === 'Todos' || p.category === selectedCategory;
      const matchesQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [sellableProducts, selectedCategory, searchQuery]);

  const addToCart = (product: InventoryItem) => {
    setErrorMsg(null);
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (product.trackDirectStock && existing.quantity + 1 > product.currentStock) {
          setErrorMsg(`Solo quedan ${product.currentStock} disp. de "${product.name}".`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        if (product.trackDirectStock && product.currentStock < 1) {
          setErrorMsg(`"${product.name}" está agotado.`);
          return prev;
        }
        return [...prev, { product, quantity: 1 }];
      }
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setErrorMsg(null);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const nextQty = item.quantity + delta;
          if (
            delta > 0 &&
            item.product.trackDirectStock &&
            nextQty > item.product.currentStock
          ) {
            setErrorMsg(`Stock máximo disponible: ${item.product.currentStock}`);
            return item;
          }
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const totalItemsCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const subtotal = useMemo(() => {
    return Number(
      cart.reduce((acc, item) => acc + item.product.salePrice * item.quantity, 0).toFixed(2)
    );
  }, [cart]);

  const numericDiscountPercent = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const numericDiscountAmount = Number(((subtotal * numericDiscountPercent) / 100).toFixed(2));
  const total = Number(Math.max(0, subtotal - numericDiscountAmount).toFixed(2));
  const numericReceived = Number(amountReceived) || 0;
  const changePreview =
    paymentMethod === 'Efectivo' && numericReceived > total
      ? Number((numericReceived - total).toFixed(2))
      : 0;

  const handleDiscountInputChange = (val: string) => {
    if (val === '') {
      setDiscountPercent('');
      return;
    }
    const parsed = Number(val);
    if (Number.isNaN(parsed)) return;
    if (parsed < 0) {
      setDiscountPercent('0');
    } else if (parsed > 100) {
      setDiscountPercent('100');
    } else {
      setDiscountPercent(val);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (paymentMethod === 'Efectivo' && amountReceived !== '' && numericReceived < total) {
      setErrorMsg('El efectivo recibido es menor al total en Lempiras.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/cafeteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_sale',
          payload: {
            customerName,
            customerRtn,
            customerProfile,
            documentType,
            paymentMethod,
            discountPercent: numericDiscountPercent,
            amountReceived:
              paymentMethod === 'Efectivo' && numericReceived >= total ? numericReceived : total,
            notes,
            items: cart.map((c) => ({
              productId: c.product.id,
              quantity: c.quantity,
            })),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'No se pudo procesar la venta.');
      } else {
        onRefresh(data.db);
        setCart([]);
        setDiscountPercent('0');
        setAmountReceived('');
        setNotes('');
        setCustomerName('Consumidor Final');
        setCustomerRtn('C/F');
        setShowMoreOptions(false);
        setMobileCartOpen(false);
        onShowReceipt(data.sale);
      }
    } catch {
      setErrorMsg('Error al registrar la venta.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSales = useMemo(() => {
    const q = historySearch.toLowerCase();
    return db.sales.filter(
      (s) =>
        s.invoiceNumber.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        (s.customerRtn || '').toLowerCase().includes(q) ||
        s.items.some((i) => i.productName.toLowerCase().includes(q))
    );
  }, [db.sales, historySearch]);

  // Reusable Checkout Panel Content (used in Desktop right column AND Mobile/Tablet slide-up drawer)
  const renderCheckoutForm = (isMobileDrawer = false) => (
    <form
      onSubmit={handleCheckout}
      className="flex flex-col flex-1 min-h-0 overflow-hidden"
    >
      {/* Top Header (Pinned) */}
      <div className="px-4 py-3 border-b border-[#E4E9E5] flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-[#26302D]">
            Cuenta Actual {totalItemsCount > 0 ? `(${totalItemsCount})` : ''}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setCart([])}
              className="text-xs text-[#A84A3E] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
          {isMobileDrawer && (
            <button
              type="button"
              onClick={() => setMobileCartOpen(false)}
              className="p-1 rounded-lg bg-[#F2F5F3] text-[#5C6B66] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Middle Area (Cart Items + Discount % + Payment + Optional RTN/Details) */}
      <div className="p-3.5 space-y-3 overflow-y-auto flex-1 min-h-0">
        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-[#FCEEED] text-[#A84A3E] text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {cart.length === 0 ? (
          <div className="py-7 text-center text-[#6B7A74]">
            <ShoppingBag className="w-6 h-6 text-[#C5D1CB] mx-auto mb-1.5" />
            <p className="text-xs">Toca cualquier producto para agregarlo</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F2F5F3] border border-[#E4E9E5] rounded-xl px-3 bg-[#F7F8F6]/50">
            {cart.map(({ product, quantity }) => (
              <div key={product.id} className="py-2 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#26302D] truncate">
                    {product.name}
                  </p>
                  <p className="text-[11px] text-[#6B7A74]">
                    {formatLempira(product.salePrice)} c/u
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateCartQty(product.id, -1)}
                    className="w-6 h-6 rounded-lg bg-white border border-[#DCE2DD] flex items-center justify-center text-[#26302D] hover:bg-[#EDF1EE] cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-5 text-center text-xs font-semibold">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateCartQty(product.id, 1)}
                    className="w-6 h-6 rounded-lg bg-white border border-[#DCE2DD] flex items-center justify-center text-[#26302D] hover:bg-[#EDF1EE] cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="w-20 text-right text-xs font-semibold text-[#26302D] whitespace-nowrap">
                  {formatLempira(product.salePrice * quantity)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Percentage Discount Selector (%) */}
        <div className="p-2.5 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] font-medium text-[#5C6B66] flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-[#3D6B5E]" />
              <span>Descuento (%)</span>
            </label>
            <div className="relative w-22">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={discountPercent}
                onChange={(e) => handleDiscountInputChange(e.target.value)}
                placeholder="0"
                className="w-full pl-2.5 pr-6 py-1 rounded-lg bg-white border border-[#DCE2DD] text-right text-xs font-semibold text-[#26302D]"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#6B7A74] font-semibold">
                %
              </span>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1">
            {QUICK_DISCOUNT_PERCENTS.map((pct) => {
              const active = numericDiscountPercent === pct;
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setDiscountPercent(String(pct))}
                  className={`py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#3D6B5E] text-white font-semibold'
                      : 'bg-white border border-[#E4E9E5] text-[#5C6B66] hover:bg-[#EDF1EE]'
                  }`}
                >
                  {pct}%
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-[11px] font-medium text-[#6B7A74] mb-1.5">
            Método de pago
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'Efectivo', icon: Banknote },
              { id: 'Tarjeta', icon: CreditCard },
              { id: 'Transferencia', icon: Smartphone },
            ].map(({ id, icon: Icon }) => (
              <button
                type="button"
                key={id}
                onClick={() =>
                  setPaymentMethod(id as 'Efectivo' | 'Tarjeta' | 'Transferencia')
                }
                className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  paymentMethod === id
                    ? 'bg-[#EEF5F2] border-[#3D6B5E] text-[#2F574B] font-semibold'
                    : 'bg-[#F7F8F6] border-[#E4E9E5] text-[#6B7A74]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cash Quick Change Calculator */}
        {paymentMethod === 'Efectivo' && cart.length > 0 && (
          <div className="p-2.5 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5] space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#6B7A74]">Efectivo recibido (L):</span>
              <input
                type="number"
                step="0.01"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder={total.toFixed(2)}
                className="w-28 px-2 py-1 rounded-lg bg-white border border-[#DCE2DD] text-right font-semibold"
              />
            </div>
            {numericReceived > total && (
              <div className="flex justify-between items-center pt-1 border-t border-[#E4E9E5] text-[#2F574B] font-semibold">
                <span>Cambio a devolver:</span>
                <span>{formatLempira(changePreview)}</span>
              </div>
            )}
          </div>
        )}

        {/* Collapsible Optional Details (Factura / RTN / Cliente) */}
        <div>
          <button
            type="button"
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="w-full flex items-center justify-between py-1.5 text-xs text-[#6B7A74] hover:text-[#26302D] cursor-pointer"
          >
            <span>Datos de factura, RTN o habitación (opcional)</span>
            {showMoreOptions ? (
              <ChevronUp className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 shrink-0" />
            )}
          </button>

          {showMoreOptions && (
            <div className="p-3 mt-1 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5] space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#6B7A74] mb-1">Comprobante</label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as 'Ticket' | 'Factura')}
                    className="w-full px-2 py-1.5 rounded-lg bg-white border border-[#DCE2DD]"
                  >
                    <option value="Ticket">Ticket</option>
                    <option value="Factura">Factura</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#6B7A74] mb-1">Tipo Cliente</label>
                  <select
                    value={customerProfile}
                    onChange={(e) => setCustomerProfile(e.target.value as CustomerProfile)}
                    className="w-full px-2 py-1.5 rounded-lg bg-white border border-[#DCE2DD]"
                  >
                    <option value="Visitante / Familiar">Visitante / Familiar</option>
                    <option value="Personal Médico / Staff">Médico / Staff</option>
                    <option value="Paciente / Habitación">A Habitación</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#6B7A74] mb-1">Nombre del Cliente</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-white border border-[#DCE2DD]"
                  />
                </div>
                <div>
                  <label className="block text-[#6B7A74] mb-1">RTN</label>
                  <input
                    type="text"
                    value={customerRtn}
                    onChange={(e) => setCustomerRtn(e.target.value)}
                    placeholder="C/F o 0801-XXXX-XXXXXX"
                    className="w-full px-2 py-1.5 rounded-lg bg-white border border-[#DCE2DD]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#6B7A74] mb-1">Habitación / Nota</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Habitación 304, Emergencias..."
                  className="w-full px-2 py-1.5 rounded-lg bg-white border border-[#DCE2DD]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pinned Footer: ALWAYS VISIBLE Subtotal/Descuento% + Total + Cobrar Button */}
      <div className="p-3.5 border-t border-[#E4E9E5] bg-white space-y-2 shrink-0">
        {numericDiscountPercent > 0 && cart.length > 0 && (
          <div className="space-y-0.5 text-xs pb-1.5 border-b border-dashed border-[#E4E9E5]">
            <div className="flex justify-between text-[#6B7A74]">
              <span>Subtotal</span>
              <span>{formatLempira(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[#2F574B] font-medium">
              <span>Descuento ({numericDiscountPercent}%)</span>
              <span>-{formatLempira(numericDiscountAmount)}</span>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-[#6B7A74]">Total a cobrar</span>
          <span className="text-xl font-bold text-[#26302D]">
            {formatLempira(total)}
          </span>
        </div>

        <button
          type="submit"
          disabled={cart.length === 0 || submitting}
          className="w-full py-2.5 px-4 rounded-xl bg-[#3D6B5E] text-white font-semibold text-sm hover:bg-[#2F574B] disabled:opacity-40 transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            {submitting
              ? 'Procesando...'
              : cart.length > 0
              ? `Cobrar Venta (${formatLempira(total)})`
              : 'Cobrar Venta'}
          </span>
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-3 sm:space-y-4 pb-20 lg:pb-2">
      {/* Compact Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[#26302D]">
            Ventas y Facturación
          </h2>
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E4E9E5]">
          <button
            onClick={() => setSubTab('caja')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              subTab === 'caja'
                ? 'bg-[#3D6B5E] text-white'
                : 'text-[#5C6B66] hover:text-[#26302D]'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Nueva Venta
          </button>
          <button
            onClick={() => setSubTab('historial')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              subTab === 'historial'
                ? 'bg-[#3D6B5E] text-white'
                : 'text-[#5C6B66] hover:text-[#26302D]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Historial ({db.sales.length})
          </button>
        </div>
      </div>

      {subTab === 'caja' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left: Compact Product Catalog (8 cols on desktop, full width on mobile/tablet) */}
            <div className="lg:col-span-8 space-y-3 min-w-0">
              {/* Search + Horizontal Swipeable Categories */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#6B7A74] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar producto (ej. agua, sándwich, café, kit dental)..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#E4E9E5] text-xs sm:text-sm focus:outline-none focus:border-[#3D6B5E]"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                        selectedCategory === cat
                          ? 'bg-[#3D6B5E] text-white'
                          : 'bg-white border border-[#E4E9E5] text-[#5C6B66] hover:bg-[#F2F5F3]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compact Responsive Product Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filteredProducts.map((product) => {
                  const inCart = cart.find((c) => c.product.id === product.id)?.quantity || 0;
                  const isLowStock =
                    product.trackDirectStock && product.currentStock <= product.minStock;
                  const isOut = product.trackDirectStock && product.currentStock <= 0;

                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={isOut}
                      className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between min-h-[92px] cursor-pointer active:scale-[0.98] ${
                        isOut
                          ? 'bg-[#F2F5F3] border-[#E4E9E5] opacity-50 cursor-not-allowed'
                          : inCart > 0
                          ? 'bg-[#EEF5F2] border-[#3D6B5E] shadow-2xs'
                          : 'bg-white border-[#E4E9E5] hover:border-[#B8C7C0]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <h3 className="font-medium text-xs sm:text-[13px] text-[#26302D] leading-snug line-clamp-2">
                          {product.name}
                        </h3>
                        {inCart > 0 && (
                          <span className="w-5 h-5 rounded-full bg-[#3D6B5E] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                            {inCart}
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-1">
                        <span className="text-sm font-bold text-[#26302D]">
                          {formatLempira(product.salePrice)}
                        </span>

                        <span
                          className={`text-[10px] truncate ${
                            isOut
                              ? 'text-[#A84A3E] font-medium'
                              : isLowStock
                              ? 'text-[#9A6728] font-medium'
                              : 'text-[#6B7A74]'
                          }`}
                        >
                          {product.trackDirectStock
                            ? isOut
                              ? 'Agotado'
                              : `${product.currentStock} disp.`
                            : 'Barra'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Desktop Pinned Checkout Panel (fits viewport height so button is NEVER cut off!) */}
            <div className="hidden lg:flex lg:col-span-4 bg-white rounded-2xl border border-[#E4E9E5] sticky top-16 max-h-[calc(100dvh-5rem)] flex-col overflow-hidden shadow-2xs">
              {renderCheckoutForm(false)}
            </div>
          </div>

          {/* Mobile & Tablet Sticky Bottom Checkout Trigger (< lg) */}
          <div className="lg:hidden fixed bottom-14 md:bottom-3 inset-x-3 z-20">
            <button
              type="button"
              onClick={() => setMobileCartOpen(true)}
              className="w-full py-3 px-4 rounded-2xl bg-[#3D6B5E] text-white shadow-lg flex items-center justify-between text-xs sm:text-sm font-semibold active:scale-[0.99] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                <span>
                  {totalItemsCount > 0
                    ? `${totalItemsCount} artículo${totalItemsCount > 1 ? 's' : ''} en cuenta`
                    : 'Cuenta vacía (Ver caja)'}
                </span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/15 font-bold">
                Cobrar • {formatLempira(total)}
              </span>
            </button>
          </div>

          {/* Mobile & Tablet Cart Slide-Up Drawer */}
          {mobileCartOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#26302D]/45 backdrop-blur-[2px] p-0 sm:p-4">
              <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[88dvh] flex flex-col overflow-hidden shadow-xl">
                {renderCheckoutForm(true)}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Responsive Sales History (Cards on Mobile, Compact Table on Tablet/Desktop) */
        <div className="bg-white rounded-2xl border border-[#E4E9E5] overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-[#E4E9E5] flex flex-wrap items-center justify-between gap-2.5">
            <h3 className="font-semibold text-sm text-[#26302D]">
              Ventas Realizadas
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#6B7A74] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar comprobante, cliente o RTN..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#F7F8F6] border border-[#E4E9E5] text-xs"
              />
            </div>
          </div>

          {/* Mobile Card List (< sm) */}
          <div className="sm:hidden divide-y divide-[#F2F5F3]">
            {filteredSales.map((sale) => (
              <div key={sale.id} className="p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#3D6B5E]">{sale.invoiceNumber}</span>
                  <span className="text-[#6B7A74]">
                    {new Date(sale.date).toLocaleString('es-HN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <div className="font-medium text-[#26302D]">
                  {sale.customerName}{' '}
                  {sale.customerRtn && sale.customerRtn !== 'C/F' && (
                    <span className="text-[11px] text-[#6B7A74]">• RTN: {sale.customerRtn}</span>
                  )}
                </div>
                <div className="text-[#5C6B66] line-clamp-2">
                  {sale.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-bold text-sm text-[#26302D]">
                    {formatLempira(sale.total)} ({sale.paymentMethod})
                  </span>
                  <button
                    onClick={() => onShowReceipt(sale)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#EEF5F2] text-[#2F574B] font-semibold cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ver Ticket
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Tablet/Desktop Table (>= sm) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#F7F8F6] text-[#6B7A74] text-xs border-b border-[#E4E9E5]">
                  <th className="py-3 px-4 font-medium">Comprobante</th>
                  <th className="py-3 px-4 font-medium">Fecha</th>
                  <th className="py-3 px-4 font-medium">Cliente / RTN / Pago</th>
                  <th className="py-3 px-4 font-medium">Artículos</th>
                  <th className="py-3 px-4 font-medium text-right">Total</th>
                  <th className="py-3 px-4 font-medium text-center">Ticket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F5F3]">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-[#F7F8F6]/60">
                    <td className="py-2.5 px-4 font-medium text-[#3D6B5E] whitespace-nowrap">
                      {sale.invoiceNumber}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-[#6B7A74] whitespace-nowrap">
                      {new Date(sale.date).toLocaleString('es-HN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-[#26302D]">{sale.customerName}</div>
                      <div className="text-[11px] text-[#6B7A74]">
                        RTN: {sale.customerRtn || 'C/F'} • {sale.paymentMethod}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-[#5C6B66] max-w-xs truncate">
                      {sale.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-[#26302D] whitespace-nowrap">
                      <div>{formatLempira(sale.total)}</div>
                      {sale.discount > 0 && (
                        <div className="text-[10px] text-[#3D6B5E] font-normal">
                          Desc. {sale.discountPercent ? `${sale.discountPercent}%` : ''} (-
                          {formatLempira(sale.discount)})
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => onShowReceipt(sale)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F2F5F3] hover:bg-[#E4E9E5] text-xs font-medium text-[#26302D] cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#3D6B5E]" />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
