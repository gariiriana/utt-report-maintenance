package main

import (
	"context"
	"log"

	"github.com/gariiriana/utt-report-maintenance/backend/core/config"
	"github.com/gariiriana/utt-report-maintenance/backend/core/models"
	"github.com/gariiriana/utt-report-maintenance/backend/core/repositories"
	"github.com/gariiriana/utt-report-maintenance/backend/core/services"
)

func main() {
	config.MustLoadDotEnv("../.env")
	ctx := context.Background()
	firestoreClient, err := config.InitFirestore(ctx)
	if err != nil {
		log.Fatalf("Failed to init firestore: %v", err)
	}
	defer firestoreClient.Close()

	repo := repositories.NewMaintenanceProgressRepository(firestoreClient)
	svc := services.NewMaintenanceProgressService(repo)

	initialData := []models.MaintenanceProgress{

		{Category: "A. ELECTRICAL SYSTEM", EquipmentName: "TRANSFORMATOR", PlanQty: 8, PlanStart: "23-Feb", PlanFinish: "27-Feb", ActualQty: 8, YesterdayQty: 8, Year: 2026, Quarter: "Q1"},
		{Category: "A. ELECTRICAL SYSTEM", EquipmentName: "AUTOMATIC TRANSFER SWITCH (ATS)", PlanQty: 15, PlanStart: "2-Mar", PlanFinish: "6-Mar", ActualQty: 15, YesterdayQty: 15, Year: 2026, Quarter: "Q1"},
		{Category: "A. ELECTRICAL SYSTEM", EquipmentName: "MV & RMU PANEL", PlanQty: 20, PlanStart: "16-Feb", PlanFinish: "23-Feb", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},
		{Category: "A. ELECTRICAL SYSTEM", EquipmentName: "LV PANEL", PlanQty: 7, PlanStart: "23-Feb", PlanFinish: "27-Feb", ActualQty: 7, YesterdayQty: 7, Year: 2026, Quarter: "Q1"},
		{Category: "A. ELECTRICAL SYSTEM", EquipmentName: "PDU PANEL", PlanQty: 52, PlanStart: "13-Feb", PlanFinish: "20-Feb", ActualQty: 52, YesterdayQty: 52, Year: 2026, Quarter: "Q1"},
		{Category: "A. ELECTRICAL SYSTEM", EquipmentName: "LDB & RDB PANEL", PlanQty: 157, PlanStart: "4-Mar", PlanFinish: "13-Mar", ActualQty: 130, YesterdayQty: 130, Year: 2026, Quarter: "Q1"},
		{Category: "A. ELECTRICAL SYSTEM", EquipmentName: "GROUNDING", PlanQty: 175, PlanStart: "16-Mar", PlanFinish: "27-Mar", ActualQty: 152, YesterdayQty: 152, Year: 2026, Quarter: "Q1"},
		{Category: "A. ELECTRICAL SYSTEM", EquipmentName: "LIGHTNING PROTECTION", PlanQty: 119, PlanStart: "9-Feb", PlanFinish: "13-Feb", ActualQty: 111, YesterdayQty: 111, Year: 2026, Quarter: "Q1"},
		{Category: "A. ELECTRICAL SYSTEM", EquipmentName: "UNINTERRUPTIBLE POWER SUPPLY (UPS)", PlanQty: 19, PlanStart: "2-Mar", PlanFinish: "6-Mar", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},
		{Category: "A. ELECTRICAL SYSTEM", EquipmentName: "GENERATOR SET (GENSET)", PlanQty: 6, PlanStart: "16-Feb", PlanFinish: "23-Feb", ActualQty: 6, YesterdayQty: 6, Year: 2026, Quarter: "Q1"},
		{Category: "A. ELECTRICAL SYSTEM", EquipmentName: "LOAD & CAP BANK", PlanQty: 4, PlanStart: "26-Jan", PlanFinish: "30-Jan", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},
		{Category: "A. ELECTRICAL SYSTEM", EquipmentName: "BUSDUCT", PlanQty: 40, PlanStart: "9-Mar", PlanFinish: "13-Mar", ActualQty: 29, YesterdayQty: 29, Year: 2026, Quarter: "Q1"},
		{Category: "A. ELECTRICAL SYSTEM", EquipmentName: "EXHAUST FAN", PlanQty: 14, PlanStart: "26-Jan", PlanFinish: "30-Jan", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},

		{Category: "B. COOLING SYSTEM", EquipmentName: "COOLING TOWER", PlanQty: 3, PlanStart: "18-Feb", PlanFinish: "24-Feb", ActualQty: 3, YesterdayQty: 3, Year: 2026, Quarter: "Q1"},
		{Category: "B. COOLING SYSTEM", EquipmentName: "COOLING PUMP", PlanQty: 12, PlanStart: "9-Mar", PlanFinish: "13-Mar", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},
		{Category: "B. COOLING SYSTEM", EquipmentName: "PHYSICAL COOLING AUTOMATION & TEST TAN", PlanQty: 133, PlanStart: "26-Jan", PlanFinish: "30-Jan", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},
		{Category: "B. COOLING SYSTEM", EquipmentName: "CHILLER", PlanQty: 3, PlanStart: "18-Feb", PlanFinish: "24-Feb", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},
		{Category: "B. COOLING SYSTEM", EquipmentName: "CRAC", PlanQty: 40, PlanStart: "25-Mar", PlanFinish: "31-Mar", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},
		{Category: "B. COOLING SYSTEM", EquipmentName: "FCU", PlanQty: 25, PlanStart: "5-Jan", PlanFinish: "14-Jan", ActualQty: 25, YesterdayQty: 25, Year: 2026, Quarter: "Q1"},
		{Category: "B. COOLING SYSTEM", EquipmentName: "VRV", PlanQty: 126, PlanStart: "16-Feb", PlanFinish: "27-Feb", ActualQty: 106, YesterdayQty: 106, Year: 2026, Quarter: "Q1"},
		{Category: "B. COOLING SYSTEM", EquipmentName: "PAHU", PlanQty: 12, PlanStart: "27-Jan", PlanFinish: "30-Jan", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},
		{Category: "B. COOLING SYSTEM", EquipmentName: "SPLITWALL", PlanQty: 11, PlanStart: "24-Feb", PlanFinish: "27-Feb", ActualQty: 8, YesterdayQty: 8, Year: 2026, Quarter: "Q1"},
		{Category: "B. COOLING SYSTEM", EquipmentName: "Presuraziation & Degassing", PlanQty: 6, PlanStart: "25-Mar", PlanFinish: "27-Mar", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},

		{Category: "C. FIRE SYSTEM", EquipmentName: "FSS", PlanQty: 942, PlanStart: "16-Feb", PlanFinish: "27-Feb", ActualQty: 756, YesterdayQty: 756, Year: 2026, Quarter: "Q1"},
		{Category: "C. FIRE SYSTEM", EquipmentName: "Hydrant System", PlanQty: 167, PlanStart: "19-Jan", PlanFinish: "23-Jan", ActualQty: 121, YesterdayQty: 121, Year: 2026, Quarter: "Q1"},
		{Category: "C. FIRE SYSTEM", EquipmentName: "PREACTION", PlanQty: 7, PlanStart: "2-Feb", PlanFinish: "6-Feb", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},

		{Category: "D. FUEL SYSTEM", EquipmentName: "Fuel Pump", PlanQty: 13, PlanStart: "16-Feb", PlanFinish: "23-Feb", ActualQty: 13, YesterdayQty: 13, Year: 2026, Quarter: "Q1"},
		{Category: "D. FUEL SYSTEM", EquipmentName: "FUEL TANK", PlanQty: 14, PlanStart: "16-Feb", PlanFinish: "23-Feb", ActualQty: 14, YesterdayQty: 14, Year: 2026, Quarter: "Q1"},

		{Category: "E. PESAWAT ANGKUT", EquipmentName: "Lift Units", PlanQty: 7, PlanStart: "8-Jan", PlanFinish: "15-Jan", ActualQty: 0.24, YesterdayQty: 0.24, Year: 2026, Quarter: "Q1"},
		{Category: "E. PESAWAT ANGKUT", EquipmentName: "DOCK LEVELLER", PlanQty: 3, PlanStart: "12-Jan", PlanFinish: "15-Jan", ActualQty: 3, YesterdayQty: 3, Year: 2026, Quarter: "Q1"},

		{Category: "F. LEAK DETECTION", EquipmentName: "Water Leak", PlanQty: 75, PlanStart: "5-Jan", PlanFinish: "8-Jan", ActualQty: 75, YesterdayQty: 75, Year: 2026, Quarter: "Q1"},
		{Category: "F. LEAK DETECTION", EquipmentName: "FUEL LEAK DETECTION", PlanQty: 40, PlanStart: "12-Jan", PlanFinish: "19-Jan", ActualQty: 40, YesterdayQty: 40, Year: 2026, Quarter: "Q1"},

		{Category: "G. PLUMBING SYSTEM", EquipmentName: "STP", PlanQty: 4, PlanStart: "23-Feb", PlanFinish: "25-Feb", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},
		{Category: "G. PLUMBING SYSTEM", EquipmentName: "WATER TREATMENT", PlanQty: 1, PlanStart: "5-Jan", PlanFinish: "9-Jan", ActualQty: 2.58, YesterdayQty: 2.58, Year: 2026, Quarter: "Q1"},
		{Category: "G. PLUMBING SYSTEM", EquipmentName: "PUMP", PlanQty: 33, PlanStart: "10-Mar", PlanFinish: "14-Mar", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},

		{Category: "H. GATE & DOOR", EquipmentName: "Gate", PlanQty: 7, PlanStart: "26-Jan", PlanFinish: "30-Jan", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},
		{Category: "H. GATE & DOOR", EquipmentName: "Road Blocker", PlanQty: 0, PlanStart: "-", PlanFinish: "-", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},
		{Category: "H. GATE & DOOR", EquipmentName: "DOOR", PlanQty: 14, PlanStart: "12-Jan", PlanFinish: "15-Jan", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},
		{Category: "H. GATE & DOOR", EquipmentName: "X-RAY", PlanQty: 6, PlanStart: "12-Jan", PlanFinish: "13-Jan", ActualQty: 0, YesterdayQty: 0, Year: 2026, Quarter: "Q1"},

		{Category: "I. LIGHTING SYSTEM", EquipmentName: "PJU & ALL LIGHTING", PlanQty: 2750, PlanStart: "19-Jan", PlanFinish: "30-Jan", ActualQty: 2435, YesterdayQty: 2372, Year: 2026, Quarter: "Q1"},
	}

	log.Printf("Initializing %d maintenance progress records...", len(initialData))
	if err := svc.InitializeData(ctx, initialData); err != nil {
		log.Fatalf("Failed to initialize data: %v", err)
	}
	log.Println("Data initialized successfully!")
}
