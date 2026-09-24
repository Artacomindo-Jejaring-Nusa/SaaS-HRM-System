"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function PayrollApprovalRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/payroll");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
      <Loader2 className="animate-spin text-[#8B0000]" size={36} />
      <p className="text-gray-400 font-medium text-sm">Membuka Manajemen Payroll...</p>
    </div>
  );
}
