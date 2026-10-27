import fs from 'fs';
import os from 'os';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import { hashPassword } from './auth';
import { CafeteriaDatabase, EmployeeCreditAccount, UserAccount } from './types';

const IS_SERVERLESS = Boolean(
  process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY
);

const DATA_DIR = IS_SERVERLESS
  ? path.join(os.tmpdir(), 'camilas-coffee-data')
  : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'cafeteria-hospital-db.json');

let memoryFallbackDb: CafeteriaDatabase | null = null;
let neonTableInitialized = false;

export function getDatabaseUrl(): string | null {
  const direct =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.STORAGE_DATABASE_URL ||
    process.env.STORAGE_POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    '';
  if (direct.trim()) return direct.trim();

  // Detectar prefijos personalizados de Vercel Storage / Neon Marketplace (ej. CAFE_DATABASE_URL)
  for (const [key, val] of Object.entries(process.env)) {
    if (
      val &&
      (key.endsWith('_DATABASE_URL') || key.endsWith('_POSTGRES_URL') || key.endsWith('_URL')) &&
      /^postgres(ql)?:\/\//i.test(val.trim())
    ) {
      return val.trim();
    }
  }

  return null;
}

export function getStorageMode(): 'neon_postgres' | 'local_file' | 'serverless_tmp' {
  if (getDatabaseUrl()) return 'neon_postgres';
  if (IS_SERVERLESS) return 'serverless_tmp';
  return 'local_file';
}

export function getDefaultUsers(): UserAccount[] {
  return [
    {
      id: 'usr-admin-01',
      username: 'admin',
      passwordHash: hashPassword('admin123'),
      fullName: 'Administrador General',
      role: 'administrador',
      active: true,
      createdAt: '2026-10-20T07:00:00.000Z',
    },
    {
      id: 'usr-oper-01',
      username: 'operador',
      passwordHash: hashPassword('caja123'),
      fullName: 'Laura (Operadora de Caja)',
      role: 'operador',
      active: true,
      createdAt: '2026-10-20T07:05:00.000Z',
    },
  ];
}

export function getDefaultCredits(): EmployeeCreditAccount[] {
  return [
    {
      id: 'cred-emp-001',
      employeeName: 'Dra. Sofía Méndez',
      department: 'Emergencias',
      employeeCodeOrPhone: '9988-1122',
      creditLimit: 1500,
      totalCharged: 363.0,
      totalPaid: 150.0,
      balance: 213.0,
      charges: [
        {
          id: 'chg-001',
          date: '2026-10-23T08:15:00.000Z',
          saleId: 'sale-005',
          invoiceNumber: 'TIC-2026-0005',
          description: '2x Café con Leche Deslactosada 12oz, 2x Sándwich Club de Pavo, 1x Barra Nutritiva',
          amount: 363.0,
          createdBy: 'Laura (Operadora de Caja)',
        },
      ],
      payments: [
        {
          id: 'pay-001',
          date: '2026-10-25T14:20:00.000Z',
          amount: 150.0,
          paymentMethod: 'Efectivo',
          notes: 'Primer abono quincenal en caja',
          receivedBy: 'Laura (Operadora de Caja)',
        },
      ],
      active: true,
      createdAt: '2026-10-23T08:15:00.000Z',
      updatedAt: '2026-10-25T14:20:00.000Z',
    },
    {
      id: 'cred-emp-002',
      employeeName: 'Lic. Roberto Pineda',
      department: 'Enfermería Piso 2',
      employeeCodeOrPhone: '9845-3344',
      creditLimit: 1000,
      totalCharged: 196.0,
      totalPaid: 196.0,
      balance: 0,
      charges: [
        {
          id: 'chg-002',
          date: '2026-10-22T19:00:00.000Z',
          description: '2x Panini Caliente de Jamón de Pavo y Mozzarella',
          amount: 196.0,
          createdBy: 'Laura (Operadora de Caja)',
        },
      ],
      payments: [
        {
          id: 'pay-002',
          date: '2026-10-24T12:10:00.000Z',
          amount: 196.0,
          paymentMethod: 'Transferencia',
          notes: 'Cancelación total por transferencia',
          receivedBy: 'Administrador General',
        },
      ],
      active: true,
      createdAt: '2026-10-22T19:00:00.000Z',
      updatedAt: '2026-10-24T12:10:00.000Z',
    },
  ];
}

export function getInitialSeedData(): CafeteriaDatabase {
  return {
    users: getDefaultUsers(),
    credits: getDefaultCredits(),
    inventory: [
      // INSUMOS Y EMPAQUES DE BARRA / COCINA (EN LEMPIRAS - HNL)
      {
        id: 'ins-001',
        code: 'INS-001',
        name: 'Café Molido Especialidad Hondureño (Barra Hospitalaria)',
        type: 'insumo',
        category: 'Insumos y Materias Primas',
        unit: 'g',
        currentStock: 3850,
        minStock: 1000,
        unitCost: 0.55,
        salePrice: 0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },
      {
        id: 'ins-002',
        code: 'INS-002',
        name: 'Leche Deslactosada Pasteurizada',
        type: 'insumo',
        category: 'Insumos y Materias Primas',
        unit: 'ml',
        currentStock: 7800,
        minStock: 2000,
        unitCost: 0.038,
        salePrice: 0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },
      {
        id: 'ins-003',
        code: 'INS-003',
        name: 'Vaso Térmico Biodegradable 12oz con Tapa Antiderrame',
        type: 'insumo',
        category: 'Empaques y Descartables',
        unit: 'unid',
        currentStock: 140,
        minStock: 40,
        unitCost: 4.0,
        salePrice: 0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },
      {
        id: 'ins-004',
        code: 'INS-004',
        name: 'Sobres de Té de Manzanilla / Tilo Relajante',
        type: 'insumo',
        category: 'Insumos y Materias Primas',
        unit: 'unid',
        currentStock: 38,
        minStock: 45,
        unitCost: 3.8,
        salePrice: 0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },

      // COMIDAS PREPARADAS Y SÁNDWICHES
      {
        id: 'prod-001',
        code: 'COM-001',
        name: 'Sándwich Club de Pavo, Queso y Pan Integral',
        type: 'producto_terminado',
        category: 'Comidas y Sándwiches',
        unit: 'unid',
        currentStock: 16,
        minStock: 6,
        unitCost: 42.0,
        salePrice: 95.0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },
      {
        id: 'prod-002',
        code: 'COM-002',
        name: 'Sopa / Caldo de Pollo Reconfortante con Verduras (16oz)',
        type: 'producto_terminado',
        category: 'Comidas y Sándwiches',
        unit: 'unid',
        currentStock: 11,
        minStock: 5,
        unitCost: 44.0,
        salePrice: 105.0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },
      {
        id: 'prod-003',
        code: 'COM-003',
        name: 'Ensalada Fresca con Pechuga de Pollo Grillada (Bowl)',
        type: 'producto_terminado',
        category: 'Comidas y Sándwiches',
        unit: 'unid',
        currentStock: 8,
        minStock: 4,
        unitCost: 52.0,
        salePrice: 120.0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },
      {
        id: 'prod-004',
        code: 'COM-004',
        name: 'Panini Caliente de Jamón de Pavo y Mozzarella',
        type: 'producto_terminado',
        category: 'Comidas y Sándwiches',
        unit: 'unid',
        currentStock: 4,
        minStock: 6,
        unitCost: 45.0,
        salePrice: 98.0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },

      // BEBIDAS EMBOTELLADAS E HIDRATACIÓN
      {
        id: 'prod-005',
        code: 'BEB-001',
        name: 'Agua Pura Embotellada Sin Gas 600ml',
        type: 'producto_terminado',
        category: 'Bebidas e Hidratación',
        unit: 'unid',
        currentStock: 58,
        minStock: 20,
        unitCost: 9.0,
        salePrice: 25.0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },
      {
        id: 'prod-006',
        code: 'BEB-002',
        name: 'Suero Rehidratante Oral Electrolitos (500ml)',
        type: 'producto_terminado',
        category: 'Bebidas e Hidratación',
        unit: 'unid',
        currentStock: 26,
        minStock: 10,
        unitCost: 32.0,
        salePrice: 65.0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },
      {
        id: 'prod-007',
        code: 'BEB-003',
        name: 'Néctar / Jugo Natural de Manzana 400ml',
        type: 'producto_terminado',
        category: 'Bebidas e Hidratación',
        unit: 'unid',
        currentStock: 19,
        minStock: 8,
        unitCost: 21.0,
        salePrice: 45.0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },

      // CAFETERÍA Y TÉS CALIENTES
      {
        id: 'prod-008',
        code: 'CAF-001',
        name: 'Café con Leche Deslactosada 12oz',
        type: 'producto_terminado',
        category: 'Cafetería y Tés',
        unit: 'unid',
        currentStock: 999,
        minStock: 0,
        unitCost: 21.5,
        salePrice: 68.0,
        trackDirectStock: false,
        recipe: [
          {
            insumoId: 'ins-001',
            insumoName: 'Café Molido Especialidad Hondureño (Barra Hospitalaria)',
            quantity: 18,
            unit: 'g',
          },
          {
            insumoId: 'ins-002',
            insumoName: 'Leche Deslactosada Pasteurizada',
            quantity: 200,
            unit: 'ml',
          },
          {
            insumoId: 'ins-003',
            insumoName: 'Vaso Térmico Biodegradable 12oz con Tapa Antiderrame',
            quantity: 1,
            unit: 'unid',
          },
        ],
        active: true,
      },
      {
        id: 'prod-009',
        code: 'CAF-002',
        name: 'Café Americano Doble (Especial Guardia Médica) 12oz',
        type: 'producto_terminado',
        category: 'Cafetería y Tés',
        unit: 'unid',
        currentStock: 999,
        minStock: 0,
        unitCost: 13.9,
        salePrice: 55.0,
        trackDirectStock: false,
        recipe: [
          {
            insumoId: 'ins-001',
            insumoName: 'Café Molido Especialidad Hondureño (Barra Hospitalaria)',
            quantity: 18,
            unit: 'g',
          },
          {
            insumoId: 'ins-003',
            insumoName: 'Vaso Térmico Biodegradable 12oz con Tapa Antiderrame',
            quantity: 1,
            unit: 'unid',
          },
        ],
        active: true,
      },
      {
        id: 'prod-010',
        code: 'CAF-003',
        name: 'Infusión Caliente de Manzanilla / Tilo 12oz',
        type: 'producto_terminado',
        category: 'Cafetería y Tés',
        unit: 'unid',
        currentStock: 999,
        minStock: 0,
        unitCost: 7.8,
        salePrice: 45.0,
        trackDirectStock: false,
        recipe: [
          {
            insumoId: 'ins-004',
            insumoName: 'Sobres de Té de Manzanilla / Tilo Relajante',
            quantity: 1,
            unit: 'unid',
          },
          {
            insumoId: 'ins-003',
            insumoName: 'Vaso Térmico Biodegradable 12oz con Tapa Antiderrame',
            quantity: 1,
            unit: 'unid',
          },
        ],
        active: true,
      },

      // SNACKS Y REPOSTERÍA SUAVE
      {
        id: 'prod-011',
        code: 'SNK-001',
        name: 'Copa de Gelatina Ligera con Yogurt Natural',
        type: 'producto_terminado',
        category: 'Snacks y Repostería',
        unit: 'unid',
        currentStock: 14,
        minStock: 5,
        unitCost: 18.0,
        salePrice: 42.0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },
      {
        id: 'prod-012',
        code: 'SNK-002',
        name: 'Barra Nutritiva de Avena, Miel y Almendras',
        type: 'producto_terminado',
        category: 'Snacks y Repostería',
        unit: 'unid',
        currentStock: 24,
        minStock: 8,
        unitCost: 16.0,
        salePrice: 38.0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },
      {
        id: 'prod-013',
        code: 'SNK-003',
        name: 'Paquete de Galletas Integrales de Soda / Avena',
        type: 'producto_terminado',
        category: 'Snacks y Repostería',
        unit: 'unid',
        currentStock: 28,
        minStock: 10,
        unitCost: 12.0,
        salePrice: 30.0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },

      // HIGIENE PERSONAL Y ARTÍCULOS DE CONVENIENCIA HOSPITALARIA
      {
        id: 'prod-014',
        code: 'HIG-001',
        name: 'Kit Dental de Emergencia (Cepillo + Pasta + Estuche)',
        type: 'producto_terminado',
        category: 'Higiene y Uso Personal',
        unit: 'unid',
        currentStock: 15,
        minStock: 5,
        unitCost: 30.0,
        salePrice: 75.0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },
      {
        id: 'prod-015',
        code: 'HIG-002',
        name: 'Paquete de Toallitas Húmedas Hipoalergénicas (50 uds)',
        type: 'producto_terminado',
        category: 'Higiene y Uso Personal',
        unit: 'unid',
        currentStock: 18,
        minStock: 6,
        unitCost: 28.0,
        salePrice: 60.0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },
      {
        id: 'prod-016',
        code: 'HIG-003',
        name: 'Mascarilla KN95 Sellada Individual',
        type: 'producto_terminado',
        category: 'Higiene y Uso Personal',
        unit: 'unid',
        currentStock: 42,
        minStock: 15,
        unitCost: 9.0,
        salePrice: 30.0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },
      {
        id: 'prod-017',
        code: 'HIG-004',
        name: 'Alcohol en Gel Antibacterial de Bolsillo 60ml',
        type: 'producto_terminado',
        category: 'Higiene y Uso Personal',
        unit: 'unid',
        currentStock: 4,
        minStock: 8,
        unitCost: 16.0,
        salePrice: 40.0,
        trackDirectStock: true,
        recipe: [],
        active: true,
      },
    ],
    movements: [
      {
        id: 'mov-001',
        date: '2026-10-20T07:30:00.000Z',
        itemId: 'prod-005',
        itemName: 'Agua Pura Embotellada Sin Gas 600ml',
        itemUnit: 'unid',
        movementType: 'entrada_compra',
        reasonCategory: 'Compra a proveedor',
        quantity: 72,
        previousStock: 8,
        newStock: 80,
        unitCost: 9.0,
        totalCost: 648.0,
        supplierOrReference: 'Distribuidora Manantial - Fact. #4410',
        notes: '3 fardos de 24 botellas de agua 600ml',
        createdBy: 'Administración',
      },
      {
        id: 'mov-002',
        date: '2026-10-20T08:15:00.000Z',
        itemId: 'prod-001',
        itemName: 'Sándwich Club de Pavo, Queso y Pan Integral',
        itemUnit: 'unid',
        movementType: 'entrada_compra',
        reasonCategory: 'Compra a proveedor',
        quantity: 24,
        previousStock: 0,
        newStock: 24,
        unitCost: 42.0,
        totalCost: 1008.0,
        supplierOrReference: 'Cocina Central & Catering - Guía #109',
        notes: 'Lote fresco sellado con etiqueta de fecha en vitrina fría',
        createdBy: 'Turno Mañana',
      },
      {
        id: 'mov-003',
        date: '2026-10-21T09:00:00.000Z',
        itemId: 'prod-014',
        itemName: 'Kit Dental de Emergencia (Cepillo + Pasta + Estuche)',
        itemUnit: 'unid',
        movementType: 'entrada_compra',
        reasonCategory: 'Compra a proveedor',
        quantity: 20,
        previousStock: 2,
        newStock: 22,
        unitCost: 30.0,
        totalCost: 600.0,
        supplierOrReference: 'Suministros Médicos & Cuidado Personal S.A.',
        notes: 'Reposición de kits de aseo para familiares de hospitalización',
        createdBy: 'Administración',
      },
      {
        id: 'mov-004',
        date: '2026-10-21T18:30:00.000Z',
        itemId: 'prod-001',
        itemName: 'Sándwich Club de Pavo, Queso y Pan Integral',
        itemUnit: 'unid',
        movementType: 'salida_merma',
        reasonCategory: 'Producto vencido',
        quantity: -2,
        previousStock: 18,
        newStock: 16,
        unitCost: 42.0,
        totalCost: 84.0,
        supplierOrReference: 'Control Inocuidad #12',
        notes: 'Retirados de vitrina refrigerada al cumplir 36h (norma sanitaria hospitalaria)',
        createdBy: 'Encargado Turno Tarde',
      },
      {
        id: 'mov-005',
        date: '2026-10-22T06:45:00.000Z',
        itemId: 'prod-011',
        itemName: 'Copa de Gelatina Ligera con Yogurt Natural',
        itemUnit: 'unid',
        movementType: 'salida_merma',
        reasonCategory: 'Merma / Derrame',
        quantity: -1,
        previousStock: 15,
        newStock: 14,
        unitCost: 18.0,
        totalCost: 18.0,
        supplierOrReference: 'Baja interna #14',
        notes: 'Envase con sello abierto al acomodar cámara fría',
        createdBy: 'Turno Mañana',
      },
    ],
    sales: [
      {
        id: 'sale-001',
        invoiceNumber: 'TIC-2026-0001',
        date: '2026-10-21T07:45:00.000Z',
        customerName: 'Dr. Alejandro Morales (Residente)',
        customerRtn: 'C/F',
        customerProfile: 'Personal Médico / Staff',
        documentType: 'Ticket',
        paymentMethod: 'Tarjeta',
        items: [
          {
            productId: 'prod-009',
            productName: 'Café Americano Doble (Especial Guardia Médica) 12oz',
            quantity: 4,
            unitPrice: 55.0,
            unitCost: 13.9,
            subtotal: 220.0,
          },
          {
            productId: 'prod-001',
            productName: 'Sándwich Club de Pavo, Queso y Pan Integral',
            quantity: 4,
            unitPrice: 95.0,
            unitCost: 42.0,
            subtotal: 380.0,
          },
          {
            productId: 'prod-012',
            productName: 'Barra Nutritiva de Avena, Miel y Almendras',
            quantity: 4,
            unitPrice: 38.0,
            unitCost: 16.0,
            subtotal: 152.0,
          },
        ],
        subtotal: 752.0,
        discountPercent: 0,
        discount: 0,
        total: 752.0,
        estimatedCost: 287.6,
        amountReceived: 752.0,
        changeGiven: 0,
        cashier: 'Laura (Turno Mañana)',
        notes: 'Desayuno cambio de guardia Emergencias',
      },
      {
        id: 'sale-002',
        invoiceNumber: 'FAC-2026-0002',
        date: '2026-10-21T13:20:00.000Z',
        customerName: 'Familia Salazar (Habitación 304)',
        customerRtn: '0801-1985-049123',
        customerProfile: 'Visitante / Familiar',
        documentType: 'Factura',
        paymentMethod: 'Efectivo',
        items: [
          {
            productId: 'prod-002',
            productName: 'Sopa / Caldo de Pollo Reconfortante con Verduras (16oz)',
            quantity: 4,
            unitPrice: 105.0,
            unitCost: 44.0,
            subtotal: 420.0,
          },
          {
            productId: 'prod-006',
            productName: 'Suero Rehidratante Oral Electrolitos (500ml)',
            quantity: 5,
            unitPrice: 65.0,
            unitCost: 32.0,
            subtotal: 325.0,
          },
          {
            productId: 'prod-014',
            productName: 'Kit Dental de Emergencia (Cepillo + Pasta + Estuche)',
            quantity: 4,
            unitPrice: 75.0,
            unitCost: 30.0,
            subtotal: 300.0,
          },
          {
            productId: 'prod-015',
            productName: 'Paquete de Toallitas Húmedas Hipoalergénicas (50 uds)',
            quantity: 3,
            unitPrice: 60.0,
            unitCost: 28.0,
            subtotal: 180.0,
          },
        ],
        subtotal: 1225.0,
        discountPercent: 0,
        discount: 0,
        total: 1225.0,
        estimatedCost: 540.0,
        amountReceived: 1300.0,
        changeGiven: 75.0,
        cashier: 'Laura (Turno Mañana)',
        notes: 'Almuerzo y artículos de cuidado personal para acompañantes en piso 3',
      },
      {
        id: 'sale-003',
        invoiceNumber: 'TIC-2026-0003',
        date: '2026-10-22T11:10:00.000Z',
        customerName: 'Estación de Enfermería Pediatría',
        customerRtn: 'C/F',
        customerProfile: 'Personal Médico / Staff',
        documentType: 'Ticket',
        paymentMethod: 'Transferencia',
        items: [
          {
            productId: 'prod-008',
            productName: 'Café con Leche Deslactosada 12oz',
            quantity: 8,
            unitPrice: 68.0,
            unitCost: 21.5,
            subtotal: 544.0,
          },
          {
            productId: 'prod-003',
            productName: 'Ensalada Fresca con Pechuga de Pollo Grillada (Bowl)',
            quantity: 6,
            unitPrice: 120.0,
            unitCost: 52.0,
            subtotal: 720.0,
          },
          {
            productId: 'prod-005',
            productName: 'Agua Pura Embotellada Sin Gas 600ml',
            quantity: 12,
            unitPrice: 25.0,
            unitCost: 9.0,
            subtotal: 300.0,
          },
        ],
        subtotal: 1564.0,
        discountPercent: 10,
        discount: 156.4,
        total: 1407.6,
        estimatedCost: 592.0,
        amountReceived: 1407.6,
        changeGiven: 0,
        cashier: 'Carlos (Turno Tarde)',
        notes: 'Pedido grupal personal de enfermería piso 2 (10% desc. staff)',
      },
      {
        id: 'sale-004',
        invoiceNumber: 'TIC-2026-0004',
        date: '2026-10-22T19:40:00.000Z',
        customerName: 'Visitantes Sala de Espera / Guardia',
        customerRtn: 'C/F',
        customerProfile: 'Visitante / Familiar',
        documentType: 'Ticket',
        paymentMethod: 'Efectivo',
        items: [
          {
            productId: 'prod-010',
            productName: 'Infusión Caliente de Manzanilla / Tilo 12oz',
            quantity: 6,
            unitPrice: 45.0,
            unitCost: 7.8,
            subtotal: 270.0,
          },
          {
            productId: 'prod-004',
            productName: 'Panini Caliente de Jamón de Pavo y Mozzarella',
            quantity: 5,
            unitPrice: 98.0,
            unitCost: 45.0,
            subtotal: 490.0,
          },
          {
            productId: 'prod-016',
            productName: 'Mascarilla KN95 Sellada Individual',
            quantity: 10,
            unitPrice: 30.0,
            unitCost: 9.0,
            subtotal: 300.0,
          },
          {
            productId: 'prod-011',
            productName: 'Copa de Gelatina Ligera con Yogurt Natural',
            quantity: 6,
            unitPrice: 42.0,
            unitCost: 18.0,
            subtotal: 252.0,
          },
        ],
        subtotal: 1312.0,
        discountPercent: 0,
        discount: 0,
        total: 1312.0,
        estimatedCost: 469.8,
        amountReceived: 1500.0,
        changeGiven: 188.0,
        cashier: 'Carlos (Guardia Nocturna)',
        notes: 'Ventas nocturnas de cafetería y mascarillas para ingreso a visita',
      },
      {
        id: 'sale-005',
        invoiceNumber: 'TIC-2026-0005',
        date: '2026-10-23T08:15:00.000Z',
        customerName: 'Dra. Sofía Méndez',
        customerRtn: 'C/F',
        customerProfile: 'Personal Médico / Staff',
        documentType: 'Ticket',
        paymentMethod: 'Crédito',
        creditAccountId: 'cred-emp-001',
        items: [
          {
            productId: 'prod-008',
            productName: 'Café con Leche Deslactosada 12oz',
            quantity: 2,
            unitPrice: 68.0,
            unitCost: 21.5,
            subtotal: 136.0,
          },
          {
            productId: 'prod-001',
            productName: 'Sándwich Club de Pavo, Queso y Pan Integral',
            quantity: 2,
            unitPrice: 95.0,
            unitCost: 42.0,
            subtotal: 190.0,
          },
          {
            productId: 'prod-012',
            productName: 'Barra Nutritiva de Avena, Miel y Almendras',
            quantity: 1,
            unitPrice: 38.0,
            unitCost: 16.0,
            subtotal: 38.0,
          },
        ],
        subtotal: 364.0,
        discountPercent: 0,
        discount: 1.0,
        total: 363.0,
        estimatedCost: 143.0,
        amountReceived: 0,
        changeGiven: 0,
        cashier: 'Laura (Operadora de Caja)',
        notes: 'Crédito personal médico Emergencias',
      },
    ],
    expenses: [
      {
        id: 'exp-001',
        date: '2026-10-20T10:00:00.000Z',
        concept: 'Cuota proporcional Canon de Concesión Local Hospitalario y Energía',
        category: 'Canon / Alquiler Espacio Hospitalario',
        expenseType: 'Fijo',
        amount: 850.0,
        paymentMethod: 'Transferencia Bancaria',
        reference: 'HOSP-CONC-10',
        notes: 'Canon semanal de espacio en lobby principal del hospital',
      },
      {
        id: 'exp-002',
        date: '2026-10-21T15:00:00.000Z',
        concept: 'Revisión de temperatura y limpieza de Vitrina Refrigerada de Sándwiches',
        category: 'Mantenimiento y Cadena de Frío',
        expenseType: 'Variable',
        amount: 450.0,
        paymentMethod: 'Efectivo (Caja)',
        reference: 'MANT-209',
        notes: 'Calibración de termostato para conservar alimentos a 4°C',
      },
      {
        id: 'exp-003',
        date: '2026-10-22T08:30:00.000Z',
        concept: 'Insumos de bioseguridad, desinfectante grado hospitalario, cofias y guantes',
        category: 'Bioseguridad, Limpieza y Sanitización',
        expenseType: 'Variable',
        amount: 340.0,
        paymentMethod: 'Efectivo (Caja)',
        reference: 'BIO-412',
        notes: 'Material obligatorio para personal de atención en cafetería hospitalaria',
      },
    ],
    audits: [
      {
        id: 'aud-001',
        date: '2026-10-21T21:00:00.000Z',
        auditor: 'Coordinación de Turno Hospitalario',
        notes: 'Arqueo de cambio de turno (verificación de botellas de agua, kits de higiene y sándwiches)',
        appliedAdjustment: true,
        totalDiscrepancyValue: -39.0,
        items: [
          {
            itemId: 'prod-005',
            itemName: 'Agua Pura Embotellada Sin Gas 600ml',
            unit: 'unid',
            systemStock: 59,
            physicalStock: 58,
            difference: -1,
            unitCost: 9.0,
            monetaryImpact: -9.0,
          },
          {
            itemId: 'prod-014',
            itemName: 'Kit Dental de Emergencia (Cepillo + Pasta + Estuche)',
            unit: 'unid',
            systemStock: 16,
            physicalStock: 15,
            difference: -1,
            unitCost: 30.0,
            monetaryImpact: -30.0,
          },
          {
            itemId: 'prod-001',
            itemName: 'Sándwich Club de Pavo, Queso y Pan Integral',
            unit: 'unid',
            systemStock: 16,
            physicalStock: 16,
            difference: 0,
            unitCost: 42.0,
            monetaryImpact: 0,
          },
        ],
      },
    ],
  };
}

function normalizeParsedDb(parsed: CafeteriaDatabase): {
  db: CafeteriaDatabase;
  mutated: boolean;
} {
  let mutated = false;

  if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
    parsed.users = getDefaultUsers();
    mutated = true;
  }

  if (!Array.isArray(parsed.credits)) {
    parsed.credits = getDefaultCredits();
    mutated = true;
  }

  if (Array.isArray(parsed.sales)) {
    for (const s of parsed.sales as unknown as Array<Record<string, unknown>>) {
      if (s.customerRtn === undefined) {
        s.customerRtn =
          typeof s.customerNit === 'string' && s.customerNit ? s.customerNit : 'C/F';
        delete s.customerNit;
        mutated = true;
      }
    }
  }

  return { db: parsed, mutated };
}

export async function readDb(): Promise<CafeteriaDatabase> {
  const dbUrl = getDatabaseUrl();

  // 1. Modo Nube Permanente: Neon Postgres (Vercel / Producción)
  if (dbUrl) {
    try {
      const sql = neon(dbUrl);
      if (!neonTableInitialized) {
        await sql`
          CREATE TABLE IF NOT EXISTS camilas_coffee_store (
            id TEXT PRIMARY KEY,
            data JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        neonTableInitialized = true;
      }

      const rows = await sql`
        SELECT data FROM camilas_coffee_store WHERE id = 'main' LIMIT 1
      `;

      if (!rows || rows.length === 0) {
        const seed = getInitialSeedData();
        const jsonStr = JSON.stringify(seed);
        await sql`
          INSERT INTO camilas_coffee_store (id, data, updated_at)
          VALUES ('main', ${jsonStr}::jsonb, NOW())
          ON CONFLICT (id) DO NOTHING
        `;
        return seed;
      }

      const rawData = rows[0].data as CafeteriaDatabase;
      const { db, mutated } = normalizeParsedDb(rawData);
      if (mutated) {
        await writeDb(db);
      }
      return db;
    } catch (err) {
      console.error('Error conectando a Neon Postgres:', err);
      throw new Error('Error de conexión con la base de datos Neon Postgres.');
    }
  }

  // 2. Modo Local (LAN) o Fallback Temporal (/tmp)
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const seed = getInitialSeedData();
      fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
      memoryFallbackDb = seed;
      return seed;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as CafeteriaDatabase;
    const { db, mutated } = normalizeParsedDb(parsed);

    if (mutated) {
      await writeDb(db);
    }

    memoryFallbackDb = db;
    return db;
  } catch (err) {
    console.error('Error reading local DB, using memory/seed fallback:', err);
    if (!memoryFallbackDb) {
      memoryFallbackDb = getInitialSeedData();
    }
    return memoryFallbackDb;
  }
}

export async function writeDb(data: CafeteriaDatabase): Promise<void> {
  const dbUrl = getDatabaseUrl();

  if (dbUrl) {
    const sql = neon(dbUrl);
    if (!neonTableInitialized) {
      await sql`
        CREATE TABLE IF NOT EXISTS camilas_coffee_store (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      neonTableInitialized = true;
    }
    const jsonStr = JSON.stringify(data);
    await sql`
      INSERT INTO camilas_coffee_store (id, data, updated_at)
      VALUES ('main', ${jsonStr}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = NOW()
    `;
    return;
  }

  memoryFallbackDb = data;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Filesystem read-only, persisted in memory:', err);
  }
}
