/**
 * Circuit Breaker for External API Calls
 * Prevents cascading failures when external services (Stripe, SendGrid) are down.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is down, requests fail fast without calling the service
 * - HALF_OPEN: After cooldown, allow one test request to check if service recovered
 *
 * Usage:
 *   import { circuitBreaker } from "@/lib/circuit-breaker";
 *
 *   const result = await circuitBreaker.execute("stripe", async () => {
 *     return await stripe.paymentIntents.create({ ... });
 *   });
 */

import { logger } from "@/lib/logger";

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitConfig {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Milliseconds to wait before trying again (half-open) */
  cooldownMs: number;
  /** Milliseconds window for counting failures */
  failureWindowMs: number;
}

interface CircuitRecord {
  state: CircuitState;
  failures: number;
  lastFailureAt: number;
  openedAt: number;
  successCount: number;
}

const DEFAULT_CONFIG: CircuitConfig = {
  failureThreshold: 5,
  cooldownMs: 30_000, // 30 seconds
  failureWindowMs: 60_000, // 1 minute
};

const SERVICE_CONFIGS: Record<string, Partial<CircuitConfig>> = {
  stripe: { failureThreshold: 5, cooldownMs: 30_000 },
  sendgrid: { failureThreshold: 3, cooldownMs: 60_000 },
  mailgun: { failureThreshold: 3, cooldownMs: 60_000 },
  r2: { failureThreshold: 5, cooldownMs: 15_000 },
};

class CircuitBreaker {
  private circuits = new Map<string, CircuitRecord>();

  private getConfig(service: string): CircuitConfig {
    return { ...DEFAULT_CONFIG, ...(SERVICE_CONFIGS[service] || {}) };
  }

  private getCircuit(service: string): CircuitRecord {
    if (!this.circuits.has(service)) {
      this.circuits.set(service, {
        state: "CLOSED",
        failures: 0,
        lastFailureAt: 0,
        openedAt: 0,
        successCount: 0,
      });
    }
    return this.circuits.get(service)!;
  }

  /**
   * Execute a function with circuit breaker protection.
   * Throws CircuitOpenError if the circuit is open.
   */
  async execute<T>(service: string, fn: () => Promise<T>): Promise<T> {
    const circuit = this.getCircuit(service);
    const config = this.getConfig(service);
    const now = Date.now();

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (circuit.state === "OPEN") {
      if (now - circuit.openedAt >= config.cooldownMs) {
        circuit.state = "HALF_OPEN";
        logger.info({ service }, "Circuit breaker half-open, testing service");
      } else {
        const retryAfterMs = config.cooldownMs - (now - circuit.openedAt);
        throw new CircuitOpenError(service, retryAfterMs);
      }
    }

    try {
      const result = await fn();
      this.onSuccess(service);
      return result;
    } catch (error) {
      this.onFailure(service, error);
      throw error;
    }
  }

  private onSuccess(service: string): void {
    const circuit = this.getCircuit(service);

    if (circuit.state === "HALF_OPEN") {
      logger.info({ service }, "Circuit breaker closed, service recovered");
    }

    circuit.state = "CLOSED";
    circuit.failures = 0;
    circuit.successCount++;
  }

  private onFailure(service: string, error: unknown): void {
    const circuit = this.getCircuit(service);
    const config = this.getConfig(service);
    const now = Date.now();

    // Reset failure count if outside the window
    if (now - circuit.lastFailureAt > config.failureWindowMs) {
      circuit.failures = 0;
    }

    circuit.failures++;
    circuit.lastFailureAt = now;

    if (circuit.state === "HALF_OPEN") {
      // Test request failed, go back to OPEN
      circuit.state = "OPEN";
      circuit.openedAt = now;
      logger.warn({ service, err: error instanceof Error ? error.message : String(error) },
        "Circuit breaker re-opened, service still down");
    } else if (circuit.failures >= config.failureThreshold) {
      circuit.state = "OPEN";
      circuit.openedAt = now;
      logger.error(
        { service, failures: circuit.failures, threshold: config.failureThreshold },
        "Circuit breaker opened"
      );
    }
  }

  /**
   * Get the current state of a circuit (for health checks / metrics).
   */
  getState(service: string): { state: CircuitState; failures: number } {
    const circuit = this.getCircuit(service);
    return { state: circuit.state, failures: circuit.failures };
  }

  /**
   * Get states of all tracked circuits.
   */
  getAllStates(): Record<string, { state: CircuitState; failures: number }> {
    const states: Record<string, { state: CircuitState; failures: number }> = {};
    for (const [service, circuit] of this.circuits) {
      states[service] = { state: circuit.state, failures: circuit.failures };
    }
    return states;
  }

  /**
   * Reset a circuit (for admin use).
   */
  reset(service: string): void {
    this.circuits.delete(service);
    logger.info({ service }, "Circuit breaker manually reset");
  }
}

export class CircuitOpenError extends Error {
  public readonly service: string;
  public readonly retryAfterMs: number;

  constructor(service: string, retryAfterMs: number) {
    super(`Circuit breaker open for ${service}. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`);
    this.name = "CircuitOpenError";
    this.service = service;
    this.retryAfterMs = retryAfterMs;
  }
}

// Singleton instance
export const circuitBreaker = new CircuitBreaker();
