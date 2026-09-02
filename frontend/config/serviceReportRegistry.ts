// ============================================================================
// FILE: frontend/config/serviceReportRegistry.ts
// Deskripsi: Master Registry Konfigurasi 23 Akun Engineer Service Report
// ============================================================================

import { VisualCheckItem, UniversalCustomerInfo, UniversalTimeSpent, UniversalOperationStatus } from '@/types/serviceReportTypes';

export interface ServiceReportConfigItem {
  key: string;
  number: number;
  name: string;
  email: string;
  defaultCustomerInfo: UniversalCustomerInfo;
  defaultTimeSpent: UniversalTimeSpent;
  defaultOperationStatus: UniversalOperationStatus;
  checklistTemplate: VisualCheckItem[];
}

export const SERVICE_REPORT_MASTER_REGISTRY: Record<string, ServiceReportConfigItem> = {
  "ats@gmail.com": {
    "key": "ats",
    "number": 1,
    "name": "ATS (Automatic Transfer Switch)",
    "email": "ats@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "ATS (Automatic Transfer Switch)",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "a.",
        "activity": "Inspection unsafe action and unsafe condition before start activity maintenance",
        "parameter": "Good Condition",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Take a photo before action activity to indicate the initial condition of the equipment panel",
        "parameter": "Information before activity clear",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Check cable grounding to act know voltage in body panel. Measurment current and ressistance using claim earth. Ensure grounding good connection",
        "parameter": "Tight & Good connection",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Inspection of support levelness used water pass to analysis positioning support panel",
        "parameter": "Horizontally aligned, not tilted.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Check and inspection visual of panels for paint damage and signs of corrosion",
        "parameter": "No peeling,No fading &No cracking",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "Check function of enclosure (cover panel, doors, form covers, automatic shutters, screws, keys). Cleaning using vacuum cleaner",
        "parameter": "Physical condition intact, no cracks or dents",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "g.",
        "activity": "Inspection visual and check function of power meters/controller compare with actual measurement, ensure by visual termination good connection",
        "parameter": "the display is lit up and clearly legible.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "h.",
        "activity": "Check lamp and indicator function by visual",
        "parameter": "Not loose, not burnt",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "i.",
        "activity": "Inspection of control wiring, relays, power supply units, timers, etc.",
        "parameter": "There are no chipped, burnt, or worn wires.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "j.",
        "activity": "Inspection and check visual of auxiliary connections, ensure termination good connection using thermal imager",
        "parameter": "No looseness, no rust or corrosion.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "k.",
        "activity": "Inspection electronic surge protection is installed, control circuit fuse rating, and continuity",
        "parameter": "No rust",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "l.",
        "activity": "Check condition connection cabel using thermal imager if the found anomali like a hot spot inded connection.",
        "parameter": "No hotspots found, stable temperature, good connection",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "m.",
        "activity": "Cleaning panel ATS used vacum cleaner and apply sanpoly to finish it",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "n.",
        "activity": "Inspection visual busbar and isolators, make sure condition isolator from cracking, signs of heating with thermal imager. Cleaning using vacuum cleaner",
        "parameter": "No rust or oxidation on the surface.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "o.",
        "activity": "Inspection visual of CT connections and make sure good connection no miss connection. Cleaning using vacuum cleaner",
        "parameter": "Good connection",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "p.",
        "activity": "Inspection visual from downstream power connections (connecting pads, cable mechanical strength)",
        "parameter": "Good connection",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "mv@gmail.com": {
    "key": "mv",
    "number": 2,
    "name": "Panel MV & RMU",
    "email": "mv@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "Panel MV & RMU",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "a.",
        "activity": "Inspection of enclosure (chalking, cracking, signs of heating)",
        "parameter": "No scorch marks can indicate overheating",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Inspection of auxilliaries contacts (signaling contacts, coils, wiring)",
        "parameter": "The auxiliary contacts are free from",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Inspection and completion taging or labeling",
        "parameter": "No faded, damaged or missing tags/labels",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Inspections of wiring connections",
        "parameter": "All terminals and wiring connectors are physically checked, nothing is loose.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Inspection of the position indicators and signalling micro switches",
        "parameter": "Not loose and Not corroded.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Inspection of locking and interlocking machanism function",
        "parameter": "can't open the panel because it's still energized",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Inspection of withdrawal mechanism",
        "parameter": "There is no wear, rust, or looseness on the slide rail",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Inspections of the shutters",
        "parameter": "There is no damage, deformation or wear to",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Inspection of protection measured values, alarms,",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Inspection of connexions",
        "parameter": "No loose or corroded connections.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Inspection of cabling",
        "parameter": "properly installed, tight, and free from",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Inspection of protection settings",
        "parameter": "protection system is working properly",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Cleaning of enclosure",
        "parameter": "The outside and inside of the enclosure are free from dust,",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Checking of connexions",
        "parameter": "Terminals are free from dirt, dust or oxidation",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Cleaning Contactor Compartement",
        "parameter": "Compartment free from dust, dirt",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Cleaning and greasing of shutter locking system",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Cleaning Circuit breaker",
        "parameter": "No dirt or dust blocking the components, circuit breaker",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Cleaning of resin bodies",
        "parameter": "Free from dust, dirt, oil, mold, or carbon stains",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "grounding@gmail.com": {
    "key": "grounding",
    "number": 3,
    "name": "Grounding System",
    "email": "grounding@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "Grounding System",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "a.",
        "activity": "Inspection ground pit box is clean and not covered in soil",
        "parameter": "GPB Clean Not Covered in soil",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "inspection grounding rod not covered in soil and testing can be done",
        "parameter": "Grounding rod non covered in soil",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Inspection termination tightness / grounding clamp / cadweld in good conditions",
        "parameter": "Not corrosive, oxidized and loose",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Inspection grounding bar and termination good condition (not corrosive, oxidized)",
        "parameter": "Grounding bar not corrosive,",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Inspection all termination good tightness",
        "parameter": "Tight",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "Inspection terminal lugs are in good condition and not loose",
        "parameter": "Not",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "g.",
        "activity": "Inspect cable are in good condition (not damaged & broken off)",
        "parameter": "cable not damage and broken off",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "h.",
        "activity": "Inspect cover and ID on each GPB",
        "parameter": "ensure ID readable",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Cleaning ground pit box & enviroment",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Cleaning grounding bar & termination",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Cleaning lighting counter",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Cleaning the cable connection area and add protection",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Meassurement of resistance on GTB (distribution) & GPB (grounding rod)",
        "parameter": "0.5 to 5 ohms id the recommended value for commercial and industrial applications",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "crac@gmail.com": {
    "key": "crac",
    "number": 4,
    "name": "CRAC Unit",
    "email": "crac@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "CRAC Unit",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "1",
        "activity": "Indoor",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Inspection & checked of the CRAC enclosure cleaness from dust, damaged and tightening of bolting / screw",
        "parameter": "Enclosure is Clean from dust",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Inspection & checked the air filter cleaness from dust, damaged and density of filter",
        "parameter": "The Air Filter Clean From Dust",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Inspection & checked of tightening of fitting pipe and valve on pipe inlet and outlet using pipe wrench / torque wrench.",
        "parameter": "The Installation of pipes and valves is tight",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Inspect & checked the evaporator cleaness from dust, moss, leakage and damaged",
        "parameter": "Evaporator Clean From Dust",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Inspect & checked of the valve in good condition with check of water flow and pressure",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "Inspect & checked the EC fan / indoor fan in good condition with check condition of bearing, support,blade, ect",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "g.",
        "activity": "Inspection & check electrical control (power supply, contactor, surge arrester, breaker, fuse) with multi tester and setting the HMI until electrical control looks like it’s working normally",
        "parameter": "Hmi is functioning normally",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "h.",
        "activity": "Inspect & check the heater with check ampere work heater following spesification fabric",
        "parameter": "The heater amperage is still within",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "i.",
        "activity": "Inspect & check the water leakage sensor with visual not damaged, test water drip sensor normaly working or not",
        "parameter": "The water leakage sensor not damaged",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "j.",
        "activity": "Inspect & check air flow obstruction or air flow blocked with check filter clogging / differential pressure sensor not alarm “loss of air flow",
        "parameter": "Air Flow no Blocked",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "k.",
        "activity": "Inspect & check drain pipe with  check no water leak found, open the fitting / jointer pipe for check no blocked water found",
        "parameter": "the fitting / jointer pipe no blocked water found",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.1.",
        "activity": "Indoor",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Cleaning of the CRAC enclosure cleaness using duster & vacuum cleaner from dust & foreign material",
        "parameter": "Enclosure is Clean from dust",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Cleaning the air filter cleaness using water steam cleaner machine in outdoor,",
        "parameter": "Filter Clean from dust",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Cleaning of the flushing and drain pipes of drain tank using vacuum cleaner until no blocked water.",
        "parameter": "No blocked water",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Cleaning the humidifier pan and float switch using vacuum cleaner for cleaning water and moss",
        "parameter": "The humidifier pan and float switch",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Cleaning the evaporator using brush and vacuum cleaner for cleaning water and moss",
        "parameter": "Evaporator Clean From Dust",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "Cleaning the EC fan using duster and vacuum cleaner for cleaning dust",
        "parameter": "The EC Fan Clean from Dust",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "g.",
        "activity": "Cleaning the return air grille using duster and vacuum cleaner for cleaning dust",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "h.",
        "activity": "Cleaning the strainer using water steam cleaner machin in outdoor for cleaning moss and no blocked water",
        "parameter": "Clean and No blocked",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "vrv@gmail.com": {
    "key": "vrv",
    "number": 5,
    "name": "VRV System",
    "email": "vrv@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "VRV System",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "a.",
        "activity": "Inspection unsafe action and unsafe condition before start activity",
        "parameter": "Safe & Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Visual inspection of physical body, paint, and corrosion",
        "parameter": "No damage / clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Check wiring connection, tightness, and termination",
        "parameter": "Tight & intact",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Check indicator lamps, display, and controller status",
        "parameter": "Normal display",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Cleaning unit and surrounding area using vacuum cleaner / cloth",
        "parameter": "Clean & tidy",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "lift@gmail.com": {
    "key": "lift",
    "number": 6,
    "name": "Lift",
    "email": "lift@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "Lift",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "1.",
        "activity": "Machine Room",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "2",
        "activity": "Lift Shaft",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "3",
        "activity": "Lift Cabin (Car)",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "4",
        "activity": "Door Cars / Cabin",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "5",
        "activity": "Exterior Component",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Cleaning Wall cabin and panel Cabin",
        "parameter": "Clean & Clear",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Cleaning Floor",
        "parameter": "Clean & Clear",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Cleaning lighting fixtures",
        "parameter": "Clean & Clear",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Cleaning Mirror (If Present)",
        "parameter": "Clean & Clear",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Cleaning Control Panel",
        "parameter": "Clean & Clear",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "Cleaning Ventilation Grills",
        "parameter": "Clean & Clear",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "g.",
        "activity": "Cleaning Track",
        "parameter": "Clean & Clear",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "h.",
        "activity": "Cleaning Call Button dan Lift Button",
        "parameter": "Clean & Clear",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "i.",
        "activity": "Cleaning indicator and display",
        "parameter": "Clean & Clear",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "h.",
        "activity": "Cleaning landing door",
        "parameter": "Clean & Clear",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Measuring input power supply",
        "parameter": "Output voltage in range +5% -10%,",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Measuring Voltage Battery with battery tester",
        "parameter": "Output voltage in range +5% -10%,",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "xray@gmail.com": {
    "key": "xray",
    "number": 7,
    "name": "X-Ray Machine",
    "email": "xray@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "X-Ray Machine",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "a.",
        "activity": "Inspection unsafe action and unsafe condition before start activity",
        "parameter": "No Hazard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Take a photo before action activity",
        "parameter": "Dokumentasi Real Time",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Inspection visual with cable, connector socket and take a photo",
        "parameter": "Not Disconnect",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Inspection power supply unit, modul control and check supply voltage and take a photo",
        "parameter": "220 VAC",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Tightenees all connection cable in terminal cable, terminal breaker and all mounting nut and take a photo",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "Check visual generator x-ray, look at the replacement history and take a photo",
        "parameter": "No Demage",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "g.",
        "activity": "Check the function of the engine drive motor, provide lubricant and take a photo",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "h.",
        "activity": "Check software X-ray to configuration system, setting (if necessary), relay, etc and take a photo",
        "parameter": "Sinkron",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "i.",
        "activity": "Check radiation leak with instrument Radiation Detector",
        "parameter": "No leak radiation",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "j.",
        "activity": "Check image scanning result in display monitor, ensure function machine normal oprational and take a photo",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Cleaning box control machine X-Ray using vacuum cleaner and apply sanpoly to finish it",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Cleaning, remove object from top, indeed of controller",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Cleaning and remove object from top of controller or in the machine for object",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "pju@gmail.com": {
    "key": "pju",
    "number": 8,
    "name": "PJU & Taman",
    "email": "pju@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "PJU & Taman",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "a.",
        "activity": "Inspection visual of lamps",
        "parameter": "Installed",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Inspection all lighting fixtures regularly to ensure they are in good working order",
        "parameter": "Normal function",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Inspection wiring and connections to prevent electrical problems",
        "parameter": "Connection is well established",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Inspection lamps with transformers, control gear, and other accessories",
        "parameter": "Not damaged",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Inspection wiring, screws, gaskets, and exterior light hardware",
        "parameter": "Connection is well established",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "Make sure to use lights with the same color temperature",
        "parameter": "Normal function",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "g.",
        "activity": "Make sure every connection on the lamp is well connected and not easily separated.",
        "parameter": "Connection is well established",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "h.",
        "activity": "battry check on solar street lighting",
        "parameter": "24 VDC - 27 VDC",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "i.",
        "activity": "Check the RL OPTICA P80 + Soalar Panel C2 to make sure it is not dirty and functions normally.",
        "parameter": "Normal function",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "j.",
        "activity": "check solar controller carger",
        "parameter": "30 VDC - 40 VDC",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "k.",
        "activity": "check any water leak indication",
        "parameter": "Connection is well established",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "l.",
        "activity": "check light sensor",
        "parameter": "Normal function",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "cleaning lamp house or lamp box",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "cleaning light poles for street lighting and garden lights",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "cleaning the lamp cover glass to make the lamp light brighter",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "cleaning the cable connection area and add protection",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "cleaning the solar panel area",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "cleaning the control panel",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "g.",
        "activity": "battry cleaning",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "h.",
        "activity": "cleaning on the sensor",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "i.",
        "activity": "cleaning light control panel",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "genset@gmail.com": {
    "key": "genset",
    "number": 10,
    "name": "Genset (Generator)",
    "email": "genset@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "Genset (Generator)",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "a.",
        "activity": "Inspection of display unit Control Genset, make sure display is in good condition, then isolate system control with manual position selector switch and make sure genset already isolate before PM activity",
        "parameter": "Display unit normal, selector switch set to manual, control system isolated, genset confirmed isolated before PM activity.”",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "The team DME must be standby in the location LV panel  distribution power room, Genset under maintenance  and the team DME must be standby in the Power Room  (1F-MAIN DC PANEL). if the any issue PLN black out us the team must be action roll back plan",
        "parameter": "Manual close ACB in power room, voltage normal",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Check level oil and condition using dip stickand inspection  leaked oil in engine generator with deep stick",
        "parameter": "Oil in normal level",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Check the radiator water level and leaks in the pipes",
        "parameter": "The radiator water level is sufficient and does not decrease between the min/max marks.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "General cleaning body genset using a vacuum and a brush, and applying a metal cleaning fluid such as Sanpoly to the generator body and ensure that the area around the generator is free of debris or objects that could interfere with its operational function",
        "parameter": "Unit Genset clean and clear",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "g.",
        "activity": "Check air filter with open cover air filter, take out filter a",
        "parameter": "Clean filters, no blockages",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "h.",
        "activity": "Inspection battery existing and battery backup",
        "parameter": "Clean and clear",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "i.",
        "activity": "Inspect the alternator, terminal block, and fuses (use a multi tester)",
        "parameter": "Clean and clear",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "j.",
        "activity": "Checking and Thigtening Torque installation and cable  connection cable power genset",
        "parameter": "Marker nut good condition, no moving and termination tight",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "k.",
        "activity": "Check fuel system in the unit genset",
        "parameter": "Valve operates smoothly,Valve position is in accordance",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "l.",
        "activity": "Checking of Function Starter with ensure the termination connection no loss and observe when conducting generator set running tests",
        "parameter": "Stater good function",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "m.",
        "activity": "Checking of Function Heater",
        "parameter": "Heater good condition with function and temperature good",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "n.",
        "activity": "Checking Bearing of Fan Radiator, Water Pump, Rotor Shaft with inspection general when the generator is running, ensure that there are no unusual noises caused by abnormal bearing noise.",
        "parameter": "No over noise indication bearing",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "o.",
        "activity": "Verify the position and function of the daily tank inlet/outlet valve",
        "parameter": "System daily tank good function",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "p.",
        "activity": "Visually check the control modules on the PKG and APM panels.",
        "parameter": "Generator normal operation, no alarm",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Clean the engine, hoses, accessories, radiator fan, air ducts, air filter, fuel inlet filter, fuel system, heat exchanger, and base plate while ensuring that there is no damage to the paint, seals, or materials.",
        "parameter": "No damage to paint",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Cleaning of air filter & fuel filter",
        "parameter": "Clean filters",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Cleaning of Generator body & battery",
        "parameter": "No corrosion",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Cleaning the inside and outside of the PKG (Power Generation Panel) and APM (Automatic Power Management) panels.",
        "parameter": "No corrosion or excessive moisture.",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "pdu@gmail.com": {
    "key": "pdu",
    "number": 11,
    "name": "Panel PDU",
    "email": "pdu@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "Panel PDU",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "a.",
        "activity": "Inspection unsafe action and unsafe condition before start activity",
        "parameter": "Safe & Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Visual inspection of physical body, paint, and corrosion",
        "parameter": "No damage / clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Check wiring connection, tightness, and termination",
        "parameter": "Tight & intact",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Check indicator lamps, display, and controller status",
        "parameter": "Normal display",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Cleaning unit and surrounding area using vacuum cleaner / cloth",
        "parameter": "Clean & tidy",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "coolingtower@gmail.com": {
    "key": "coolingtower",
    "number": 18,
    "name": "Cooling Tower",
    "email": "coolingtower@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "Cooling Tower",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "a.",
        "activity": "Inspection & Checked of basin (upper, lower) from corrosive, erosion, algae,",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Inspection & Checked the filler from damaged",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Inspection & Checked  the all support/mounting (CT Fan, Motor CT Fan, Pump CWP, pipes installation)",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Inspection & Checked   tightening all support/mounting (CT Fan, Motor CT Fan, Pump CWP, pipes installation)",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Inspection & Checked for floating check valve from clogged and damaged",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "Inspection & Checked  all valve from clogged and damaged",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "g.",
        "activity": "Inspection & Checked of Motor Fan (pulley, tension belt)",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "h.",
        "activity": "Inspection & Checked the fan blades for cracks, missing balancing, weights, and vibrations (visual and bearing condition)",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "i.",
        "activity": "Inspection & Checked  the Check sheaves, bushings, fan shafts and fan hubs Annually for corrosion. Scrape and coat with ZRC",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "j.",
        "activity": "Inspection & Checked  the spray nozzles, Strainer, and Drift Eliminator from clogged and damaged",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "k.",
        "activity": "Inspection & Checked the enclosure (Access door, stairs)",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Inspection of support levelness (alignment)",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Inspection function of power meters",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Inspection function of lamps and indicators",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Inspection of locking devices for signs damage or worn.",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Inspection of control wiring, relays, power supply units, timers",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "Inspection electronic surge protection is installed.",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "g.",
        "activity": "Inspection of control circuit fuse rating and continuity.",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "h.",
        "activity": "Inspection for signs of overheating or deterioration.",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "i.",
        "activity": "Inspection of panels for paint damage and signs of corrosion.",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "j.",
        "activity": "Inspection function of selector switch and push botton.",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1",
        "activity": "Cleaning of Cooling Tower Devices",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Cleaning of basin (upper, lower)",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Cleaning the filler with air spray / brush",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Cleaning  the all support/mounting (CT Fan, Motor CT Fan, Pump CWP, pipes installation)",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Cleaning enclosure/casing with brush",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Cleaning for floating check valve include probe/terminal with vacuum cleaner",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "Cleaning all valve with vacuum cleaner",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "h.",
        "activity": "Cleaning Motor & Fan CT and Greasing the Motor bearings",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "i.",
        "activity": "Cleaning of upper basin, lower basin, and filler",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "2.",
        "activity": "Cleaning of Panel Control",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Cleaning of enclosure (cover panel, doors, form covers)",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Thorough cleaning such as mcb, timer, etc.",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "lv@gmail.com": {
    "key": "lv",
    "number": 21,
    "name": "Panel LV",
    "email": "lv@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "Panel LV",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "1",
        "activity": "LV Switchbard",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Check for unsafe actions and conditions before starting  maintenance activities.",
        "parameter": "Check unsafe actions and",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Take photos before starting activities to show the initial condition of the equipment panel.",
        "parameter": "Take initial panel photos.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Check the grounding cable and ensure here is no leakage voltage and ensure that the termination is in good condition.",
        "parameter": "Check grounding",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Checking the support flatness (alignment) using a water level",
        "parameter": "Check support",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Checking and cleaning the enclosure",
        "parameter": "Check and clean the enclosure",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "m.",
        "activity": "Inspection Busbar",
        "parameter": "Busbar is in normal condition.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "n.",
        "activity": "Safety closing device inspection (tripping during pulling, interlock)",
        "parameter": "Safety closing device",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1",
        "activity": "Cleaning of enclosure (cover panel, doors, form covers)",
        "parameter": "No dust",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "2",
        "activity": "Cleaning throughly (dedusting), vacuum of exterior and interior of LV switchboards",
        "parameter": "No dust",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "3",
        "activity": "Cleaning/vacuum of power meters",
        "parameter": "No dust",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "acsplit@gmail.com": {
    "key": "acsplit",
    "number": 23,
    "name": "AC Split Wall",
    "email": "acsplit@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "AC Split Wall",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "a.",
        "activity": "Inspection unsafe action and unsafe condition before start activity",
        "parameter": "Safe & Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Visual inspection of physical body, paint, and corrosion",
        "parameter": "No damage / clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Check wiring connection, tightness, and termination",
        "parameter": "Tight & intact",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Check indicator lamps, display, and controller status",
        "parameter": "Normal display",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Cleaning unit and surrounding area using vacuum cleaner / cloth",
        "parameter": "Clean & tidy",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "ups@gmail.com": {
    "key": "ups",
    "number": 25,
    "name": "UPS System",
    "email": "ups@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "UPS System",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "1",
        "activity": "Inspection & cleaning UPS",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Inspection of display unit UPS and make sure the display is in good condition with check history alarm in device",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "gate@gmail.com": {
    "key": "gate",
    "number": 26,
    "name": "Autogate System",
    "email": "gate@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "Autogate System",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "1",
        "activity": "Inspect and remove any object from the top of controller.",
        "parameter": "Top of the controller Clean there are no obstructing objects",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "2",
        "activity": "Inspect controller for any evidence of corrosion inside",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "3",
        "activity": "Inspect motor and gearbox for proper alignment and function of mechanical",
        "parameter": "There is no wear, cracks, or physical abnormalities on the shaft/coupling",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "4",
        "activity": "Inspect tightness of all connections",
        "parameter": "The condition of the threads on the bolts is not worn, damaged or slippery and the bolts/nuts are tight.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "5",
        "activity": "Inspect tightness of all terminal jumpers",
        "parameter": "The condition of the threads on the bolts is not worn, damaged or slippery and the bolts/nuts are tight.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "6",
        "activity": "Inspect terminal grounding",
        "parameter": "The condition of the threads on the bolts is not worn, damaged or slippery and the bolts/nuts are tight.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "7",
        "activity": "Inspect railing",
        "parameter": "No bent, cracked or corroded parts",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "8",
        "activity": "Inspect bearing gear",
        "parameter": "gears and bearings are installed straight, not at an angle.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "9",
        "activity": "Inspect bearing tire",
        "parameter": "there is no excessive play when the wheel is rocked left/right or up/down.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "10",
        "activity": "Inspect power supply",
        "parameter": "power supply output according to specifications voltage for 3P 380 VAC, for control 1P 220VAC",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "11",
        "activity": "Inspect manual remote",
        "parameter": "When the remote is pressed, the controlled equipment/machine responds correctly.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "12",
        "activity": "Inspect sensor",
        "parameter": "No cracks, Broken cables, Corrosion, in the sensor",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "13",
        "activity": "Inspect chain",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "14",
        "activity": "Inspect manual selector / remote switch",
        "parameter": "not too loose or too tight.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "15",
        "activity": "Inspect rotary lamp",
        "parameter": "The light is bright enough, does not dim or flicker unnaturally",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "16",
        "activity": "Inspection bushing teflon and adjust chains support",
        "parameter": "The bushing does not shift from its seat",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1",
        "activity": "Cleaning Rotary lamp",
        "parameter": "After cleaning, the light is bright, stable,",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "2",
        "activity": "Cleaning the motor (Body, Gear, Cover body)",
        "parameter": "There is no thick dust, oil, or dirt stuck",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "3",
        "activity": "Cleaning the Chain, Gear, Roller Teflon",
        "parameter": "Chain free from dirt, old oil and dust",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "4",
        "activity": "Cleaning the cable connection area and add protection",
        "parameter": "There is no dust, rust or dirt",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "5",
        "activity": "Cleaning the Bearing Wheel, Bearing gear",
        "parameter": "Free from dust, old grease and dirt.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "6",
        "activity": "Cleaning the control Module",
        "parameter": "There are no cracked, broken or loose components after the cleaning process.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "7",
        "activity": "Cleaning on the sensor (Limit Swicth)",
        "parameter": "Housing, lever and sensor",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "8",
        "activity": "Cleaning Base frame & gate frame",
        "parameter": "Paint is not peeling.",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "trafo@gmail.com": {
    "key": "trafo",
    "number": 28,
    "name": "Transformator",
    "email": "trafo@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "Transformator",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "a.",
        "activity": "Inspection of enclosure Transformer (dry type)",
        "parameter": "Customer",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Inspection/check of Transformer tank, including all bolts, nuts, and welded parts from leakage, cracking and corrosion",
        "parameter": "Company name",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Inspection/check of cable connection on terminals and ground wire",
        "parameter": "Equipment Name",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Inspection/check of HV and LV Windings Insulation (dry type)",
        "parameter": "CI Description",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Inspection of actual temperature Transformer (dry type)",
        "parameter": "CI Name",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "Inspection of oil temperature Transformer (oil type)",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "g.",
        "activity": "Inspection/check of oil level indicator/gauge (oil type)",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "h.",
        "activity": "Inspection quality of oil (oil type)",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "i.",
        "activity": "Inspection of Transformer accessories",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "j.",
        "activity": "Inspection the Transformer If equipped with protection relay, check whether the contact point",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "k.",
        "activity": "Inspection of cooling system (Fan)",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Cleaning part of Transformer (dry type) / enclosure",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Cleaning the transformer tank (oil type)",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Cleaning the porcelain bushings and wiring terminals",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Remove the corrosion by sand paper or repaint this part",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Cleaning the cooling system (Fan)",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "Torque tightening on bushing and wiring terminals",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Transformer current and load recording",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Transformer Voltage recording",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "ahu@gmail.com": {
    "key": "ahu",
    "number": 29,
    "name": "AHU (Air Handling Unit)",
    "email": "ahu@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "AHU (Air Handling Unit)",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "c.",
        "activity": "Check motor noise with a sound level meter and check vibration by placing a vibration meter",
        "parameter": "< 65 dBA measured at a distance of 1 meter from the unit and  vibration < 4.5 mm/s",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Check air duct installation, ensure there is no condensation or damage",
        "parameter": "Air ducts are properly installed, with no",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Inspect the magnetic damper and ensure the magnetic tube is not damaged",
        "parameter": "Magnetic tube undamaged, damper",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "Inspect and check electrical control components (power supply, contacts, surge protection, circuit breakers, fuses)",
        "parameter": "Electrical components  are in",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "g.",
        "activity": "Inspect and check electrical control component terminations",
        "parameter": "Cable terminations are neat and secure",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "h.",
        "activity": "Inspect to ensure setpoint and actual temperature and humidity settings are correct",
        "parameter": "Standards Humidity 40% – 60% RH (ideal)",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "i.",
        "activity": "Inspect, check the level of the drain tank drain pipe",
        "parameter": "Drainage channels are clean, unobstructed",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "j.",
        "activity": "Inspect and check the remote control unit",
        "parameter": "Functions normally, no damage to buttons or display",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "k.",
        "activity": "Inspect and check all supports (trays, refrigerant pipes, indoor fans, supply and return grilles)",
        "parameter": "Supports (tray, refrigerant pipes, fan, grille) are sturdy and undamaged",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "l.",
        "activity": "Inspection of the main fan motor in the room (installation, support)",
        "parameter": "Fan motor rotates smoothly, no unusual noise or excessive vibration.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "m.",
        "activity": "Inspection of fan belt tension, visually inspecting",
        "parameter": "Belt tension meets standards, no signs of wear or slippage",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Cleaning body pump",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Cleaning fuel tank",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Cleaning pipe",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Cleaning panel control & accessories",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Cleaning the AHU box by using vacuum",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Cleaning the air filter from dust and foreign objects using steam",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Cleaning the compressor area (if there is a leak) using a brush",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Cleaning the magnetic damper connection using vacuum",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Cleaning the Evaporator Fin (using Vacumm if necessary use Jet Cleaner)",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "Clean the drain pipe of the drain tank with a vacuum cleaner",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "g.",
        "activity": "Clean the main fan motor",
        "parameter": "Clean",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "pump@gmail.com": {
    "key": "pump",
    "number": 31,
    "name": "Cooling Pump System",
    "email": "pump@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "Cooling Pump System",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "a.",
        "activity": "Ensure pump unit is in standby & isolated",
        "parameter": "Pump in safe standby & isolated from operation",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Switch control mode to Off (duty/backup running)",
        "parameter": "Set to OFF; duty/backup pump running normally",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Close inlet & outlet isolation valves",
        "parameter": "Inlet & outlet isolation valves fully closed",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Turn off power supply from MCB at control panel",
        "parameter": "MCB at control panel is turned OFF",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "f.",
        "activity": "Lubricate motor & pump bearings (Greasing)",
        "parameter": "Bearings properly lubricated with correct grease",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "g.",
        "activity": "Inspect motor terminal block bolts tightness",
        "parameter": "Bolts are tight (checked with torque tool)",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "h.",
        "activity": "Housekeeping tools and work area",
        "parameter": "Tools & work area are clean and organized",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "i.",
        "activity": "Open isolation valves for normal operation",
        "parameter": "Isolation valves opened properly for operation",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "j.",
        "activity": "Coordinate to return pump to AUTO mode",
        "parameter": "Pump returned to AUTO mode & normal config",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "k",
        "activity": "Check control panel & TMW panel termination",
        "parameter": "No loose, damaged, or overheated connections",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "l",
        "activity": "Check panel for damage, corrosion, & lock",
        "parameter": "No corrosion, properly locked, and well supported",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "m",
        "activity": "Check control panel & TMW control function",
        "parameter": "Start/Stop & Auto/Manual operate normally",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "2",
        "activity": "Cleaning",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "a.",
        "activity": "Cleaning motor fan & body",
        "parameter": "No dust/dirt (vacuum/dry cloth)",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Cleaning strainer/filter",
        "parameter": "Water/compressed air used",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Cleaning terminal box",
        "parameter": "Inside clean and dry",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Cleaning control & TMW panel",
        "parameter": "No dust remains, properly closed",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "dockleveler@gmail.com": {
    "key": "dockleveler",
    "number": 32,
    "name": "Dock Leveler",
    "email": "dockleveler@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "Dock Leveler",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "1.1",
        "activity": "Inspection & Checked of electrical panel (Voltage, Current, Grounding)",
        "parameter": "good condition",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.2",
        "activity": "Inspection & Checked of Telescopic Ramp ( Leakage, alignment, Corrosion)",
        "parameter": "No oil leakage",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.3",
        "activity": "Inspection & Checked Condition of Lip plate, Toe Guards, Deck and Saffety Leg)",
        "parameter": "No damage or deformation",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.4",
        "activity": "Inspection & Checked of Bumper , Rubber Lip and Lip hinge",
        "parameter": "Bumper and rubber lip are not damaged",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.5",
        "activity": "Inspection & Checked of Controller Swicth button",
        "parameter": "All buttons work properly",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.6",
        "activity": "Inspection & Checked Condition Of Fluid system",
        "parameter": "Oil pressure is normal or No leakage",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.7",
        "activity": "Inspection & Checked of Motor Fluid Pump (Mech seal, Leakage, performance, and terminal box)",
        "parameter": "No oil leakage at seal",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.1",
        "activity": "Cleaning Of Electrical Panel & Electrrical Swicth button",
        "parameter": "Electrical panels and control switch buttons are cleaned from dust",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.2",
        "activity": "Cleaning of Telescopic Ramp",
        "parameter": "The telescopic ramp is cleaned from dirt, oil, and corrosion",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.3",
        "activity": "Cleaning of Motor Fulid Pump, Telescopic Hose, and Reservoir Tank",
        "parameter": "motor pump, telescopic hose, and reservoir tank are cleaned",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.4",
        "activity": "Lubrication of Lip Hinge, Deck Hinge, and Support Dock leveller",
        "parameter": "Lubrication is applied with a grease gun and brushto open hinges.",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.5",
        "activity": "Filling Fluid of Reservoir Tank Or Flushing",
        "parameter": "No indication of leakage or contamination",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "Motor",
        "activity": "Result (dB)",
        "parameter": "Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "Breaker",
        "activity": "Result (ꭥ)",
        "parameter": "Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "Wire",
        "activity": "Result (Voltage)",
        "parameter": "Wire",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "door@gmail.com": {
    "key": "door",
    "number": 33,
    "name": "Door (Fire / Auto Door)",
    "email": "door@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "Door (Fire / Auto Door)",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "1.1",
        "activity": "Inspection & Checked of door movement",
        "parameter": "Door operates smoothly",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.2",
        "activity": "Inspection & Checked of signs of waer, rust, dents, and damageon door tracks",
        "parameter": "Door tracks are free from excessive",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.3",
        "activity": "Inspection & Checked door tracks are aligned and not sagging",
        "parameter": "Door tracks are properly aligned,",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.4",
        "activity": "Inspection & Checked of door parts for any signs of damage (spring, motor, frame, cover)",
        "parameter": "All door components (spring, motor,",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.5",
        "activity": "Inspection & Checked of Bumper , Rubber Lip and Lip hinge",
        "parameter": "Bumper, rubber lip, and lip hinge are",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.6",
        "activity": "Inspection & Checked of Controller Swicth button",
        "parameter": "Controller switch buttons are fully",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.7",
        "activity": "Check Motor Condition, Check motor body for overheating, Listen for abnormal sound, Check cable connection,",
        "parameter": "Motor runs normally without",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.8",
        "activity": "Check Base Frame, Shaft & Door  Alignment Base Frame",
        "parameter": "Base Frame & Door Alignment",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.9",
        "activity": "Motor & Gearbox Inspection",
        "parameter": "Mounting bolts are tight. Cables are",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "2.0",
        "activity": "Check Roller Shutter Kit",
        "parameter": "No wear, corrosion, or damage",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.1",
        "activity": "Cleaning Of Electrical Panel & Electrrical Swicth button",
        "parameter": "Electrical panel and switch buttons",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.2",
        "activity": "Clean the door tracks from dust, dirt, and debris using a brush or cloth",
        "parameter": "Door tracks are clean and free from",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.3",
        "activity": "Apply approved lubricant to the door motor and moving parts as required",
        "parameter": "Door motor is properly lubricated as",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.4",
        "activity": "Tightening bolts, Check all bolts and fasteners on the door system",
        "parameter": "All bolts are securely tightened",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.5",
        "activity": "Tightening and check cable control and electrical components termination",
        "parameter": "Control cables and electrical",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "Wire",
        "activity": "Result (Voltage)",
        "parameter": "Wire",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "exhaustfan@gmail.com": {
    "key": "exhaustfan",
    "number": 34,
    "name": "Exhaust Fan",
    "email": "exhaustfan@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "Exhaust Fan",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "1.1",
        "activity": "Visual check and labels check on circuit breaker, wiring, terminal and earth connection",
        "parameter": "good condition",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.2",
        "activity": "Check the cables from the panel to the motor (cracks, or looseness)",
        "parameter": "not cracked or damaged",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.3",
        "activity": "Visual check mechanical parts (fan, shaft, baering)",
        "parameter": "Blade is free of dust and excess dirt",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.4",
        "activity": "Check the housing and fan mount for cracks, rust or loose bolts",
        "parameter": "There are no cracks",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.5",
        "activity": "Check flexible duct condition (no damage, leakage, or disconnection)",
        "parameter": "Ducting system is in good condition with no leakage",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.6",
        "activity": "Inspection of Brackets, Vibration, Hangers, and Support Frames",
        "parameter": "Brackets and hangers are secure and properly installed",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.7",
        "activity": "Check Motor Condition, Check motor body for overheating, Listen for abnormal sound, Check cable connection,",
        "parameter": "Motor runs normally without",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.8",
        "activity": "Check the physical condition of the MCB/MCCB (no cracks, burns, or discoloration).",
        "parameter": "good conenction",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.9",
        "activity": "Verify damper condition and proper operation (open/close position)",
        "parameter": "Dampers operate properly",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.1",
        "activity": "Clean fan casing, blades, motor housing, terminal box, using brush, and vacuum cleaner",
        "parameter": "Ensure that the fan casing, blades, motor housing, terminal box",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.2",
        "activity": "Retightening all bolt and nut using torque",
        "parameter": "All bolts and nuts on the exhaust fan",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "Ducting",
        "activity": "Result (m/s)",
        "parameter": "Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "Motor",
        "activity": "Result mm/s",
        "parameter": "Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "Wire",
        "activity": "Result (Voltage)",
        "parameter": "Wire",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "fcu@gmail.com": {
    "key": "fcu",
    "number": 35,
    "name": "FCU (Fan Coil Unit)",
    "email": "fcu@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "FCU (Fan Coil Unit)",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "a.",
        "activity": "Inspection unsafe action and unsafe condition before start activity",
        "parameter": "Safe & Clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "b.",
        "activity": "Visual inspection of physical body, paint, and corrosion",
        "parameter": "No damage / clean",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "c.",
        "activity": "Check wiring connection, tightness, and termination",
        "parameter": "Tight & intact",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "d.",
        "activity": "Check indicator lamps, display, and controller status",
        "parameter": "Normal display",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "e.",
        "activity": "Cleaning unit and surrounding area using vacuum cleaner / cloth",
        "parameter": "Clean & tidy",
        "condition": "Good",
        "remarks": ""
      }
    ]
  },
  "ldbrdb@gmail.com": {
    "key": "ldbrdb",
    "number": 40,
    "name": "Panel LDB & RDB",
    "email": "ldbrdb@gmail.com",
    "defaultCustomerInfo": {
      "companyName": "Neutra DC Cikarang",
      "mopNo": "",
      "equipmentName": "Panel LDB & RDB",
      "serialNo": "",
      "quarter": "Q3",
      "ciDescription": "",
      "productName": "",
      "location": "",
      "date": "2026-09-01",
      "ciName": "",
      "prodYear": "",
      "area": "",
      "engineer": "",
      "serviceType": "Preventive maintenance",
      "contractType": "Contract",
      "specification": "",
      "model": ""
    },
    "defaultTimeSpent": {
      "date": "2026-09-01",
      "departure": "08:00",
      "arrival": "08:30",
      "start": "09:00",
      "finish": "17:00"
    },
    "defaultOperationStatus": {
      "isNormal": true,
      "remark": "All systems operating within normal parameters.",
      "faultSymptom": "",
      "faultAnalysis": "",
      "workDone": "",
      "faultPartSN": "",
      "faultPartName": ""
    },
    "checklistTemplate": [
      {
        "no": "1.1",
        "activity": "Inspection of support levelness used water pass to analysis positioning support panel",
        "parameter": "Panel good positioning",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.2",
        "activity": "Inspection & check visual all support panel like a condition paint panel, pilot lamp, chasiss panel padlock system ect.",
        "parameter": "No damage in the part panel",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.3",
        "activity": "Check inspection visual push bottom panel, selector switch, and display DPM",
        "parameter": "Good condition / Standard",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.4",
        "activity": "Inspection visual breaker panel (MCCB, MCB), cable and wiring panel, and fuse",
        "parameter": "There is no indication of scorching due to excessive heat",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.5",
        "activity": "Inspection relay, power supply unit, aux contact",
        "parameter": "Tightness, good connection",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.6",
        "activity": "Check condition line busbar in the termination busbar RTS using thermal imager",
        "parameter": "There is no indication excessive",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.7",
        "activity": "Inspection visual cable connection in the terminal cable MCB / MCCB using thermal imager",
        "parameter": "Marking no movement",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.8",
        "activity": "cleaning panel used vacuum cleaner and apply sanpoly to finish cleaning body panel",
        "parameter": "Clean and clear",
        "condition": "Good",
        "remarks": ""
      },
      {
        "no": "1.9",
        "activity": "Cleaning, remove object from top of controller using vacuum cleaner",
        "parameter": "Clean and clear",
        "condition": "Good",
        "remarks": ""
      }
    ]
  }
};

export function getServiceReportConfigByEmail(email?: string | null): ServiceReportConfigItem | null {
  if (!email) return null;
  const normalized = email.toLowerCase().trim();
  return SERVICE_REPORT_MASTER_REGISTRY[normalized] || null;
}

export function isServiceReportSupported(email?: string | null): boolean {
  return !!getServiceReportConfigByEmail(email);
}
