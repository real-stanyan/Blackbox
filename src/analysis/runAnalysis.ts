// 行程报告编排:落盘后自动调用;无 key/失败 = 留「未分析」,TripDetail 可手动重试。
import { TripRecord } from '../data/types';
import { analyzeTrip } from './minimax';
import { verdictFromTrip } from './verdict';
import { getApiKey } from '../data/settingsStore';
import { updateTripReport } from '../data/tripStore';
import { refreshOutlook } from '../data/outlookStore';
import { notifyReportReady } from '../notifications/notify';
import { tripToDisplay } from '../data/display';

export async function runAnalysis(record: TripRecord): Promise<void> {
  try {
    const key = await getApiKey();
    if (!key) {
      console.log('[analysis] 无 API key,留未分析');
      return;
    }
    const report = await analyzeTrip(record.features, key);
    await updateTripReport(record.id, report, verdictFromTrip(record.features, report));
    void notifyReportReady(`${tripToDisplay(record).title} · ${report.summary.slice(0, 40)}`);
    void refreshOutlook();
  } catch (e) {
    console.log(`[analysis] 行程 ${record.id} 分析失败(留未分析): ${e}`);
  }
}
