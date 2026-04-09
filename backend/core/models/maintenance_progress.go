package models

import "time"

type MaintenanceProgress struct {
	ID            string    `json:"id" firestore:"id"`
	Category      string    `json:"category" firestore:"category"`
	EquipmentName string    `json:"equipment_name" firestore:"equipment_name"`
	PlanQty       float64   `json:"plan_qty" firestore:"plan_qty"`
	PlanStart     string    `json:"plan_start" firestore:"plan_start"`
	PlanFinish    string    `json:"plan_finish" firestore:"plan_finish"`
	MOPDate       string    `json:"mop_date,omitempty" firestore:"mop_date,omitempty"`
	NoticedDate   string    `json:"noticed_date,omitempty" firestore:"noticed_date,omitempty"`
	ActualStart   string    `json:"actual_start,omitempty" firestore:"actual_start,omitempty"`
	ActualFinish  string    `json:"actual_finish,omitempty" firestore:"actual_finish,omitempty"`
	ActualQty     float64   `json:"actual_qty" firestore:"actual_qty"`
	ActualPercent float64   `json:"actual_percent" firestore:"actual_percent"`
	TargetQty     float64   `json:"target_qty" firestore:"target_qty"`
	TargetPercent float64   `json:"target_percent" firestore:"target_percent"`
	YesterdayQty  float64   `json:"yesterday_qty" firestore:"yesterday_qty"`
	YesterdayPercent float64 `json:"yesterday_percent" firestore:"yesterday_percent"`
	Remark        string    `json:"remark,omitempty" firestore:"remark,omitempty"`
	Year          int       `json:"year" firestore:"year"`
	Quarter       string    `json:"quarter" firestore:"quarter"`
	UpdatedAt     time.Time `json:"updated_at" firestore:"updated_at"`
}

type CategorySummary struct {
	Category        string  `json:"category"`
	PlanQty         float64 `json:"plan_qty"`
	WeightPercent   float64 `json:"weight_percent"`
	YesterdayQty    float64 `json:"yesterday_qty"`
	YesterdayPercent float64 `json:"yesterday_percent"`
	TodayQty        float64 `json:"today_qty"`
	TodayPercent    float64 `json:"today_percent"`
}

type MaintenanceSummary struct {
	CategorySummaries []CategorySummary `json:"category_summaries"`
	TotalPlanQty      float64           `json:"total_plan_qty"`
	TotalYesterdayQty float64           `json:"total_yesterday_qty"`
	TotalYesterdayPercent float64       `json:"total_yesterday_percent"`
	TotalTodayQty     float64           `json:"total_today_qty"`
	TotalTodayPercent float64           `json:"total_today_percent"`
	DailyProgress     float64           `json:"daily_progress"`
}
