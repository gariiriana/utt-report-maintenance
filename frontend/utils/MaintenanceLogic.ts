export interface MaintenanceProgress {
  id: string;
  category: string;
  equipment_name: string;
  plan_qty: number;
  yesterday_qty?: number;
  actual_qty: number;
  remark: string;
  plan_start?: string;
  plan_finish?: string;
  year?: number;
  quarter?: string;
}

export interface CategorySummary {
  category: string;
  plan_qty: number;
  weight_percent: number;
  yesterday_qty: number;
  yesterday_percent: number;
  today_qty: number;
  today_percent: number;
}

export interface MaintenanceSummary {
  category_summaries: CategorySummary[];
  total_plan_qty: number;
  total_yesterday_qty: number;
  total_yesterday_percent: number;
  total_today_qty: number;
  total_today_percent: number;
  daily_progress: number;
}

/**
 * Replicates the calculations from the Go backend for the dashboard summary.
 */
export function calculateMaintenanceSummary(activities: MaintenanceProgress[]): MaintenanceSummary {
  if (!activities || activities.length === 0) {
    return {
      category_summaries: [],
      total_plan_qty: 0,
      total_yesterday_qty: 0,
      total_yesterday_percent: 0,
      total_today_qty: 0,
      total_today_percent: 0,
      daily_progress: 0
    };
  }

  const result: MaintenanceSummary = {
    category_summaries: [],
    total_plan_qty: 0,
    total_yesterday_qty: 0,
    total_yesterday_percent: 0,
    total_today_qty: 0,
    total_today_percent: 0,
    daily_progress: 0
  };

  // Group by category
  const groups: Record<string, MaintenanceProgress[]> = {};
  activities.forEach(a => {
    if (!groups[a.category]) groups[a.category] = [];
    groups[a.category].push(a);
    
    result.total_plan_qty += a.plan_qty;
    result.total_yesterday_qty += a.yesterday_qty || 0;
    result.total_today_qty += a.actual_qty;
  });

  // Calculate totals
  if (result.total_plan_qty > 0) {
    result.total_yesterday_percent = Math.round((result.total_yesterday_qty / result.total_plan_qty) * 10000) / 100;
    result.total_today_percent = Math.round((result.total_today_qty / result.total_plan_qty) * 10000) / 100;
  }
  result.daily_progress = Math.round((result.total_today_percent - result.total_yesterday_percent) * 100) / 100;

  // Calculate category summaries
  Object.keys(groups).sort().forEach(catName => {
    const catItems = groups[catName];
    const catPlan = catItems.reduce((sum, item) => sum + item.plan_qty, 0);
    const catYesterday = catItems.reduce((sum, item) => sum + (item.yesterday_qty || 0), 0);
    const catToday = catItems.reduce((sum, item) => sum + item.actual_qty, 0);

    result.category_summaries.push({
      category: catName,
      plan_qty: catPlan,
      weight_percent: result.total_plan_qty > 0 ? Math.round((catPlan / result.total_plan_qty) * 10000) / 100 : 0,
      yesterday_qty: catYesterday,
      yesterday_percent: catPlan > 0 ? Math.round((catYesterday / catPlan) * 10000) / 100 : 0,
      today_qty: catToday,
      today_percent: catPlan > 0 ? Math.round((catToday / catPlan) * 10000) / 100 : 0
    });
  });

  return result;
}
