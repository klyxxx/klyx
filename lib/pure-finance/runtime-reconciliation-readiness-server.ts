// Transitional compatibility boundary. Server/database implementation lives
// outside lib/pure-finance so the pure financial engine remains provider- and
// database-independent.
export {
  inspectFinancialRuntimeBlockingTruth,
  requireNoBlockingFinancialRuntimeTruth,
  type FinancialRuntimeBlockingTruth,
  type LegacyShadowEvidenceBasis,
  type LegacyShadowEvidenceCase,
} from "@/lib/pure-finance-runtime-reconciliation-readiness-server";
