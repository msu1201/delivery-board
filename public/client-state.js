export function safeWebURL(ref) {
  try {
    if (!/^https?:\/\//i.test(ref)) return null;
    const u = new URL(ref);
    if (!["https:", "http:"].includes(u.protocol) || u.username || u.password)
      return null;
    return u.href;
  } catch {
    return null;
  }
}
export class RefreshController {
  constructor(fetcher, apply) {
    this.fetcher = fetcher;
    this.apply = apply;
    this.generation = 0;
    this.snapshot = null;
  }
  async refresh() {
    const generation = ++this.generation;
    try {
      const incoming = await this.fetcher();
      if (generation !== this.generation) return;
      if (incoming.stale && this.snapshot?.graph)
        this.snapshot = {
          ...this.snapshot,
          stale: true,
          error: incoming.error,
          attemptedAt: incoming.attemptedAt,
        };
      else this.snapshot = incoming;
    } catch (e) {
      if (generation !== this.generation) return;
      this.snapshot = {
        ...(this.snapshot || { graph: null, freshness: null }),
        stale: true,
        error: e.message,
        attemptedAt: new Date().toISOString(),
      };
    }
    this.apply(this.snapshot);
  }
}
export class LatestOnly {
  constructor() {
    this.generation = 0;
  }
  async run(work, apply) {
    const generation = ++this.generation;
    let result, error;
    try {
      result = await work();
    } catch (e) {
      error = e;
    }
    if (generation === this.generation) apply(error, result);
  }
}
export function deliveryState(status) {
  return status === "delivered"
    ? "delivered"
    : ["pending_integration", "pending", "not_delivered"].includes(status)
      ? "pending"
      : "unknown";
}

// Current recorded CI requirement/result, never inferred from historical observations.
export function ciSummary(value) {
  const status = value && typeof value === "object" ? value.status : null;
  const labels = {
    waived: "用户已豁免 · 未运行（不计为通过）",
    not_run: "未运行（来源记录）",
    passed: "通过（来源记录，未重查）",
    failed: "失败（来源记录，未重查）",
    required: "仍要求 CI · 结果未知",
    unknown: "未知 / 未记录",
  };
  return {
    label:
      labels[status] ||
      (value == null ? labels.unknown : "未分类的 CI 记录 · 查看原始记录"),
    passed: status === "passed",
    waived: status === "waived",
  };
}
