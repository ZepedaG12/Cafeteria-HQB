import { NextResponse } from 'next/server';
import { getSessionUser, hashPassword } from '@/lib/auth';
import { getInitialSeedData, readDb, writeDb } from '@/lib/db';
import {
  AuditItemComparison,
  CafeteriaDatabase,
  InventoryItem,
  InventoryMovement,
  OperatingExpense,
  PhysicalAuditRecord,
  SaleTransaction,
  SessionUser,
  UserAccount,
  UserRole,
} from '@/lib/types';

function sanitizeDbForRole(db: CafeteriaDatabase, user: SessionUser) {
  if (user.role === 'administrador') {
    return {
      ...db,
      users: db.users.map((u) => ({
        ...u,
        passwordHash: '',
      })),
    };
  }

  // Operador: solo tiene acceso a Ventas e Inventario
  return {
    users: [],
    inventory: db.inventory,
    movements: db.movements,
    sales: db.sales,
    expenses: [],
    audits: [],
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const db = readDb();
  return NextResponse.json(sanitizeDbForRole(db, user));
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Sesión expirada. Inicia sesión nuevamente.' }, { status: 401 });
    }

    const body = await request.json();
    const { action, payload } = body;
    const db = readDb();
    const nowIso = new Date().toISOString();

    const adminOnlyActions = [
      'create_expense',
      'delete_expense',
      'create_audit',
      'save_user',
      'toggle_user',
      'reset_demo',
    ];

    if (adminOnlyActions.includes(action) && user.role !== 'administrador') {
      return NextResponse.json(
        { error: 'Permiso denegado. Esta acción requiere rol de Administrador.' },
        { status: 403 }
      );
    }

    if (action === 'save_item') {
      const itemData = payload as Partial<InventoryItem>;
      if (!itemData.name || !itemData.category || !itemData.unit || !itemData.type) {
        return NextResponse.json(
          { error: 'Faltan campos obligatorios del producto o insumo.' },
          { status: 400 }
        );
      }

      if (itemData.id) {
        const idx = db.inventory.findIndex((i) => i.id === itemData.id);
        if (idx === -1) {
          return NextResponse.json({ error: 'Ítem no encontrado.' }, { status: 404 });
        }
        db.inventory[idx] = {
          ...db.inventory[idx],
          ...itemData,
          currentStock: Number(itemData.currentStock ?? db.inventory[idx].currentStock),
          minStock: Number(itemData.minStock ?? db.inventory[idx].minStock),
          unitCost: Number(itemData.unitCost ?? db.inventory[idx].unitCost),
          salePrice: Number(itemData.salePrice ?? db.inventory[idx].salePrice),
          recipe: itemData.recipe ?? db.inventory[idx].recipe ?? [],
        };
      } else {
        const prefix = itemData.type === 'insumo' ? 'INS' : 'PROD';
        const nextNum = String(db.inventory.length + 1).padStart(3, '0');
        const newItem: InventoryItem = {
          id: `item-${Date.now()}`,
          code: itemData.code?.trim() || `${prefix}-${nextNum}`,
          name: itemData.name.trim(),
          type: itemData.type,
          category: itemData.category,
          unit: itemData.unit,
          currentStock: Number(itemData.currentStock ?? 0),
          minStock: Number(itemData.minStock ?? 0),
          unitCost: Number(itemData.unitCost ?? 0),
          salePrice: Number(itemData.salePrice ?? 0),
          trackDirectStock: Boolean(itemData.trackDirectStock ?? true),
          recipe: itemData.recipe ?? [],
          active: true,
        };
        db.inventory.push(newItem);
      }

      writeDb(db);
      return NextResponse.json({ ok: true, db: sanitizeDbForRole(db, user) });
    }

    if (action === 'register_movement') {
      const {
        itemId,
        movementType,
        reasonCategory,
        quantity,
        unitCost,
        supplierOrReference,
        notes,
      } = payload;

      const idx = db.inventory.findIndex((i) => i.id === itemId);
      if (idx === -1) {
        return NextResponse.json({ error: 'Producto o insumo no encontrado.' }, { status: 404 });
      }

      const qty = Math.abs(Number(quantity));
      if (!qty || qty <= 0) {
        return NextResponse.json({ error: 'La cantidad debe ser mayor a 0.' }, { status: 400 });
      }

      const item = db.inventory[idx];
      const previousStock = item.currentStock;
      const isEntry = movementType === 'entrada_compra';
      const signedQuantity = isEntry ? qty : -qty;
      const newStock = Math.max(0, Number((previousStock + signedQuantity).toFixed(2)));
      const effectiveUnitCost =
        unitCost !== undefined && Number(unitCost) > 0 ? Number(unitCost) : item.unitCost;

      item.currentStock = newStock;
      if (isEntry && effectiveUnitCost > 0) {
        item.unitCost = effectiveUnitCost;
      }

      const movement: InventoryMovement = {
        id: `mov-${Date.now()}`,
        date: nowIso,
        itemId: item.id,
        itemName: item.name,
        itemUnit: item.unit,
        movementType,
        reasonCategory,
        quantity: signedQuantity,
        previousStock,
        newStock,
        unitCost: effectiveUnitCost,
        totalCost: Number((qty * effectiveUnitCost).toFixed(2)),
        supplierOrReference: supplierOrReference?.trim() || '',
        notes: notes?.trim() || '',
        createdBy: user.fullName,
      };

      db.movements.unshift(movement);
      writeDb(db);
      return NextResponse.json({ ok: true, db: sanitizeDbForRole(db, user), movement });
    }

    if (action === 'create_sale') {
      const {
        customerName,
        customerRtn,
        customerProfile,
        documentType,
        paymentMethod,
        items,
        discountPercent = 0,
        amountReceived,
        notes,
      } = payload;

      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { error: 'La venta debe incluir al menos un producto.' },
          { status: 400 }
        );
      }

      const prefix = documentType === 'Factura' ? 'FAC' : 'TIC';
      const correlative = String(db.sales.length + 1).padStart(4, '0');
      const invoiceNumber = `${prefix}-2026-${correlative}`;

      let subtotal = 0;
      let estimatedCost = 0;

      const processedItems = items.map(
        (cartItem: { productId: string; quantity: number }) => {
          const prodIdx = db.inventory.findIndex((i) => i.id === cartItem.productId);
          if (prodIdx === -1) {
            throw new Error(`Producto no encontrado: ${cartItem.productId}`);
          }
          const product = db.inventory[prodIdx];
          const qty = Number(cartItem.quantity);
          const lineSubtotal = Number((qty * product.salePrice).toFixed(2));
          const lineCost = Number((qty * product.unitCost).toFixed(2));

          subtotal += lineSubtotal;
          estimatedCost += lineCost;

          if (product.trackDirectStock) {
            const prev = product.currentStock;
            const next = Math.max(0, Number((prev - qty).toFixed(2)));
            product.currentStock = next;

            db.movements.unshift({
              id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              date: nowIso,
              itemId: product.id,
              itemName: product.name,
              itemUnit: product.unit,
              movementType: 'salida_venta',
              reasonCategory: 'Venta en caja',
              quantity: -qty,
              previousStock: prev,
              newStock: next,
              unitCost: product.unitCost,
              totalCost: lineCost,
              supplierOrReference: invoiceNumber,
              notes: `Venta (${qty}x ${product.name})`,
              createdBy: user.fullName,
            });
          }

          if (Array.isArray(product.recipe) && product.recipe.length > 0) {
            for (const ing of product.recipe) {
              const insIdx = db.inventory.findIndex((i) => i.id === ing.insumoId);
              if (insIdx !== -1) {
                const insumo = db.inventory[insIdx];
                const totalIngQty = Number((ing.quantity * qty).toFixed(2));
                const prevIns = insumo.currentStock;
                const nextIns = Math.max(0, Number((prevIns - totalIngQty).toFixed(2)));
                insumo.currentStock = nextIns;

                db.movements.unshift({
                  id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  date: nowIso,
                  itemId: insumo.id,
                  itemName: insumo.name,
                  itemUnit: insumo.unit,
                  movementType: 'salida_venta',
                  reasonCategory: 'Venta en caja',
                  quantity: -totalIngQty,
                  previousStock: prevIns,
                  newStock: nextIns,
                  unitCost: insumo.unitCost,
                  totalCost: Number((totalIngQty * insumo.unitCost).toFixed(2)),
                  supplierOrReference: invoiceNumber,
                  notes: `Insumo utilizado en ${qty}x ${product.name}`,
                  createdBy: user.fullName,
                });
              }
            }
          }

          return {
            productId: product.id,
            productName: product.name,
            quantity: qty,
            unitPrice: product.salePrice,
            unitCost: product.unitCost,
            subtotal: lineSubtotal,
          };
        }
      );

      subtotal = Number(subtotal.toFixed(2));
      const cleanDiscountPercent = Math.min(100, Math.max(0, Number(discountPercent) || 0));
      const cleanDiscount = Number(((subtotal * cleanDiscountPercent) / 100).toFixed(2));
      const total = Number(Math.max(0, subtotal - cleanDiscount).toFixed(2));
      const cleanReceived =
        paymentMethod === 'Efectivo' && Number(amountReceived) >= total
          ? Number(amountReceived)
          : total;
      const changeGiven = Number(Math.max(0, cleanReceived - total).toFixed(2));

      const newSale: SaleTransaction = {
        id: `sale-${Date.now()}`,
        invoiceNumber,
        date: nowIso,
        customerName: customerName?.trim() || 'Consumidor Final',
        customerRtn: customerRtn?.trim() || 'C/F',
        customerProfile: customerProfile || 'Visitante / Familiar',
        documentType: documentType || 'Ticket',
        paymentMethod: paymentMethod || 'Efectivo',
        items: processedItems,
        subtotal,
        discountPercent: cleanDiscountPercent,
        discount: cleanDiscount,
        total,
        estimatedCost: Number(estimatedCost.toFixed(2)),
        amountReceived: cleanReceived,
        changeGiven,
        cashier: user.fullName,
        notes: notes?.trim() || '',
      };

      db.sales.unshift(newSale);
      writeDb(db);
      return NextResponse.json({ ok: true, db: sanitizeDbForRole(db, user), sale: newSale });
    }

    if (action === 'create_expense') {
      const { concept, category, expenseType, amount, paymentMethod, reference, notes, date } =
        payload;
      if (!concept || !amount || Number(amount) <= 0) {
        return NextResponse.json(
          { error: 'Ingresa un concepto válido y un monto mayor a 0.' },
          { status: 400 }
        );
      }

      const newExpense: OperatingExpense = {
        id: `exp-${Date.now()}`,
        date: date ? new Date(date).toISOString() : nowIso,
        concept: concept.trim(),
        category: category || 'Otros Gastos',
        expenseType: expenseType || 'Variable',
        amount: Number(Number(amount).toFixed(2)),
        paymentMethod: paymentMethod || 'Efectivo (Caja)',
        reference: reference?.trim() || '',
        notes: notes?.trim() || '',
      };

      db.expenses.unshift(newExpense);
      writeDb(db);
      return NextResponse.json({ ok: true, db: sanitizeDbForRole(db, user), expense: newExpense });
    }

    if (action === 'delete_expense') {
      const { id } = payload;
      db.expenses = db.expenses.filter((e) => e.id !== id);
      writeDb(db);
      return NextResponse.json({ ok: true, db: sanitizeDbForRole(db, user) });
    }

    if (action === 'create_audit') {
      const { notes, applyAdjustment, counts } = payload as {
        notes?: string;
        applyAdjustment: boolean;
        counts: Array<{ itemId: string; physicalStock: number }>;
      };

      const comparisons: AuditItemComparison[] = [];
      let totalDiscrepancyValue = 0;

      for (const entry of counts) {
        const idx = db.inventory.findIndex((i) => i.id === entry.itemId);
        if (idx === -1) continue;
        const item = db.inventory[idx];
        const systemStock = Number(item.currentStock);
        const physicalStock = Number(entry.physicalStock);
        const difference = Number((physicalStock - systemStock).toFixed(2));
        const monetaryImpact = Number((difference * item.unitCost).toFixed(2));

        totalDiscrepancyValue += monetaryImpact;

        comparisons.push({
          itemId: item.id,
          itemName: item.name,
          unit: item.unit,
          systemStock,
          physicalStock,
          difference,
          unitCost: item.unitCost,
          monetaryImpact,
        });

        if (applyAdjustment && difference !== 0) {
          item.currentStock = physicalStock;
          db.movements.unshift({
            id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            date: nowIso,
            itemId: item.id,
            itemName: item.name,
            itemUnit: item.unit,
            movementType: 'ajuste_auditoria',
            reasonCategory: 'Ajuste por conteo físico',
            quantity: difference,
            previousStock: systemStock,
            newStock: physicalStock,
            unitCost: item.unitCost,
            totalCost: Math.abs(monetaryImpact),
            supplierOrReference: 'Auditoría Física',
            notes:
              notes?.trim() ||
              `Ajuste por descuadre (${difference > 0 ? '+' : ''}${difference} ${item.unit})`,
            createdBy: user.fullName,
          });
        }
      }

      const auditRecord: PhysicalAuditRecord = {
        id: `aud-${Date.now()}`,
        date: nowIso,
        auditor: user.fullName,
        notes: notes?.trim() || '',
        appliedAdjustment: Boolean(applyAdjustment),
        totalDiscrepancyValue: Number(totalDiscrepancyValue.toFixed(2)),
        items: comparisons,
      };

      db.audits.unshift(auditRecord);
      writeDb(db);
      return NextResponse.json({ ok: true, db: sanitizeDbForRole(db, user), audit: auditRecord });
    }

    if (action === 'save_user') {
      const { id, username, fullName, password, role } = payload as {
        id?: string;
        username: string;
        fullName: string;
        password?: string;
        role: UserRole;
      };

      const cleanUsername = String(username || '').trim().toLowerCase();
      const cleanName = String(fullName || '').trim();
      if (!cleanUsername || !cleanName || (role !== 'administrador' && role !== 'operador')) {
        return NextResponse.json(
          { error: 'Completa el nombre, usuario y rol válido.' },
          { status: 400 }
        );
      }

      const duplicate = db.users.find(
        (u) => u.username.toLowerCase() === cleanUsername && u.id !== id
      );
      if (duplicate) {
        return NextResponse.json(
          { error: 'Ese nombre de usuario ya está registrado.' },
          { status: 400 }
        );
      }

      if (id) {
        const idx = db.users.findIndex((u) => u.id === id);
        if (idx === -1) {
          return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
        }
        db.users[idx] = {
          ...db.users[idx],
          username: cleanUsername,
          fullName: cleanName,
          role,
          passwordHash: password?.trim()
            ? hashPassword(password.trim())
            : db.users[idx].passwordHash,
        };
      } else {
        if (!password?.trim()) {
          return NextResponse.json(
            { error: 'Ingresa una contraseña para el nuevo usuario.' },
            { status: 400 }
          );
        }
        const newUser: UserAccount = {
          id: `usr-${Date.now()}`,
          username: cleanUsername,
          passwordHash: hashPassword(password.trim()),
          fullName: cleanName,
          role,
          active: true,
          createdAt: nowIso,
        };
        db.users.push(newUser);
      }

      writeDb(db);
      return NextResponse.json({ ok: true, db: sanitizeDbForRole(db, user) });
    }

    if (action === 'toggle_user') {
      const { id } = payload as { id: string };
      if (id === user.id) {
        return NextResponse.json(
          { error: 'No puedes desactivar tu propio usuario activo.' },
          { status: 400 }
        );
      }
      const idx = db.users.findIndex((u) => u.id === id);
      if (idx !== -1) {
        db.users[idx].active = !db.users[idx].active;
        writeDb(db);
      }
      return NextResponse.json({ ok: true, db: sanitizeDbForRole(db, user) });
    }

    if (action === 'reset_demo') {
      const seed = getInitialSeedData();
      // Preserve existing users so nobody gets locked out
      seed.users = db.users;
      writeDb(seed);
      return NextResponse.json({ ok: true, db: sanitizeDbForRole(seed, user) });
    }

    return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
