'use client';

import React from 'react';
import { Printer, X, CheckCircle2, HeartPulse } from 'lucide-react';
import { SaleTransaction } from '@/lib/types';
import { formatLempira } from '@/lib/currency';

interface ReceiptModalProps {
  sale: SaleTransaction | null;
  onClose: () => void;
}

export default function ReceiptModal({ sale, onClose }: ReceiptModalProps) {
  if (!sale) return null;

  const formattedDate = new Date(sale.date).toLocaleString('es-HN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26302D]/45 backdrop-blur-[2px] p-3 sm:p-4">
      <div className="bg-[#F7F8F6] border border-[#DCE2DD] rounded-2xl shadow-xl max-w-md w-full max-h-[90dvh] flex flex-col overflow-hidden">
        {/* Top bar (Always visible) */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#EDF1EE] border-b border-[#DCE2DD] shrink-0">
          <div className="flex items-center gap-2 text-[#3D6B5E] font-medium text-xs sm:text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Comprobante emitido</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#5C6B66] hover:text-[#26302D] hover:bg-[#DCE2DD]/60 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Printable area */}
        <div
          id="printable-receipt"
          className="p-4 sm:p-5 bg-white text-[#26302D] overflow-y-auto flex-1 min-h-0"
        >
          <div className="text-center border-b border-dashed border-[#CBD4CE] pb-3 mb-3">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#E8F0ED] text-[#3D6B5E] mb-1.5">
              <HeartPulse className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base tracking-tight">VITALIMARKET & CAFÉ</h3>
            <p className="text-[11px] text-[#5C6B66]">
              Tienda y Cafetería Hospitalaria
            </p>
            <div className="mt-1.5 inline-block px-2.5 py-0.5 rounded-full bg-[#E8F0ED] text-[#3D6B5E] text-[11px] font-semibold">
              {sale.documentType.toUpperCase()} N° {sale.invoiceNumber}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-1 text-xs mb-3 pb-2.5 border-b border-dashed border-[#CBD4CE]">
            <div className="text-[#5C6B66]">Fecha y Hora:</div>
            <div className="text-right font-medium">{formattedDate}</div>

            <div className="text-[#5C6B66]">Cliente:</div>
            <div className="text-right font-medium truncate pl-2">{sale.customerName}</div>

            <div className="text-[#5C6B66]">RTN:</div>
            <div className="text-right font-medium">{sale.customerRtn || 'C/F'}</div>

            <div className="text-[#5C6B66]">Pago:</div>
            <div className="text-right font-medium">{sale.paymentMethod}</div>

            <div className="text-[#5C6B66]">Atendió:</div>
            <div className="text-right font-medium truncate pl-2">{sale.cashier}</div>
          </div>

          <table className="w-full text-xs mb-3">
            <thead>
              <tr className="border-b border-[#DCE2DD] text-[#5C6B66]">
                <th className="py-1 text-left font-medium">Cant. / Artículo</th>
                <th className="py-1 text-right font-medium">P. Unit</th>
                <th className="py-1 text-right font-medium">Subt.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF1EE]">
              {sale.items.map((item, index) => (
                <tr key={index}>
                  <td className="py-1.5 pr-2">
                    <span className="font-semibold text-[#3D6B5E]">{item.quantity}x</span>{' '}
                    <span>{item.productName}</span>
                  </td>
                  <td className="py-1.5 text-right text-[#5C6B66] whitespace-nowrap">
                    {formatLempira(item.unitPrice)}
                  </td>
                  <td className="py-1.5 text-right font-medium whitespace-nowrap">
                    {formatLempira(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed border-[#CBD4CE] pt-2.5 space-y-1 text-xs">
            <div className="flex justify-between text-[#5C6B66]">
              <span>Subtotal:</span>
              <span>{formatLempira(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-[#3D6B5E]">
                <span>
                  Descuento{sale.discountPercent ? ` (${sale.discountPercent}%)` : ''}:
                </span>
                <span>-{formatLempira(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-[#26302D] pt-1 border-t border-[#DCE2DD]">
              <span>TOTAL PAGADO:</span>
              <span>{formatLempira(sale.total)}</span>
            </div>
            {sale.paymentMethod === 'Efectivo' && (
              <>
                <div className="flex justify-between text-[#5C6B66]">
                  <span>Recibido:</span>
                  <span>{formatLempira(sale.amountReceived)}</span>
                </div>
                <div className="flex justify-between font-semibold text-[#3D6B5E]">
                  <span>Cambio:</span>
                  <span>{formatLempira(sale.changeGiven)}</span>
                </div>
              </>
            )}
          </div>

          {sale.notes && (
            <div className="mt-2.5 p-2 rounded-lg bg-[#F7F8F6] text-[11px] text-[#5C6B66]">
              <strong>Nota:</strong> {sale.notes}
            </div>
          )}
        </div>

        {/* Footer buttons (Always visible at bottom) */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-[#EDF1EE] border-t border-[#DCE2DD] shrink-0">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#3D6B5E] text-white text-xs sm:text-sm font-medium hover:bg-[#2F574B] transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-[#CBD4CE] text-[#26302D] text-xs sm:text-sm font-medium hover:bg-[#F7F8F6] transition-colors cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
