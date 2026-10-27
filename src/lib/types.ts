export type UserRole = 'administrador' | 'operador';

export interface UserAccount {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
}

export type ItemType = 'producto_terminado' | 'insumo' | 'ambos';

export type ItemCategory =
  | 'Comidas y Sándwiches'
  | 'Bebidas e Hidratación'
  | 'Cafetería y Tés'
  | 'Snacks y Repostería'
  | 'Higiene y Uso Personal'
  | 'Insumos y Materias Primas'
  | 'Empaques y Descartables';

export type MeasurementUnit = 'unid' | 'g' | 'kg' | 'ml' | 'L' | 'paq';

export interface RecipeIngredient {
  insumoId: string;
  insumoName: string;
  quantity: number;
  unit: MeasurementUnit;
}

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  type: ItemType;
  category: ItemCategory;
  unit: MeasurementUnit;
  currentStock: number;
  minStock: number;
  unitCost: number;
  salePrice: number;
  trackDirectStock: boolean;
  recipe: RecipeIngredient[];
  active: boolean;
}

export type MovementType =
  | 'entrada_compra'
  | 'salida_merma'
  | 'salida_venta'
  | 'ajuste_auditoria';

export type MovementReason =
  | 'Compra a proveedor'
  | 'Reposición de stock'
  | 'Merma / Derrame'
  | 'Producto vencido'
  | 'Consumo interno'
  | 'Muestra / Cortesía'
  | 'Venta en caja'
  | 'Ajuste por conteo físico';

export interface InventoryMovement {
  id: string;
  date: string;
  itemId: string;
  itemName: string;
  itemUnit: MeasurementUnit;
  movementType: MovementType;
  reasonCategory: MovementReason;
  quantity: number;
  previousStock: number;
  newStock: number;
  unitCost: number;
  totalCost: number;
  supplierOrReference?: string;
  notes?: string;
  createdBy: string;
}

export interface SaleItemDetail {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  subtotal: number;
}

export type CustomerProfile =
  | 'Visitante / Familiar'
  | 'Personal Médico / Staff'
  | 'Paciente / Habitación'
  | 'Público General';

export type SalePaymentMethod =
  | 'Efectivo'
  | 'Tarjeta'
  | 'Transferencia'
  | 'Crédito';

export interface SaleTransaction {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerRtn: string;
  customerProfile?: CustomerProfile;
  documentType: 'Ticket' | 'Factura';
  paymentMethod: SalePaymentMethod;
  creditAccountId?: string;
  items: SaleItemDetail[];
  subtotal: number;
  discountPercent?: number;
  discount: number;
  total: number;
  estimatedCost: number;
  amountReceived: number;
  changeGiven: number;
  cashier: string;
  notes?: string;
}

export interface CreditChargeRecord {
  id: string;
  date: string;
  saleId?: string;
  invoiceNumber?: string;
  description: string;
  amount: number;
  createdBy: string;
}

export interface CreditPaymentRecord {
  id: string;
  date: string;
  amount: number;
  paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia';
  notes?: string;
  receivedBy: string;
}

export interface EmployeeCreditAccount {
  id: string;
  employeeName: string;
  department: string;
  employeeCodeOrPhone?: string;
  creditLimit?: number;
  totalCharged: number;
  totalPaid: number;
  balance: number;
  charges: CreditChargeRecord[];
  payments: CreditPaymentRecord[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseCategory =
  | 'Canon / Alquiler Espacio Hospitalario'
  | 'Servicios Básicos y Refrigeración'
  | 'Pago a Proveedores de Alimentos y Tienda'
  | 'Nómina y Turnos (Mañana/Tarde/Guardia)'
  | 'Mantenimiento y Cadena de Frío'
  | 'Bioseguridad, Limpieza y Sanitización'
  | 'Otros Gastos';

export interface OperatingExpense {
  id: string;
  date: string;
  concept: string;
  category: ExpenseCategory;
  expenseType: 'Fijo' | 'Variable';
  amount: number;
  paymentMethod: 'Efectivo (Caja)' | 'Transferencia Bancaria' | 'Tarjeta Corporativa';
  reference?: string;
  notes?: string;
}

export interface AuditItemComparison {
  itemId: string;
  itemName: string;
  unit: MeasurementUnit;
  systemStock: number;
  physicalStock: number;
  difference: number;
  unitCost: number;
  monetaryImpact: number;
}

export interface PhysicalAuditRecord {
  id: string;
  date: string;
  auditor: string;
  notes?: string;
  appliedAdjustment: boolean;
  totalDiscrepancyValue: number;
  items: AuditItemComparison[];
}

export interface CafeteriaDatabase {
  users: UserAccount[];
  inventory: InventoryItem[];
  movements: InventoryMovement[];
  sales: SaleTransaction[];
  expenses: OperatingExpense[];
  audits: PhysicalAuditRecord[];
  credits: EmployeeCreditAccount[];
}
