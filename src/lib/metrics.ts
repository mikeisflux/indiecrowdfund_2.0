/**
 * Prometheus-compatible Metrics
 * Lightweight metrics collection that exposes a /api/metrics endpoint
 * in Prometheus text format.
 *
 * Usage:
 *   import { metrics } from "@/lib/metrics";
 *   metrics.httpRequestsTotal.inc({ method: "POST", path: "/api/pledges", status: "200" });
 *   metrics.httpRequestDuration.observe({ method: "POST", path: "/api/pledges" }, 0.123);
 */

interface CounterLabels {
  [key: string]: string;
}

class Counter {
  private name: string;
  private help: string;
  private values = new Map<string, number>();

  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  inc(labels: CounterLabels = {}, value = 1): void {
    const key = this.labelsToKey(labels);
    this.values.set(key, (this.values.get(key) || 0) + value);
  }

  serialize(): string {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
    ];
    for (const [key, value] of this.values) {
      const labelsStr = key ? `{${key}}` : "";
      lines.push(`${this.name}${labelsStr} ${value}`);
    }
    return lines.join("\n");
  }

  private labelsToKey(labels: CounterLabels): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");
  }
}

class Histogram {
  private name: string;
  private help: string;
  private buckets: number[];
  private data = new Map<string, { buckets: number[]; sum: number; count: number }>();

  constructor(name: string, help: string, buckets?: number[]) {
    this.name = name;
    this.help = help;
    this.buckets = buckets || [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  }

  observe(labels: CounterLabels, value: number): void {
    const key = this.labelsToKey(labels);
    if (!this.data.has(key)) {
      this.data.set(key, { buckets: new Array(this.buckets.length).fill(0), sum: 0, count: 0 });
    }
    const d = this.data.get(key)!;
    d.sum += value;
    d.count++;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        d.buckets[i]++;
      }
    }
  }

  serialize(): string {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];
    for (const [key, d] of this.data) {
      const labelsPrefix = key ? `${key},` : "";
      for (let i = 0; i < this.buckets.length; i++) {
        lines.push(`${this.name}_bucket{${labelsPrefix}le="${this.buckets[i]}"} ${d.buckets[i]}`);
      }
      lines.push(`${this.name}_bucket{${labelsPrefix}le="+Inf"} ${d.count}`);
      const labelsStr = key ? `{${key}}` : "";
      lines.push(`${this.name}_sum${labelsStr} ${d.sum}`);
      lines.push(`${this.name}_count${labelsStr} ${d.count}`);
    }
    return lines.join("\n");
  }

  private labelsToKey(labels: CounterLabels): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");
  }
}

class Gauge {
  private name: string;
  private help: string;
  private values = new Map<string, number>();

  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  set(labels: CounterLabels, value: number): void {
    const key = this.labelsToKey(labels);
    this.values.set(key, value);
  }

  inc(labels: CounterLabels = {}, value = 1): void {
    const key = this.labelsToKey(labels);
    this.values.set(key, (this.values.get(key) || 0) + value);
  }

  dec(labels: CounterLabels = {}, value = 1): void {
    const key = this.labelsToKey(labels);
    this.values.set(key, (this.values.get(key) || 0) - value);
  }

  serialize(): string {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} gauge`,
    ];
    for (const [key, value] of this.values) {
      const labelsStr = key ? `{${key}}` : "";
      lines.push(`${this.name}${labelsStr} ${value}`);
    }
    return lines.join("\n");
  }

  private labelsToKey(labels: CounterLabels): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");
  }
}

// Application metrics
export const metrics = {
  httpRequestsTotal: new Counter(
    "http_requests_total",
    "Total number of HTTP requests"
  ),
  httpRequestDuration: new Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds"
  ),
  pledgesCreated: new Counter(
    "pledges_created_total",
    "Total number of pledges created"
  ),
  paymentFailures: new Counter(
    "payment_failures_total",
    "Total number of payment failures"
  ),
  circuitBreakerState: new Gauge(
    "circuit_breaker_state",
    "Circuit breaker state (0=closed, 1=half-open, 2=open)"
  ),
  activeUsers: new Gauge(
    "active_users",
    "Number of active users (approximate)"
  ),
  emailsSent: new Counter(
    "emails_sent_total",
    "Total number of emails sent"
  ),
  externalApiCalls: new Counter(
    "external_api_calls_total",
    "Total external API calls"
  ),
  externalApiDuration: new Histogram(
    "external_api_duration_seconds",
    "External API call duration in seconds"
  ),
  rateLimitHits: new Counter(
    "rate_limit_hits_total",
    "Total rate limit hits"
  ),
  dcWebhookEvents: new Counter(
    "dc_webhook_events_total",
    "Total DivinityCoin webhook events received, by event type"
  ),
};

/**
 * Serialize all metrics to Prometheus text format.
 */
export function serializeMetrics(): string {
  // process.uptime() and process.memoryUsage() are Node.js-only APIs
  // that are not available in the Edge Runtime (middleware). Guard them
  // so the module can be imported from both runtimes.
  const processMetrics: string[] = [];
  if (typeof process.uptime === "function") {
    processMetrics.push(
      `# HELP process_uptime_seconds Process uptime in seconds`,
      `# TYPE process_uptime_seconds gauge`,
      `process_uptime_seconds ${process.uptime()}`,
    );
  }
  if (typeof process.memoryUsage === "function") {
    const mem = process.memoryUsage();
    processMetrics.push(
      `# HELP nodejs_heap_size_bytes Node.js heap size`,
      `# TYPE nodejs_heap_size_bytes gauge`,
      `nodejs_heap_size_bytes{type="used"} ${mem.heapUsed}`,
      `nodejs_heap_size_bytes{type="total"} ${mem.heapTotal}`,
      `nodejs_heap_size_bytes{type="rss"} ${mem.rss}`,
    );
  }

  const appMetrics = Object.values(metrics).map((m) => m.serialize()).filter(Boolean);

  return [...processMetrics, ...appMetrics].join("\n\n") + "\n";
}
