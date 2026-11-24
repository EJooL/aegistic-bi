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
  Clock,
  Rows3,
  Table2,
  Code2,
  Filter,
  Activity,
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
      // Clipboard fallback ignored cleanly
    }
  };

  const isVerified = status === 'verified' && Boolean(auditTrail?.verified);
  const isBlocked = status === 'guardrail_blocked';

  return (
    <aside
      className="w-[400px] shrink-0 bg-[#FFFFFF] border-l border-[#E2E8F0] flex flex-col h-[calc(100vh)] sticky top-0 overflow-hidden"
      aria-label="Verification and Audit Trail"
    >
      {/* Drawer Header */}
      <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#FFFFFF]">
        <div className="flex items-center gap-2.5 min-w-0">
          {isVerified ? (
            <ShieldCheck className="w-5 h-5 text-[#4DA8E5] shrink-0" />
          ) : isBlocked ? (
            <ShieldAlert className="w-5 h-5 text-[#E11D48] shrink-0" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-[#3B498B] shrink-0" />
          )}
          <div className="min-w-0">
            <h2 className="text-[14.5px] font-bold text-[#111827] leading-tight">
              Verification &amp; Audit Trail
            </h2>
            <p className="text-[11.5px] text-[#526075] mt-0.5">
              Semantic lineage, SQL AST &amp; sanity telemetry
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Collapse audit drawer"
          className="p-1.5 rounded-md text-[#526075] hover:text-[#111827] hover:bg-[#F1F5F9] transition-colors focus:outline-none focus:ring-2 focus:ring-[#3B498B]/40"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {!auditTrail ? (
          <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 text-center">
            <ShieldCheck className="w-8 h-8 text-[#4DA8E5] mx-auto mb-2.5" />
            <p className="text-[13px] font-semibold text-[#111827]">
              Awaiting Query Execution
            </p>
            <p className="text-[12px] text-[#526075] mt-1 leading-relaxed">
              Run a question in Ask Aegistic to inspect governed metric formulas,
              compiled Gold SQL, AST guardrail checks, and sanity telemetry.
            </p>
          </div>
        ) : (
          <>
            {/* Execution Telemetry Strip */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
                <div className="flex items-center gap-1 text-[11px] font-medium text-[#526075]">
                  <Clock className="w-3 h-3 text-[#4DA8E5]" />
                  Latency
                </div>
                <div className="mt-1 text-[15px] font-bold text-[#111827] tabular-nums">
                  {auditTrail.latency_ms.toFixed(1)} ms
                </div>
              </div>
              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
                <div className="flex items-center gap-1 text-[11px] font-medium text-[#526075]">
                  <Rows3 className="w-3 h-3 text-[#4DA8E5]" />
                  Rows
                </div>
                <div className="mt-1 text-[15px] font-bold text-[#111827] tabular-nums">
                  {auditTrail.row_count}
                </div>
              </div>
              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
                <div className="flex items-center gap-1 text-[11px] font-medium text-[#526075]">
                  <Activity className="w-3 h-3 text-[#4DA8E5]" />
                  Parser
                </div>
                <div className="mt-1 text-[12.5px] font-semibold font-mono text-[#111827] truncate">
                  {auditTrail.parser_used}
                </div>
              </div>
            </div>

            {/* 1. Business Formulas & Mandatory Filters */}
            {auditTrail.metrics_used.length > 0 && (
              <section>
                <div className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-[#526075] mb-2.5">
                  <Filter className="w-3.5 h-3.5 text-[#3B498B]" />
                  Business Formulas &amp; Mandatory Filters
                </div>
                <div className="space-y-3">
                  {auditTrail.metrics_used.map((m) => (
                    <div
                      key={m.key}
                      className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-3.5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-[#111827]">
                          {m.label}
                        </span>
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#EEF0FA] text-[#3B498B] font-medium">
                          {m.key}
                        </span>
                      </div>

                      <div className="rounded bg-[#F1F5F9] border border-[#E2E8F0] px-2.5 py-2 font-mono text-[11.5px] text-[#111827] break-words leading-relaxed">
                        {m.formula_display}
                      </div>

                      {m.mandatory_filters.length > 0 && (
                        <div>
                          <div className="text-[11px] font-medium text-[#526075] mb-1">
                            Mandatory Filters Applied:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {m.mandatory_filters.map((f, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center font-mono text-[11px] px-2 py-0.5 rounded bg-[#EBF6FD] text-[#1B6CA8] border border-[#4DA8E5]/30"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {m.caveats.length > 0 && (
                        <div className="rounded-md bg-[#FFF1F2] border border-[#FECDD3] px-2.5 py-2 space-y-1">
                          {m.caveats.map((caveat, cIdx) => (
                            <p
                              key={cIdx}
                              className="text-[11.5px] text-[#9F1239] leading-relaxed"
                            >
                              • {caveat}
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
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-[#526075]">
                  <Code2 className="w-3.5 h-3.5 text-[#3B498B]" />
                  Compiled SQL
                </div>
                {auditTrail.compiled_sql && (
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="inline-flex items-center gap-1 text-[11.5px] font-medium px-2 py-1 rounded border border-[#CBD5E1] bg-[#FFFFFF] text-[#1F2937] hover:bg-[#F8FAFC] hover:text-[#3B498B] transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-[#4DA8E5]" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy SQL
                      </>
                    )}
                  </button>
                )}
              </div>

              {auditTrail.compiled_sql ? (
                <pre className="sql-code-block rounded-lg p-3.5 overflow-x-auto whitespace-pre-wrap break-words max-h-64">
                  <code>{auditTrail.compiled_sql}</code>
                </pre>
              ) : (
                <div className="rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] px-3 py-2.5 text-[12px] text-[#526075]">
                  No SQL compiled for this request.
                </div>
              )}

              {auditTrail.tables_accessed.length > 0 && (
                <div className="mt-2.5 flex items-center flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#526075] mr-1">
                    <Table2 className="w-3 h-3" />
                    Tables:
                  </span>
                  {auditTrail.tables_accessed.map((tbl) => (
                    <span
                      key={tbl}
                      className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#F1F5F9] border border-[#E2E8F0] text-[#1F2937]"
                    >
                      {tbl}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* 3. SQL Guardrails Checklist */}
            {auditTrail.guardrail_checks.length > 0 && (
              <section>
                <div className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-[#526075] mb-2.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#4DA8E5]" />
                  SQL Guardrails (AST Verification)
                </div>
                <div className="space-y-2">
                  {auditTrail.guardrail_checks.map((check) => (
                    <div
                      key={check.name}
                      className={`rounded-lg border px-3 py-2.5 flex items-start gap-2.5 ${
                        check.passed
                          ? 'bg-[#EBF6FD]/60 border-[#4DA8E5]/30'
                          : 'bg-[#FFF1F2] border-[#FECDD3]'
                      }`}
                    >
                      {check.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-[#4DA8E5] shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div
                          className={`font-mono text-[12px] font-semibold ${
                            check.passed ? 'text-[#1B6CA8]' : 'text-[#9F1239]'
                          }`}
                        >
                          {check.name}
                        </div>
                        <div
                          className={`text-[12px] mt-0.5 leading-snug ${
                            check.passed ? 'text-[#1F2937]' : 'text-[#9F1239]'
                          }`}
                        >
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
              <section>
                <div className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-[#526075] mb-2.5">
                  <Activity className="w-3.5 h-3.5 text-[#3B498B]" />
                  Post-Query Sanity Checks
                </div>
                <div className="space-y-2">
                  {auditTrail.sanity_checks.map((check) => {
                    const isWarn = !check.passed || check.severity === 'warning' || check.severity === 'error';
                    return (
                      <div
                        key={check.name}
                        className={`rounded-lg border px-3 py-2.5 flex items-start gap-2.5 ${
                          isWarn
                            ? 'bg-[#FFF1F2] border-[#FECDD3]'
                            : 'bg-[#F8FAFC] border-[#E2E8F0]'
                        }`}
                      >
                        {isWarn ? (
                          <AlertTriangle className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-[#4DA8E5] shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <div
                            className={`font-mono text-[12px] font-semibold ${
                              isWarn ? 'text-[#9F1239]' : 'text-[#111827]'
                            }`}
                          >
                            {check.name}
                          </div>
                          <div
                            className={`text-[12px] mt-0.5 leading-snug ${
                              isWarn ? 'text-[#9F1239]' : 'text-[#526075]'
                            }`}
                          >
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
