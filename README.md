# Camila's Coffee — Sistema de Tienda y Cafetería Hospitalaria

Aplicación web full-stack lista para producción desarrollada en **Next.js (App Router) + TypeScript + Tailwind CSS**, adaptada para teléfonos móviles, tablets, laptops y escritorio, con facturación en **Lempiras (`L`)**, soporte para **RTN**, descuentos por porcentaje (`%`), **Créditos de Empleados Hospitalarios**, **Reporte Contable Mensual en Excel con Gráficos** y soporte dual de base de datos (**Neon Postgres** en Vercel / **JSON Local** en LAN).

## Características Principales
- **Punto de Venta (POS) e Historial:** Cobro rápido en **Lempiras (`L`)** mediante **Efectivo**, **Tarjeta**, **Transferencia** o **Crédito de Empleado**, cálculo de cambio, descuentos por **porcentaje (`%`)**, registro de **RTN** y emisión de Tickets y Facturas imprimibles.
- **Créditos de Empleados Hospitalarios (`Créditos`):** Registro de cuentas por cobrar del personal médico/hospitalario, registro de abonos parciales o cancelación total conforme vayan abonando, historial detallado de consumos/pagos y exportación a **Excel (`.xlsx`)**.
- **Reporte Mensual Contable en Excel con Gráficos (`Reportes / Excel`):** Selección de **Mes y Año** con vista previa interactiva y descarga de libro Excel (`DESCRIPCIÓN`, `ENTRADAS`, `SALIDAS`, `RESUMEN`) con **2 gráficos incrustados** (Ventas por Modalidad y Comparativo Venta vs. Compras/Gastos vs. Ganancia + Movimiento de Efectivo).
- **Gestión de Inventario y Kardex:** Control de stock de productos terminados e insumos (descuento directo o por receta), compras a proveedores y bajas por mermas/vencimientos.
- **Base de Datos Permanente en Nube (Neon Postgres):** Compatible automáticamente con `DATABASE_URL` / `POSTGRES_URL` para despliegues permanentes gratuitos en **Vercel + Neon Postgres**, manteniendo respaldo local en red LAN cuando se corre sin internet.

## Credenciales de Acceso Iniciales

| Rol | Usuario | Contraseña | Permisos de Módulos |
| :--- | :--- | :--- | :--- |
| **Operador** | `operador` | `caja123` | **Ventas** (POS e Historial), **Créditos** (ventas al crédito y recepción de abonos) e **Inventario** |
| **Administrador** | `admin` | `admin123` | **Acceso total:** Ventas, Créditos (incl. eliminar cuentas), Inventario, Gastos, Reportes Mensuales / Excel, Resumen y Usuarios / Red |

## Despliegue en Producción con Vercel + Neon Postgres (Gratis \$0/mes)
1. Importa este repositorio (`ZepedaG12/Cafeteria-HQB`) en [Vercel](https://vercel.com).
2. En tu proyecto de Vercel, entra a la pestaña **Storage** → **Create Database** → selecciona **Neon (Serverless Postgres)** → Plan **Free** → **Connect**.
3. Vercel agregará automáticamente la variable `DATABASE_URL` a tu proyecto. Haz **Redeploy** (o se desplegará al instante) y la tabla `camilas_coffee_store` se creará e inicializará sola en el primer ingreso.

## Ejecución en Red Local (LAN)
1. Ejecuta una vez `abrir-puerto-firewall-lan.bat` como Administrador.
2. Inicia el servicio con `iniciar-servicio-lan.bat` (o `npm run dev` en desarrollo).
