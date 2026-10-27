import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Camila's Coffee | Tienda y Cafetería Hospitalaria",
  description:
    "Sistema de ventas, créditos de empleados, inventario, gastos y reportes contables para Camila's Coffee.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-dvh bg-[#F7F8F6] text-[#26302D] selection:bg-[#DCE6E2]">
        {children}
      </body>
    </html>
  );
}
