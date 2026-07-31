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
    incidentName: '',
    incidentDate: '',
    incidentId: '',
    postmortemOwner: '',
    dateCompleted: '',
    reportAuthors: '',
    reportId: '',
    linkToIncidentRecording: '',
    postmortemMeetingDate: '',

    attendeesTDE: [],
    attendeesDME: [],

    severityLevel: 'LOW',
    severityComments: '',

    summary: '',
    impact: '',
    trigger: '',
    rootCause: '',
    detection: '',
    response: '',
    resolution: '',

    contributingFactors: '',
    whatWentWell: '',
    whatWentPoorly: '',
    whereWereWeLucky: '',

    correctiveActions: [],
    photos: [],

    // Step 6: Ketentuan Paten / Default Signatures (PIR Approvals)
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
