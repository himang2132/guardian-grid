/**
 * Generates a downloadable PDF case report using browser-native APIs (no external library).
 * Creates a printable HTML document and triggers print/save as PDF.
 */
export interface CaseReportData {
  caseId: string;
  patientName: string;
  patientPhone?: string;
  caseType: string;
  priority: number;
  patientNode: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  responseTimeMin: number;
  responseTimeMax: number;
  assignedAmbulance?: string;
  routeAlgorithm?: string;
  actualResponseTime?: number;
  triageResult?: {
    severity: string;
    confidence: number;
    reasoning: string;
    recommended_action: string;
  };
}

export function generateCaseReportHTML(data: CaseReportData): string {
  const severityColors: Record<string, string> = {
    critical: '#dc2626',
    serious: '#ea580c',
    minor: '#16a34a',
  };

  const statusColors: Record<string, string> = {
    pending: '#eab308',
    assigned: '#f97316',
    accepted: '#3b82f6',
    'in-progress': '#f97316',
    resolved: '#22c55e',
    rejected: '#ef4444',
  };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Emergency Case Report - ${data.caseId.slice(0, 8)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1a1a1a; background: #fff; }
    .header { text-align: center; border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 24px; color: #dc2626; letter-spacing: 2px; }
    .header p { font-size: 12px; color: #666; margin-top: 5px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; color: white; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #dc2626; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; margin-bottom: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field { background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 6px; padding: 10px 14px; }
    .field label { font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
    .field p { font-size: 14px; font-weight: 600; margin-top: 2px; }
    .triage-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; }
    .triage-box .reasoning { font-style: italic; color: #555; margin-top: 8px; font-size: 13px; }
    .triage-box .action { background: #fff; border: 1px solid #e5e5e5; border-radius: 4px; padding: 8px 12px; margin-top: 8px; font-size: 13px; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #999; }
    .timeline { position: relative; padding-left: 24px; }
    .timeline::before { content: ''; position: absolute; left: 8px; top: 0; bottom: 0; width: 2px; background: #dc2626; }
    .timeline-item { position: relative; margin-bottom: 16px; }
    .timeline-item::before { content: ''; position: absolute; left: -20px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: #dc2626; }
    .timeline-item .time { font-size: 11px; color: #888; }
    .timeline-item .event { font-size: 13px; font-weight: 600; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚑 EMERGENCY CASE REPORT</h1>
    <p>Emergency Ambulance Response System • Case ID: ${data.caseId.slice(0, 8).toUpperCase()}</p>
    <p>Generated: ${new Date().toLocaleString()}</p>
  </div>

  <div class="section">
    <h2>Patient Information</h2>
    <div class="grid">
      <div class="field">
        <label>Patient Name</label>
        <p>${data.patientName}</p>
      </div>
      <div class="field">
        <label>Phone</label>
        <p>${data.patientPhone || 'N/A'}</p>
      </div>
      <div class="field">
        <label>Location (Node)</label>
        <p>${data.patientNode}</p>
      </div>
      <div class="field">
        <label>Status</label>
        <p><span class="badge" style="background:${statusColors[data.status] || '#666'}">${data.status.toUpperCase()}</span></p>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Emergency Details</h2>
    <div class="grid">
      <div class="field">
        <label>Case Type</label>
        <p>${data.caseType}</p>
      </div>
      <div class="field">
        <label>Priority Level</label>
        <p>P${data.priority}</p>
      </div>
      <div class="field">
        <label>Target Response Time</label>
        <p>${data.responseTimeMin} - ${data.responseTimeMax} minutes</p>
      </div>
      <div class="field">
        <label>Assigned Ambulance</label>
        <p>${data.assignedAmbulance || 'Pending'}</p>
      </div>
      ${data.routeAlgorithm ? `
      <div class="field">
        <label>Routing Algorithm</label>
        <p>${data.routeAlgorithm.toUpperCase()}</p>
      </div>` : ''}
      ${data.actualResponseTime ? `
      <div class="field">
        <label>Actual Response Time</label>
        <p>${Math.round(data.actualResponseTime / 60)} min ${Math.round(data.actualResponseTime % 60)}s</p>
      </div>` : ''}
    </div>
  </div>

  ${data.triageResult ? `
  <div class="section">
    <h2>🤖 AI Triage Assessment</h2>
    <div class="triage-box">
      <div class="grid">
        <div class="field">
          <label>Severity</label>
          <p><span class="badge" style="background:${severityColors[data.triageResult.severity] || '#666'}">${data.triageResult.severity.toUpperCase()}</span></p>
        </div>
        <div class="field">
          <label>AI Confidence</label>
          <p>${data.triageResult.confidence}%</p>
        </div>
      </div>
      <div class="reasoning">"${data.triageResult.reasoning}"</div>
      <div class="action">
        <label style="font-size:10px;text-transform:uppercase;color:#888;">Recommended Action</label>
        <p style="font-size:13px;margin-top:4px;">${data.triageResult.recommended_action}</p>
      </div>
    </div>
  </div>` : ''}

  <div class="section">
    <h2>Case Timeline</h2>
    <div class="timeline">
      <div class="timeline-item">
        <div class="time">${new Date(data.createdAt).toLocaleString()}</div>
        <div class="event">Emergency Reported</div>
      </div>
      ${data.status !== 'pending' ? `
      <div class="timeline-item">
        <div class="time">${new Date(data.updatedAt).toLocaleString()}</div>
        <div class="event">Ambulance ${data.status === 'rejected' ? 'Rejected' : 'Dispatched'}</div>
      </div>` : ''}
      ${data.status === 'resolved' ? `
      <div class="timeline-item">
        <div class="time">${new Date(data.updatedAt).toLocaleString()}</div>
        <div class="event">Case Resolved ✅</div>
      </div>` : ''}
    </div>
  </div>

  <div class="footer">
    <p>Emergency Ambulance Response System — AI-Powered Dispatch & Routing</p>
    <p>This report was auto-generated. For emergencies, always call 108.</p>
  </div>
</body>
</html>`;
}

export function downloadCaseReport(data: CaseReportData) {
  const html = generateCaseReportHTML(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  // Open in new window for print-to-PDF
  const win = window.open(url, '_blank');
  if (win) {
    win.onload = () => {
      setTimeout(() => {
        win.print();
      }, 500);
    };
  } else {
    // Fallback: download as HTML
    const a = document.createElement('a');
    a.href = url;
    a.download = `case-report-${data.caseId.slice(0, 8)}.html`;
    a.click();
  }
  
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
