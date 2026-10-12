import React from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { PolicySection } from "@/lib/privacy-policy-data";

interface PolicySectionCardProps {
  section: PolicySection;
}

export function PolicySectionCard({ section }: Readonly<PolicySectionCardProps>) {
  const IconComp = section.icon;

  return (
    <section
      id={section.id}
      className="scroll-mt-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4 hover:border-rose-200 transition-colors"
    >
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 flex items-center justify-center shrink-0 font-bold text-sm">
            <IconComp size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-rose-800 dark:text-rose-400">
                PASAL {section.number}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                {section.badge}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {section.title}
            </h2>
          </div>
        </div>
      </div>

      {/* Summary Callout */}
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-750 text-xs text-slate-700 dark:text-slate-300 italic">
        &quot;{section.summary}&quot;
      </div>

      {/* Paragraphs */}
      <div className="space-y-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        {section.content.map((p) => (
          <p key={`${section.id}-p-${p.slice(0, 32)}`}>{p}</p>
        ))}
      </div>

      {/* Key Points / Employee Highlights */}
      {section.keyPoints && section.keyPoints.length > 0 && (
        <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 space-y-2">
          <div className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>Poin Perlindungan Utama bagi Karyawan:</span>
          </div>
          <ul className="space-y-1 text-xs text-emerald-950 dark:text-emerald-200 list-disc list-inside">
            {section.keyPoints.map((kp) => (
              <li key={`${section.id}-kp-${kp.slice(0, 32)}`} className="leading-relaxed">
                {kp}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Admin Notes / Governance Highlights */}
      {section.adminNotes && section.adminNotes.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 space-y-2">
          <div className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-amber-600 dark:text-amber-400" />
            <span>Kewajiban Tata Kelola bagi Super Admin:</span>
          </div>
          <ul className="space-y-1 text-xs text-amber-950 dark:text-amber-200 list-disc list-inside">
            {section.adminNotes.map((an) => (
              <li key={`${section.id}-an-${an.slice(0, 32)}`} className="leading-relaxed">
                {an}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
