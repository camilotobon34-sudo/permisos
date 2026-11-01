import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Control de Asistencia Industrial | SG-SST",
  description: "Sistema digital de control de asistencia para cursos y capacitaciones industriales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <title>Control de Asistencia Industrial | SG-SST</title>
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}