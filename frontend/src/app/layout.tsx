import type { Metadata } from "next";
import "./globals.css";
import "./dashboard/dashboard.css";

export const metadata: Metadata = {
  title: "On Time HRMS (OT)",
  description: "Advanced Human Resource Management System - Efficiency in Time",
};

import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-center" expand={true} richColors />
      </body>
    </html>
  );
}
