export interface PIRCorrectiveAction {
    actionItem: string;
    typeOfAction: string;
    assignedTo: string;
    bug: string;
    startDate: string;
    endDate: string;
}

export interface PIRPhoto {
    photoBase64: string;
    caption: string;
}

export interface PIRReportData {
    id?: string;
    reportType?: 'PIR';
    reportedAt?: any;
    reportedBy?: string;
    reportedByEmail?: string;

    // Page 1: Header & Incident Info
    incidentName: string;
    incidentDate: string;
    incidentId: string;
    postmortemOwner: string;
    dateCompleted: string;
    reportAuthors: string;
    reportId: string;
    linkToIncidentRecording: string;
    postmortemMeetingDate: string;

    // Attendees
    attendeesTDE: string[];
    attendeesDME: string[];

    // Incident Severity
    severityLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'OTHER';
    severityComments: string;

    // Page 2: Summary
    summary: string;

    // Page 3: Incident Overview
    impact: string;
    trigger: string;
    rootCause: string;
    detection: string;
    response: string;
    resolution: string;

    // Page 4: Contributing Factors & Lessons Learned
    contributingFactors: string;
    whatWentWell: string;
    whatWentPoorly: string;
    whereWereWeLucky: string;

    // Pages 5 & 6: Corrective Actions
    correctiveActions: PIRCorrectiveAction[];

    // Pages 7 & 8: Supporting Documentation
    photos: PIRPhoto[];

    // Page 9: Signatures & Approvals
    preparedByName: string;
    preparedByTitle: string;

    reviewedBy1Name: string;
    reviewedBy1Title: string;
    reviewedBy2Name: string;
    reviewedBy2Title: string;

    acknowledgedBy1Name: string;
    acknowledgedBy1Title: string;
    acknowledgedBy2Name: string;
    acknowledgedBy2Title: string;

    approvedBy1Name: string;
    approvedBy1Title: string;
    approvedBy2Name: string;
    approvedBy2Title: string;

    approvedBy3Name: string;
    approvedBy3Title: string;
}

export const INITIAL_PIR_REPORT_DATA: PIRReportData = {
    reportType: 'PIR',
    incidentName: 'Issue for VRV drainage',
    incidentDate: '13 April 2026',
    incidentId: '#95369',
    postmortemOwner: 'Rezki Rahmad Daulay /Mgr Ops. HDC Cikarang',
    dateCompleted: '14 April 2026',
    reportAuthors: 'Agil Zakia Rahman',
    reportId: '13/HDC/06/2026',
    linkToIncidentRecording: 'N/A',
    postmortemMeetingDate: '',

    attendeesTDE: [
        'Rezki Rahman D.',
        'Budi Susanto',
        'Indra Setiady',
        'Horasman Baho'
    ],
    attendeesDME: [
        'Dwi Tasmiyadi',
        'Arif Budiman',
        'Agil Zakia Rahman',
        'Tonggo Sijabat'
    ],

    severityLevel: 'LOW',
    severityComments: 'April 13, 2026 (09:42) – “Water leakage was observed from the affected VRV indoor unit due to a clogged condensate drain line. The issue was limited to the affected unit and was resolved after cleaning the drain pipe. No service interruption, equipment damage, or personnel injury was reported.”. “Issue for vrv drainage”.',

    summary: 'On April 13, 2026, at 09:42, water leakage was reported from the affected VRV indoor unit during normal operation. A follow-up inspection was conducted to investigate the issue.\n\nThe inspection revealed that the condensate drain line was clogged with dirt and debris, preventing proper water drainage and causing condensate to overflow from the indoor unit. The drain line was cleaned, functional testing was performed, and the VRV system was restored to normal operation without further leakage.',

    impact: '• Water leakage was observed from the affected VRV indoor unit due to a blocked condensate drain line.\n• Minor water accumulation occurred around the indoor unit area.\n• There was a potential risk of damage to surrounding equipment and slip hazards.\n• No injuries or critical equipment damage were reported.',

    trigger: 'The incident was triggered when water leakage was observed from the affected VRV indoor unit during normal operation due to improper condensate drainage',

    rootCause: 'The condensate drain pipe of the affected VRV indoor unit was clogged due to the accumulation of dirt, dust, and sludge inside the drain line. The blockage restricted condensate water flow, causing the drain pan to overflow and resulting in water leakage from the indoor unit.',

    detection: 'The issue was identified during a routine site inspection after water leakage was observed beneath the affected VRV indoor unit. Further inspection confirmed that the condensate drain line was blocked, restricting proper drainage.',

    response: 'The site technical team immediately responded by shutting down the affected VRV indoor unit, inspecting the condensate drain system, and checking the drain pipe for blockage to prevent further water leakage.',

    resolution: 'The affected VRV indoor unit was inspected, and the condensate drainage system was thoroughly checked. The drain pipe was found to be blocked by accumulated dirt, sludge, and debris, preventing proper condensate water discharge and causing water to back up inside the drain line.\n\nCorrective actions were immediately carried out by flushing and cleaning the entire drain piping using a wet vacuum and water pressure to remove the blockage. The drain trap and drain hose were also cleaned to ensure smooth condensate flow. The indoor unit drain pan was inspected and cleaned to eliminate any remaining dirt or standing water.',

    contributingFactors: '• Accumulation of dirt, dust, biofilm, and condensate residue inside the drain piping restricted the condensate water flow, resulting in a partial-to-complete blockage.\n• The drain pipe experienced reduced flow capacity due to sludge buildup, causing condensate water to back up into the indoor unit drain pan.\n• The drain piping routing and/or slope was insufficient to maintain proper gravity drainage, allowing water and debris to accumulate within the pipeline.\n• Moisture accumulation inside the drain line promoted biological growth (algae/slime), which progressively reduced the effective internal diameter of the drain pipe.\n• Continuous condensate overflow occurred after the drain line became blocked, triggering the VRV drain protection mechanism and affecting normal indoor unit operation.',

    whatWentWell: 'The issue was detected promptly during routine inspection, and the technical team restored normal operation after cleaning the drain line.',

    whatWentPoorly: 'The issue was detected promptly during routine inspection, and the technical team restored normal operation after cleaning the drain line.',

    whereWereWeLucky: 'No critical equipment was damaged, and no personnel injuries occurred during the incident.',

    correctiveActions: [
        {
            actionItem: '1. Isolated the affected VRV indoor unit and conducted a comprehensive inspection of the condensate drainage system, including the drain pan, drain hose, and drain piping, to determine the source of the water leakage.',
            typeOfAction: 'TROUBLESHOOTING ACTION',
            assignedTo: 'Facility Maintenance Team',
            bug: '- Condensate drainage failure and clogged drain pipe',
            startDate: 'April 13, 2026 10:00',
            endDate: 'April 14, 2026'
        },
        {
            actionItem: '2. Performed drain line cleaning using a wet vacuum and water flushing to remove accumulated sludge, dirt, biofilm, and debris obstructing the condensate drain pipe.',
            typeOfAction: 'TROUBLESHOOTING ACTION',
            assignedTo: 'Facility Maintenance Team',
            bug: '- Condensate drainage failure and clogged drain pipe',
            startDate: 'April 13, 2026 10:00',
            endDate: 'April 14, 2026'
        },
        {
            actionItem: '3. Inspected the condensate drain piping for physical damage, improper routing, loose connections, and inadequate pipe slope. Adjusted and secured the drain line where necessary to ensure proper gravity drainage.',
            typeOfAction: 'TROUBLESHOOTING ACTION',
            assignedTo: 'Facility Maintenance Team',
            bug: '- Condensate drainage failure and clogged drain pipe',
            startDate: 'April 13, 2026 10:00',
            endDate: 'April 14, 2026'
        },
        {
            actionItem: '4. Cleaned the indoor unit drain pan and verified that the drain outlet was free from obstruction.',
            typeOfAction: 'TROUBLESHOOTING ACTION',
            assignedTo: 'Facility Maintenance Team',
            bug: '- Condensate drainage failure and clogged drain pipe',
            startDate: 'April 13, 2026 10:00',
            endDate: 'April 14, 2026'
        },
        {
            actionItem: '5. Conducted a condensate flow test by introducing water into the drain pan, verified unobstructed discharge through the drain piping, and monitored the indoor unit during cooling operation to ensure no further leakage or drain alarm occurred.',
            typeOfAction: 'TROUBLESHOOTING ACTION',
            assignedTo: 'Facility Maintenance Team',
            bug: '- Condensate drainage failure and clogged drain pipe',
            startDate: 'April 13, 2026 10:00',
            endDate: 'April 14, 2026'
        },
        {
            actionItem: '6. Restored the VRV indoor unit to normal operation after successful verification and recommended routine condensate drainage performance checks during HVAC inspections.',
            typeOfAction: 'TROUBLESHOOTING ACTION',
            assignedTo: 'Facility Maintenance Team',
            bug: '- Condensate drainage failure and clogged drain pipe',
            startDate: 'April 13, 2026 10:00',
            endDate: 'April 14, 2026'
        }
    ],

    photos: [],

    preparedByName: 'Agil Zakia Rahman',
    preparedByTitle: '(Shift Engineer)',

    reviewedBy1Name: 'Arif Budiman',
    reviewedBy1Title: '(Technical Manager)',
    reviewedBy2Name: 'Dwi Tasmiyadi',
    reviewedBy2Title: '(Project manager)',

    acknowledgedBy1Name: 'Andrean Bima Pratama',
    acknowledgedBy1Title: '(Chief Engineer)',
    acknowledgedBy2Name: 'Supriyatno',
    acknowledgedBy2Title: '(Facility manager)',

    approvedBy1Name: 'Budi Susanto',
    approvedBy1Title: '(Assistant manager HDC Facility Management)',
    approvedBy2Name: 'Rezki Rahman Daulay',
    approvedBy2Title: '(Manager HDC Operation)',

    approvedBy3Name: 'Muryani',
    approvedBy3Title: '(EGM DC Operation)'
};
