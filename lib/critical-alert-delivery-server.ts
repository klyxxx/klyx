import "server-only";

import { getKlyxObservabilityFinancialMonitoringSnapshot } from "@/lib/observability-financial-monitoring-server";
import { recordKlyxOpsRuntimeHeartbeat } from "@/lib/ops-runtime-heartbeat-server";

export async function runKlyxCriticalAlertDeliveryProbe() {
  const snapshot =
    await getKlyxObservabilityFinancialMonitoringSnapshot({
      signalLimit: 250,
    });

  const criticalSignals = snapshot.severityCounts.critical;
  const status = criticalSignals > 0 ? "degraded" : "healthy";

  await recordKlyxOpsRuntimeHeartbeat({
    component: "critical_alert_delivery",
    status,
    details: {
      criticalSignals,
      monitoringHealth: snapshot.health,
    },
  });

  return {
    status,
    criticalSignals,
    monitoringHealth: snapshot.health,
  };
}
