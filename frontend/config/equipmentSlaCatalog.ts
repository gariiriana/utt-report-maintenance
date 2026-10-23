// Katalog equipment & prioritas SLA default; dipakai form SLA dan saran Incident Severity di form PIR.

export interface EquipmentSLAItem {
  id: string;
  device: string;
  category: 'Electrical' | 'HVAC' | 'Mechanical' | 'Safety' | 'Civil';
  defaultPriority: 'High' | 'Medium' | 'Low';
  categoryBadgeColor?: string;
  notes?: string;
}

export const EQUIPMENT_SLA_CATALOG: EquipmentSLAItem[] = [
  // ⚡ 1. Electrical & Power System
  { id: 'ups', device: 'UPS (Uninterruptible Power Supply)', category: 'Electrical', defaultPriority: 'High' },
  { id: 'ats', device: 'ATS (Automatic Transfer Switch)', category: 'Electrical', defaultPriority: 'High' },
  { id: 'trafo', device: 'Transformer (Trafo Daya)', category: 'Electrical', defaultPriority: 'High' },
  { id: 'mv_rmu', device: 'MV and RMU Panel (Medium Voltage)', category: 'Electrical', defaultPriority: 'High' },
  { id: 'lv_panel', device: 'LV Panel (Low Voltage)', category: 'Electrical', defaultPriority: 'High' },
  { id: 'pdu_panel', device: 'PDU Panel (Power Distribution Unit)', category: 'Electrical', defaultPriority: 'High' },

  { id: 'genset', device: 'Generator & Fuel System', category: 'Electrical', defaultPriority: 'Medium' },
  { id: 'ldb_rdb', device: 'Panel LDB & RDB (Distribution Board)', category: 'Electrical', defaultPriority: 'Medium' },
  { id: 'busduct', device: 'Busduct', category: 'Electrical', defaultPriority: 'Medium' },
  { id: 'cap_bank', device: 'Capacitor Bank', category: 'Electrical', defaultPriority: 'Medium' },

  { id: 'lighting', device: 'Lighting Point', category: 'Electrical', defaultPriority: 'Low' },
  { id: 'grounding', device: 'Grounding System', category: 'Electrical', defaultPriority: 'Low' },
  { id: 'lightning', device: 'Lightning Protection System (Penangkal Petir)', category: 'Electrical', defaultPriority: 'Low' },
  { id: 'pju', device: 'PJU (Penerangan Jalan Umum)', category: 'Electrical', defaultPriority: 'Low' },

  // ❄️ 2. HVAC & Cooling System (All Medium)
  { id: 'crac', device: 'CRAC Data Hall & Supporting Room', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'chiller', device: 'Chiller', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'cooling_tower', device: 'Cooling Tower', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'ct_water', device: 'Cooling Tower Water Treatment', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'cooling_pump', device: 'Cooling Pump', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'fcu', device: 'FCU (Fan Coil Unit)', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'ahu', device: 'AHU (Air Handling Unit)', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'vrv', device: 'VRV System (Variable Refrigerant Volume)', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'ac_split', device: 'AC Splits', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'exhaust_fan', device: 'Exhaust Fan', category: 'HVAC', defaultPriority: 'Medium' },
  { id: 'cooling_automation', device: 'Physical Cooling Automation', category: 'HVAC', defaultPriority: 'Medium' },

  // 🛗 3. Mechanical & Utility System (All Low)
  { id: 'lift', device: 'Lift Units (Elevator Office & Campus)', category: 'Mechanical', defaultPriority: 'Low' },
  { id: 'gate', device: 'Gate (Pagar / Autogate Utama)', category: 'Mechanical', defaultPriority: 'Low' },
  { id: 'road_blocker', device: 'Road Blocker', category: 'Mechanical', defaultPriority: 'Low' },
  { id: 'dock_leveler', device: 'Dock Leveler', category: 'Mechanical', defaultPriority: 'Low' },
  { id: 'pumps', device: 'Pumps (Pompa Transfer / Umum)', category: 'Mechanical', defaultPriority: 'Low' },
  { id: 'water_softener', device: 'Water Softener', category: 'Mechanical', defaultPriority: 'Low' },

  // 🛡️ 4. Safety & Fire Protection System (All Low)
  { id: 'fss', device: 'FSS (Fire Suppression System)', category: 'Safety', defaultPriority: 'Low' },
  { id: 'hydrant', device: 'Hydrant System', category: 'Safety', defaultPriority: 'Low' },
  { id: 'pre_action', device: 'Pre-Action System', category: 'Safety', defaultPriority: 'Low' },
  { id: 'water_leak', device: 'Water Leak Detection System', category: 'Safety', defaultPriority: 'Low' },
  { id: 'fuel_leak', device: 'Fuel Leak Detection System (Ground Tank)', category: 'Safety', defaultPriority: 'Low' },
  { id: 'x_ray', device: 'X-Ray Scanner (Post Security Bravo)', category: 'Safety', defaultPriority: 'Low' },
  { id: 'pressurization', device: 'Pressurization & Degassing', category: 'Safety', defaultPriority: 'Low' },

  // 🏢 5. Civil & Building Infrastructure (All Low)
  { id: 'stp_plumbing', device: 'STP & Plumbing (Sewage Treatment Plant)', category: 'Civil', defaultPriority: 'Low' },
  { id: 'door', device: 'Door (Pintu Akses Data Hall / Campus)', category: 'Civil', defaultPriority: 'Low' },
];
