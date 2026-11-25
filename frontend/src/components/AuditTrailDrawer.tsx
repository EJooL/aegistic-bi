import React, { useEffect, useState } from 'react';
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
import {
  formatGuardrailName,
  formatSanityCheckName,
  type AuditTrail,
  type QueryStatus,
} from '../lib/api';

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

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

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

  const drawerInner = (
    <div className="w-[min(416px,92vw)] xl:w-[416px] h-full bg-[#FFFFFF] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 h-[68px] border-b border-[#E5E7EB] flex items-center justify-between bg-[#FFFFFF] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {isVerified ? (
            <ShieldCheck className="w-[18px] h-[18px] text-[#5BC2F4] shrink-0" />
          ) : isBlocked ? (
            <ShieldAlert className="w-[18px] h-[18px] text-[#FF0F5B] shrink-0" />
          ) : (
            <ShieldCheck className="w-[18px] h-[18px] text-[#67689E] shrink-0" />
          )}
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-bold text-[#09090B] leading-tight">
              Verification &amp; Audit Trail
            </h2>
            <p className="text-[12px] text-[#4B5563] mt-0.5 truncate">
              Semantic lineage and SQL AST telemetry
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close audit drawer"
          aria-label="Close audit drawer"
          className="p-1.5 rounded border border-transparent hover:border-[#BDC4D0] text-[#4B5563] hover:text-[#09090B] transition-colors duration-150"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#E5E7EB]">
        {!auditTrail ? (
          <div className="p-6 text-[13.5px] text-[#4B5563] leading-relaxed">
            Run a query to inspect its governed metric definitions, compiled SQL,
            and AST guardrail verification checks.
          </div>
        ) : (
          <>
            {/* Telemetry Strip */}
            <div className="grid grid-cols-3 divide-x divide-[#E5E7EB] bg-[#F7F8FA]">
              <div className="px-4 py-3">
                <div className="text-[12px] font-medium text-[#4B5563]">Latency</div>
                <div className="mt-0.5 text-[15px] font-bold text-[#09090B] tabular-nums">
                  {auditTrail.latency_ms.toFixed(1)} ms
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-[12px] font-medium text-[#4B5563]">Rows</div>
                <div className="mt-0.5 text-[15px] font-bold text-[#09090B] tabular-nums">
                  {auditTrail.row_count}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-[12px] font-medium text-[#4B5563]">Parser</div>
                <div className="mt-0.5 text-[13.5px] font-semibold text-[#09090B] truncate capitalize">
                  {auditTrail.parser_used}
                </div>
              </div>
            </div>

            {/* 1. Semantic Definitions */}
            {auditTrail.metrics_used.length > 0 && (
              <section className="px-5 py-4 space-y-4">
                <h3 className="text-[13px] font-bold text-[#09090B]">
                  Semantic definitions
                </h3>
                <div className="space-y-4 divide-y divide-[#E5E7EB]">
                  {auditTrail.metrics_used.map((m, mIdx) => (
                    <div
                      key={m.key}
                      className={`space-y-2.5 ${mIdx > 0 ? 'pt-4' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13.5px] font-bold text-[#09090B]">
                          {m.label}
                        </span>
                        <span className="text-[12px] font-semibold text-[#67689E]">
                          {m.key}
                        </span>
                      </div>

                      <pre className="sql-code-block rounded px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-words">
                        <code>{m.formula_display}</code>
                      </pre>

                      {m.mandatory_filters.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                          <span className="font-medium text-[#4B5563]">
                            Mandatory filters:
                          </span>
                          {m.mandatory_filters.map((f, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-[#F7F8FA] border border-[#E5E7EB] font-medium text-[#09090B]"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}

                      {m.caveats.length > 0 && (
                        <div className="rounded bg-[#FFF5F8] border border-[#E5E7EB] px-3 py-2.5 space-y-1">
                          <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#09090B]">
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-[#FF0F5B]"
                              aria-hidden="true"
                            />
                            <span>Metric caveats</span>
                          </div>
                          {m.caveats.map((caveat, cIdx) => (
                            <p
                              key={cIdx}
                              className="text-[12.5px] text-[#4B5563] leading-snug"
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
            <section className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13px] font-bold text-[#09090B]">
                  Compiled SQL
                </h3>
                {auditTrail.compiled_sql && (
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded border border-[#BDC4D0] bg-[#FFFFFF] text-[#09090B] hover:border-[#09090B] transition-colors duration-150"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#5BC2F4]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#4B5563]" />
                        <span>Copy SQL</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {auditTrail.compiled_sql ? (
                <div className="rounded-md bg-[#09090B] overflow-hidden border border-[#27272A]">
                  <div className="px-3.5 py-2 border-b border-[#27272A] flex items-center justify-between text-[12px] text-[#9CA3AF]">
                    <span>
                      {isBlocked
                        ? 'Intercepted SQL input'
                        : isVerified
                          ? 'DuckDB · Read-only SELECT'
                          : 'Compiled SQL'}
                    </span>
                    <span
                      className={`font-semibold ${
                        isBlocked
                          ? 'text-[#FF0F5B]'
                          : isVerified
                            ? 'text-[#5BC2F4]'
                            : 'text-[#D1D5DB]'
                      }`}
                    >
                      {isBlocked
                        ? 'AST blocked'
                        : isVerified
                          ? 'AST verified'
                          : 'Not executed'}
                    </span>
                  </div>
                  <pre className="font-mono text-[12px] leading-[1.65] text-[#F9FAFB] p-3.5 overflow-x-auto whitespace-pre-wrap break-words max-h-64">
                    <code>{auditTrail.compiled_sql}</code>
                  </pre>
                </div>
              ) : (
                <div className="rounded bg-[#F7F8FA] border border-[#E5E7EB] px-3.5 py-2.5 text-[12.5px] text-[#4B5563]">
                  No SQL compiled for this request.
                </div>
              )}

              {auditTrail.tables_accessed.length > 0 && (
                <div className="flex items-center flex-wrap gap-1.5 text-[12px]">
                  <span className="font-medium text-[#4B5563]">
                    {isBlocked ? 'Referenced targets:' : 'Gold tables:'}
                  </span>
                  {auditTrail.tables_accessed.map((tbl) => (
                    <span
                      key={tbl}
                      className="px-2 py-0.5 rounded bg-[#F7F8FA] border border-[#E5E7EB] font-medium text-[#09090B]"
                    >
                      {tbl}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* 3. SQL AST Guardrails */}
            {auditTrail.guardrail_checks.length > 0 && (
              <section className="px-5 py-4 space-y-2.5">
                <h3 className="text-[13px] font-bold text-[#09090B]">
                  SQL AST guardrails
                </h3>
                <div className="divide-y divide-[#E5E7EB] border-t border-[#E5E7EB]">
                  {auditTrail.guardrail_checks.map((check) => (
                    <div
                      key={check.name}
                      className={`py-2.5 flex items-start gap-2.5 ${
                        check.passed ? '' : 'bg-[#FFF5F8] -mx-5 px-5'
                      }`}
                    >
                      {check.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-[#5BC2F4] shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#FF0F5B] shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[#09090B]">
                          {formatGuardrailName(check.name)}
                        </div>
                        <div className="text-[12.5px] text-[#4B5563] mt-0.5 leading-snug">
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
                <h3 className="text-[13px] font-bold text-[#09090B]">
                  Post-query sanity checks
                </h3>
                <div className="divide-y divide-[#E5E7EB] border-t border-[#E5E7EB]">
                  {auditTrail.sanity_checks.map((check) => {
                    const isWarn =
                      !check.passed ||
                      check.severity === 'warning' ||
                      check.severity === 'error';
                    return (
                      <div
                        key={check.name}
                        className={`py-2.5 flex items-start gap-2.5 ${
                          isWarn ? 'bg-[#FFF5F8] -mx-5 px-5' : ''
                        }`}
                      >
                        {isWarn ? (
                          <AlertTriangle className="w-4 h-4 text-[#FF0F5B] shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-[#5BC2F4] shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-[#09090B]">
                            {formatSanityCheckName(check.name)}
                          </div>
                          <div className="text-[12.5px] text-[#4B5563] mt-0.5 leading-snug">
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
    </div>
  );

  return (
    <>
      {/* Desktop Smooth Inline Sliding Drawer (xl+) */}
      <aside
        aria-label="Verification and Audit Trail"
        aria-hidden={!isOpen}
        className={`hidden xl:block shrink-0 h-screen sticky top-0 overflow-hidden transition-[width,opacity] duration-200 ease-swiss ${
          isOpen
            ? 'w-[416px] opacity-100 border-l border-[#E5E7EB]'
            : 'w-0 opacity-0 border-l-0 pointer-events-none'
        }`}
      >
        <div
          className={`h-full transition-transform duration-200 ease-swiss ${
            isOpen ? 'translate-x-0' : 'translate-x-6'
          }`}
        >
          {drawerInner}
        </div>
      </aside>

      {/* Tablet & Mobile Overlay Slide-Over Drawer (< xl) */}
      <div
        className={`xl:hidden fixed inset-0 z-40 transition-opacity duration-200 ease-swiss ${
          isOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      >
        <div
          className="absolute inset-0 bg-[#09090B]/30"
          onClick={onClose}
        />
        <aside
          aria-label="Verification and Audit Trail"
          className={`absolute right-0 top-0 bottom-0 border-l border-[#E5E7EB] transition-transform duration-200 ease-swiss ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {drawerInner}
        </aside>
      </div>
    </>
  );
};
