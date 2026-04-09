package services

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/gariiriana/utt-report-maintenance/backend/core/models"
	"github.com/gariiriana/utt-report-maintenance/backend/core/repositories"
)

type IMaintenanceProgressService interface {
	UpdateProgress(ctx context.Context, id string, actualQty float64, remark string) error
	GetSummary(ctx context.Context, year int, quarter string) (*models.MaintenanceSummary, error)
	ListAll(ctx context.Context, year int, quarter string) ([]models.MaintenanceProgress, error)
	InitializeData(ctx context.Context, data []models.MaintenanceProgress) error
	EndDay(ctx context.Context) error
	CreateProgress(ctx context.Context, progress models.MaintenanceProgress) (string, error)
	DeleteProgress(ctx context.Context, id string) error
}

type maintenanceProgressService struct {
	repo repositories.IMaintenanceProgressRepository
}

func NewMaintenanceProgressService(repo repositories.IMaintenanceProgressRepository) IMaintenanceProgressService {
	return &maintenanceProgressService{repo: repo}
}

func (s *maintenanceProgressService) UpdateProgress(ctx context.Context, id string, actualQty float64, remark string) error {
	doc, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	var progress models.MaintenanceProgress
	if err := doc.DataTo(&progress); err != nil {
		return err
	}

	progress.ActualQty = actualQty
	if progress.PlanQty > 0 {
		progress.ActualPercent = (actualQty / progress.PlanQty) * 100
	}
	progress.Remark = remark
	progress.UpdatedAt = time.Now()

	data := map[string]interface{}{
		"actual_qty":     progress.ActualQty,
		"actual_percent": progress.ActualPercent,
		"remark":         progress.Remark,
		"updated_at":     progress.UpdatedAt,
	}

	return s.repo.Update(ctx, id, data)
}

func (s *maintenanceProgressService) ListAll(ctx context.Context, year int, quarter string) ([]models.MaintenanceProgress, error) {
	docs, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}

	var progress []models.MaintenanceProgress
	for _, doc := range docs {
		var p models.MaintenanceProgress
		if err := doc.DataTo(&p); err != nil {
			return nil, err
		}

		if year > 0 && p.Year != year {
			continue
		}
		if quarter != "" && p.Quarter != quarter {
			continue
		}

		p.ID = doc.Ref.ID
		progress = append(progress, p)
	}

	sort.Slice(progress, func(i, j int) bool {
		if progress[i].Category != progress[j].Category {
			return progress[i].Category < progress[j].Category
		}
		return progress[i].EquipmentName < progress[j].EquipmentName
	})

	return progress, nil
}

func (s *maintenanceProgressService) GetSummary(ctx context.Context, year int, quarter string) (*models.MaintenanceSummary, error) {
	progressList, err := s.ListAll(ctx, year, quarter)
	if err != nil {
		return nil, err
	}

	summaryMap := make(map[string]*models.CategorySummary)
	var totalPlanQty float64
	var totalActualQty float64

	for _, p := range progressList {
		if _, ok := summaryMap[p.Category]; !ok {
			summaryMap[p.Category] = &models.CategorySummary{Category: p.Category}
		}
		summaryMap[p.Category].PlanQty += p.PlanQty
		summaryMap[p.Category].TodayQty += p.ActualQty
		summaryMap[p.Category].YesterdayQty += p.YesterdayQty
		totalPlanQty += p.PlanQty
		totalActualQty += p.ActualQty
	}

	if totalPlanQty == 0 {
		return &models.MaintenanceSummary{}, nil
	}

	var summaries []models.CategorySummary
	for _, cs := range summaryMap {
		cs.WeightPercent = (cs.PlanQty / totalPlanQty) * 100
		if cs.PlanQty > 0 {
			cs.TodayPercent = (cs.TodayQty / cs.PlanQty) * 100
			cs.YesterdayPercent = (cs.YesterdayQty / cs.PlanQty) * 100
		}

		cs.WeightPercent = math.Round(cs.WeightPercent*100) / 100
		cs.TodayPercent = math.Round(cs.TodayPercent*100) / 100
		cs.YesterdayPercent = math.Round(cs.YesterdayPercent*100) / 100

		summaries = append(summaries, *cs)
	}

	var totalYesterdayQty float64
	for _, p := range progressList {
		totalYesterdayQty += p.YesterdayQty
	}

	totalTodayPercent := (totalActualQty / totalPlanQty) * 100
	totalYesterdayPercent := (totalYesterdayQty / totalPlanQty) * 100

	return &models.MaintenanceSummary{
		CategorySummaries:     summaries,
		TotalPlanQty:          totalPlanQty,
		TotalYesterdayQty:     totalYesterdayQty,
		TotalYesterdayPercent: math.Round(totalYesterdayPercent*100) / 100,
		TotalTodayQty:         totalActualQty,
		TotalTodayPercent:     math.Round(totalTodayPercent*100) / 100,
		DailyProgress:         math.Round((totalTodayPercent-totalYesterdayPercent)*100) / 100,
	}, nil
}

func (s *maintenanceProgressService) CreateProgress(ctx context.Context, p models.MaintenanceProgress) (string, error) {
	id := fmt.Sprintf("%s_%s_%d", p.Category, p.EquipmentName, time.Now().Unix())
	p.UpdatedAt = time.Now()
	if p.PlanQty > 0 {
		p.ActualPercent = (p.ActualQty / p.PlanQty) * 100
	}

	data := map[string]interface{}{
		"category":       p.Category,
		"equipment_name": p.EquipmentName,
		"plan_qty":       p.PlanQty,
		"plan_start":     p.PlanStart,
		"plan_finish":    p.PlanFinish,
		"actual_qty":     p.ActualQty,
		"actual_percent": p.ActualPercent,
		"target_qty":     p.TargetQty,
		"target_percent": p.TargetPercent,
		"remark":         p.Remark,
		"year":           p.Year,
		"quarter":        p.Quarter,
		"updated_at":     p.UpdatedAt,
	}

	if err := s.repo.Save(ctx, id, data); err != nil {
		return "", err
	}
	return id, nil
}

func (s *maintenanceProgressService) DeleteProgress(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *maintenanceProgressService) EndDay(ctx context.Context) error {
	progressList, err := s.ListAll(ctx, 0, "")
	if err != nil {
		return err
	}

	for _, p := range progressList {
		data := map[string]interface{}{
			"yesterday_qty":     p.ActualQty,
			"yesterday_percent": p.ActualPercent,
			"updated_at":        time.Now(),
		}
		if err := s.repo.Update(ctx, p.ID, data); err != nil {
			return fmt.Errorf("failed to update record %s: %w", p.ID, err)
		}
	}
	return nil
}

func (s *maintenanceProgressService) InitializeData(ctx context.Context, data []models.MaintenanceProgress) error {
	for _, p := range data {
		id := fmt.Sprintf("%s_%s", p.Category, p.EquipmentName)
		p.UpdatedAt = time.Now()

		mapData := map[string]interface{}{
			"category":       p.Category,
			"equipment_name": p.EquipmentName,
			"plan_qty":       p.PlanQty,
			"plan_start":     p.PlanStart,
			"plan_finish":    p.PlanFinish,
			"actual_qty":     p.ActualQty,
			"actual_percent": p.ActualPercent,
			"target_qty":     p.TargetQty,
			"target_percent": p.TargetPercent,
			"year":           p.Year,
			"quarter":        p.Quarter,
			"updated_at":     p.UpdatedAt,
		}
		if err := s.repo.Save(ctx, id, mapData); err != nil {
			return err
		}
	}
	return nil
}
