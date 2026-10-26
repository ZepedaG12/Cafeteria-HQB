# VitaliMarket & Café — Sistema de Tienda y Cafetería Hospitalaria

Aplicación web full-stack desarrollada en **Next.js (App Router) + TypeScript + Tailwind CSS**, adaptada para teléfonos móviles, tablets, laptops y pantallas de escritorio, con control de acceso por roles, facturación en **Lempiras (`L`)**, soporte para **RTN**, descuentos por porcentaje (`%`) y acceso nativo en red local (**LAN**).

## Características Principales
- **Punto de Venta (POS) e Historial:** Cobro rápido en **Lempiras (`L`)**, cálculo de cambio en efectivo, descuentos por **porcentaje (`%`)**, registro de **RTN** y emisión de Tickets y Facturas imprimibles.
- **Gestión de Inventario y Kardex:** Control de stock de productos terminados e insumos (con descuento automático por unidad o por receta de insumos), registro de entradas por compras y bajas por vencimiento o mermas.
- **Control de Gastos Operativos:** Registro de egresos fijos y variables de operación hospitalaria.
- **Ganancias y Conteo Físico:** Estado de resultados con Utilidad Neta Real y comparador de auditoría física vs. stock en sistema.
- **Diseño Responsivo y Ajustable:** Interfaz con botones de acción siempre visibles, barra inferior móvil y cajón deslizable en tablets/celulares.

## Credenciales de Acceso por Defecto

| Rol | Usuario | Contraseña | Permisos de Módulos |
| :--- | :--- | :--- | :--- |
| **Operador** | `operador` | `caja123` | **Ventas** (Punto de Venta e Historial) e **Inventario** (Catálogo, Entradas, Salidas y Kardex) |
| **Administrador** | `admin` | `admin123` | **Acceso total:** Ventas, Inventario, Gastos Operativos, Ganancias y Auditoría, Resumen General y Gestión de Usuarios / Red LAN |

*(Desde el módulo **Usuarios / LAN**, el administrador puede crear más usuarios operadores o administradores, cambiar contraseñas o activar/desactivar cuentas).*

## Ejecución y Acceso en Red Local (LAN)

### Opción rápida en Windows (Recomendada para red local LAN)
1. Ejecuta como Administrador `abrir-puerto-firewall-lan.bat` (solo la primera vez) para permitir conexiones entrantes al puerto `3000` en el Firewall de Windows.
2. Ejecuta `iniciar-servicio-lan.bat` para compilar e iniciar el servidor escuchando en `0.0.0.0:3000` y ver en pantalla las direcciones IP para conectarte desde celulares, tablets u otras PCs en la misma red Wi-Fi / Ethernet.

### Modo desarrollo por consola
```bash
npm install
npm run dev
```

- **En esta PC:** `http://localhost:3000`
- **Desde celulares, tablets u otras PCs en la misma red:** usa la dirección IP local mostrada en el módulo **Usuarios / LAN** o en la consola (ej. `http://192.168.x.x:3000`).
