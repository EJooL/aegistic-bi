import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  X,
} from 'lucide-react';
import type { AuditTrail, QueryStatus } from '../lib/api';

interface AuditTrailDrawerProps {
  auditTrail: AuditTrail | null;
  status: QueryStatus | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AuditTrailDrawer: React.FC<AuditTrailDrawerProps> = ({
  auditTrail,
  status,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopySql = async () => {
    if (!auditTrail?.compiled_sql) return;
    try {
      await navigator.clipboard.writeText(auditTrail.compiled_sql);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const isVerified = status === 'verified' && Boolean(auditTrail?.verified);
  const isBlocked = status === 'guardrail_blocked';

  return (
    <aside
      className="w-[400px] shrink-0 bg-[#FFFFFF] border-l border-[#E5E7EB] flex flex-col h-screen sticky top-0 overflow-hidden"
      aria-label="Verification and Audit Trail"
    >
      {/* Flat Header */}
      <div className="px-5 h-[68px] border-b border-[#E5E7EB] flex items-center justify-between bg-[#FFFFFF]">
        <div className="flex items-center gap-2.5 min-w-0">
          {isVerified ? (
            <ShieldCheck className="w-[18px] h-[18px] text-[#5BC2F4] shrink-0" />
          ) : isBlocked ? (
            <ShieldAlert className="w-[18px] h-[18px] text-[#FF0F5B] shrink-0" />
          ) : (
            <ShieldCheck className="w-[18px] h-[18px] text-[#67689E] shrink-0" />
          )}
          <div className="min-w-0">
            <h2 className="font-display text-[14.5px] font-bold text-[#09090B] leading-tight">
              Verification &amp; Audit Trail
            </h2>
            <p className="text-[11.5px] text-[#4B5563] mt-0.5">
              Semantic lineage &amp; SQL AST telemetry
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close audit drawer"
          className="p-1.5 rounded border border-transparent hover:border-[#BDC4D0] text-[#4B5563] hover:text-[#09090B] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#E5E7EB]">
        {!auditTrail ? (
          <div className="p-6 text-[13px] text-[#4B5563]">
            Execute a query to inspect its governed formulas, compiled SQL, and AST
            guardrail checks.
          </div>
        ) : (
          <>
            {/* Telemetry Strip */}
            <div className="grid grid-cols-3 divide-x divide-[#E5E7EB] bg-[#F7F8FA]">
              <div className="px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#4B5563]">
                  Latency
                </div>
                <div className="mt-0.5 text-[15px] font-bold text-[#09090B] tabular-nums">
                  {auditTrail.latency_ms.toFixed(1)} ms
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#4B5563]">
                  Rows
                </div>
                <div className="mt-0.5 text-[15px] font-bold text-[#09090B] tabular-nums">
                  {auditTrail.row_count}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#4B5563]">
                  Parser
                </div>
                <div className="mt-0.5 text-[13px] font-semibold text-[#09090B] truncate capitalize">
                  {auditTrail.parser_used}
                </div>
              </div>
            </div>

            {/* 1. Business Formulas & Mandatory Filters */}
            {auditTrail.metrics_used.length > 0 && (
              <section className="px-5 py-4 space-y-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4B5563]">
                  01 / Semantic Definitions
                </div>
                <div className="space-y-4">
                  {auditTrail.metrics_used.map((m) => (
                    <div key={m.key} className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13.5px] font-bold text-[#09090B]">
                          {m.label}
                        </span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded border border-[#BDC4D0] bg-[#FFFFFF] text-[#67689E] font-semibold">
                          {m.key}
                        </span>
                      </div>

                      <pre className="sql-code-block font-mono rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap break-words">
                        <code>{m.formula_display}</code>
                      </pre>

                      {m.mandatory_filters.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11.5px] font-medium text-[#4B5563]">
                            Filters:
                          </span>
                          {m.mandatory_filters.map((f, i) => (
                            <span
                              key={i}
                              className="text-[11.5px] font-medium px-2 py-0.5 rounded bg-[#F7F8FA] border border-[#BDC4D0] text-[#09090B]"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}

                      {m.caveats.length > 0 && (
                        <div className="rounded border border-[#E5E7EB] bg-[#FFF5F8] px-3 py-2.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#09090B]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF0F5B]" />
                            <span>Metric Caveats</span>
                          </div>
                          {m.caveats.map((caveat, cIdx) => (
                            <p
                              key={cIdx}
                              className="text-[12px] text-[#4B5563] leading-snug"
                            >
                              {caveat}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 2. Compiled SQL */}
            <section className="px-5 py-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4B5563]">
                  02 / Compiled SQL
                </span>
                {auditTrail.compiled_sql && (
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2 py-1 rounded border border-[#BDC4D0] bg-[#FFFFFF] text-[#09090B] hover:border-[#09090B] transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-[#5BC2F4]" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-[#4B5563]" />
                        Copy
                      </>
                    )}
                  </button>
                )}
              </div>

              {auditTrail.compiled_sql ? (
                <pre className="sql-code-block font-mono rounded p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-60">
                  <code>{auditTrail.compiled_sql}</code>
                </pre>
              ) : (
                <div className="rounded bg-[#F7F8FA] border border-[#BDC4D0] px-3 py-2 text-[12px] text-[#4B5563]">
                  No SQL compiled for this request.
                </div>
              )}

              {auditTrail.tables_accessed.length > 0 && (
                <div className="flex items-center flex-wrap gap-1.5 pt-1">
                  <span className="text-[11.5px] font-medium text-[#4B5563]">
                    Tables:
                  </span>
                  {auditTrail.tables_accessed.map((tbl) => (
                    <span
                      key={tbl}
                      className="text-[11.5px] font-medium px-2 py-0.5 rounded bg-[#F7F8FA] border border-[#E5E7EB] text-[#09090B]"
                    >
                      {tbl}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* 3. SQL Guardrails Checklist */}
            {auditTrail.guardrail_checks.length > 0 && (
              <section className="px-5 py-4 space-y-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4B5563]">
                  03 / SQL AST Guardrails
                </div>
                <div className="space-y-2">
                  {auditTrail.guardrail_checks.map((check) => (
                    <div
                      key={check.name}
                      className={`rounded border px-3 py-2.5 flex items-start gap-2.5 ${
                        check.passed
                          ? 'bg-[#FFFFFF] border-[#E5E7EB]'
                          : 'bg-[#FFF5F8] border-[#E5E7EB]'
                      }`}
                    >
                      {check.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-[#5BC2F4] shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#FF0F5B] shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold text-[#09090B]">
                          {check.name}
                        </div>
                        <div className="text-[12px] text-[#4B5563] mt-0.5 leading-snug">
                          {check.detail}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 4. Post-Query Sanity Checks */}
            {auditTrail.sanity_checks.length > 0 && (
              <section className="px-5 py-4 space-y-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4B5563]">
                  04 / Post-Query Sanity Checks
                </div>
                <div className="space-y-2">
                  {auditTrail.sanity_checks.map((check) => {
                    const isWarn =
                      !check.passed ||
                      check.severity === 'warning' ||
                      check.severity === 'error';
                    return (
                      <div
                        key={check.name}
                        className={`rounded border px-3 py-2.5 flex items-start gap-2.5 ${
                          isWarn
                            ? 'bg-[#FFF5F8] border-[#E5E7EB]'
                            : 'bg-[#FFFFFF] border-[#E5E7EB]'
                        }`}
                      >
                        {isWarn ? (
                          <AlertTriangle className="w-4 h-4 text-[#FF0F5B] shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-[#5BC2F4] shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-semibold text-[#09090B]">
                            {check.name}
                          </div>
                          <div className="text-[12px] text-[#4B5563] mt-0.5 leading-snug">
                            {check.detail}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
