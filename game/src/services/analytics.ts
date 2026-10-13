export type AnalyticsProps = Record<string, string | number | boolean>;

export interface AnalyticsSink {
  send(event: string, props: AnalyticsProps): void;
}

export class ConsoleSink implements AnalyticsSink {
  send(event: string, props: AnalyticsProps): void {
    console.debug('[analytics]', event, props);
  }
}

// 실제 분석 도구(GameAnalytics, Firebase 등)는 AnalyticsSink를 하나 더 만들어 붙이면 된다.
// 이벤트 이름은 docs/ANALYTICS.md 표와 맞춘다.
export class Analytics {
  private sinks: AnalyticsSink[];
  readonly history: Array<{ event: string; props: AnalyticsProps }> = [];

  constructor(sinks: AnalyticsSink[] = []) {
    this.sinks = sinks;
  }

  track(event: string, props: AnalyticsProps = {}): void {
    this.history.push({ event, props });
    if (this.history.length > 200) this.history.shift();
    for (const sink of this.sinks) {
      try {
        sink.send(event, props);
      } catch {
        // 분석 실패로 게임이 멈추면 안 된다.
      }
    }
  }
}
