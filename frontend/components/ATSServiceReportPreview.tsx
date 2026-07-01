import { motion } from 'motion/react';
import { ArrowLeft, Download } from 'lucide-react';
import { ATSCustomerInfo, ATSReportData, ATSTimeSpent } from '@/types/atsReportTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';

interface ATSServiceReportPreviewProps {
  customerInfo: ATSCustomerInfo;
  reportData: ATSReportData;
  timeSpent: ATSTimeSpent;
  originalReportCards?: Array<{ photoBase64?: string; description: string }>;
  onBack: () => void;
  onExportPDF: () => void;
}

export function ATSServiceReportPreview({
  customerInfo, reportData, timeSpent, originalReportCards, onBack, onExportPDF
}: ATSServiceReportPreviewProps) {
  const formattedDate = customerInfo.date
    ? new Date(customerInfo.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-5xl mx-auto pb-20"
    >
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-bold">Kembali</span>
          </button>
          <div className="text-center">
            <p className="text-xs font-bold text-white">Preview Service Report ATS</p>
          </div>
          <button
            onClick={onExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Report Preview - mimics PDF layout */}
      <div className="max-w-4xl mx-auto mt-6 bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 sm:p-8 space-y-4 font-sans text-slate-900">

          {/* Header with logos */}
          <div className="flex items-center justify-between border-2 border-gray-300 rounded-lg p-3">
            <img src={logoDwimitra} alt="Dwimitra" className="h-10 object-contain" />
            <div className="text-center flex-1">
              <h1 className="text-sm font-bold text-blue-800 uppercase">Service Report Automatic Transfer Switch</h1>
              <p className="text-xs text-gray-600">Neutra DC Cikarang</p>
            </div>
            <img src={logoNeutraDC} alt="NeutraDC" className="h-8 object-contain" />
          </div>

          {/* Customer Info Table */}
          <table className="w-full text-[10px] border-collapse border border-gray-400">
            <tbody>
              <tr className="bg-blue-700 text-white">
                <td colSpan={8} className="px-2 py-1 font-bold text-xs">Customer</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50 w-24">Company name</td>
                <td className="border border-gray-300 px-1.5 py-1">{customerInfo.companyName}</td>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Type</td>
                <td className="border border-gray-300 px-1.5 py-1">{customerInfo.type}</td>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50" rowSpan={2}>Specification</td>
                <td className="border border-gray-300 px-1.5 py-1" rowSpan={2}>{customerInfo.specification}</td>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Map No</td>
                <td className="border border-gray-300 px-1.5 py-1">{customerInfo.mapNo}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Equipment name</td>
                <td className="border border-gray-300 px-1.5 py-1">{customerInfo.equipmentName}</td>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Serial No.</td>
                <td className="border border-gray-300 px-1.5 py-1">{customerInfo.serialNo}</td>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Quarter</td>
                <td className="border border-gray-300 px-1.5 py-1">{customerInfo.quarter}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">CI Description</td>
                <td className="border border-gray-300 px-1.5 py-1">{customerInfo.ciDescription}</td>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Product Name</td>
                <td className="border border-gray-300 px-1.5 py-1">{customerInfo.productName}</td>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Location</td>
                <td className="border border-gray-300 px-1.5 py-1">{customerInfo.location}</td>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Date</td>
                <td className="border border-gray-300 px-1.5 py-1">{formattedDate}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">CI Name</td>
                <td className="border border-gray-300 px-1.5 py-1">{customerInfo.ciName}</td>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Product Years</td>
                <td className="border border-gray-300 px-1.5 py-1">{customerInfo.productYears}</td>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Area</td>
                <td className="border border-gray-300 px-1.5 py-1">{customerInfo.area}</td>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Engineer</td>
                <td className="border border-gray-300 px-1.5 py-1">{customerInfo.engineer}</td>
              </tr>
            </tbody>
          </table>

          {/* Visual Inspection & Check */}
          <table className="w-full text-[10px] border-collapse border border-gray-400">
            <thead>
              <tr className="bg-blue-700 text-white">
                <th colSpan={6} className="px-2 py-1 text-left text-xs font-bold">Visual Inspection & Check</th>
              </tr>
              <tr className="bg-yellow-100 text-gray-800 font-bold">
                <th className="border border-gray-300 px-1 py-1 w-6">No</th>
                <th className="border border-gray-300 px-1 py-1 text-left">Activity</th>
                <th className="border border-gray-300 px-1 py-1 w-28">Parameter</th>
                <th className="border border-gray-300 px-1 py-1 w-12" colSpan={2}>Condition</th>
                <th className="border border-gray-300 px-1 py-1 w-16">Remarks</th>
              </tr>
              <tr className="bg-yellow-50 text-gray-600 text-center">
                <th className="border border-gray-300 px-1 py-0.5"></th>
                <th className="border border-gray-300 px-1 py-0.5"></th>
                <th className="border border-gray-300 px-1 py-0.5"></th>
                <th className="border border-gray-300 px-1 py-0.5">Good</th>
                <th className="border border-gray-300 px-1 py-0.5">Not Good</th>
                <th className="border border-gray-300 px-1 py-0.5"></th>
              </tr>
            </thead>
            <tbody>
              {reportData.visual_inspection.map(item => (
                <tr key={item.no} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-1 py-0.5 text-center font-bold">{item.no}.</td>
                  <td className="border border-gray-300 px-1 py-0.5">{item.activity}</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-center">{item.parameter}</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-center">
                    {item.condition === 'Good' && <span className="text-green-600 font-bold">Good</span>}
                  </td>
                  <td className="border border-gray-300 px-1 py-0.5 text-center">
                    {item.condition === 'Not Good' && <span className="text-red-600 font-bold">Not Good</span>}
                  </td>
                  <td className="border border-gray-300 px-1 py-0.5">{item.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Digital Power Meter Recording */}
          <table className="w-full text-[10px] border-collapse border border-gray-400">
            <thead>
              <tr className="bg-blue-700 text-white">
                <th colSpan={9} className="px-2 py-1 text-left text-xs font-bold">
                  Digital Power Meter Recording <span className="font-normal text-[9px]">Please mark OK (✓), not OK(✗), not applicable (N/A) in the box</span>
                </th>
              </tr>
              <tr className="bg-yellow-100 font-bold text-gray-800">
                <th className="border border-gray-300 px-1 py-1">Wire</th>
                <th className="border border-gray-300 px-1 py-1">Result (Voltage)</th>
                <th className="border border-gray-300 px-1 py-1">Wire</th>
                <th className="border border-gray-300 px-1 py-1">Result (Voltage)</th>
                <th className="border border-gray-300 px-1 py-1">Wire</th>
                <th className="border border-gray-300 px-1 py-1">Result</th>
                <th className="border border-gray-300 px-1 py-1">Wire</th>
                <th className="border border-gray-300 px-1 py-1">Result (Ampere)</th>
                <th className="border border-gray-300 px-1 py-1">Remarks</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-1 py-1 font-bold">R-S</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.power_meter_recording.rs.voltage}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">R-N</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.power_meter_recording.rn.voltage}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">KW</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.power_meter_recording.kw}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">R</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.power_meter_recording.r_ampere}</td>
                <td className="border border-gray-300 px-1 py-1" rowSpan={4}></td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-1 py-1 font-bold">S-T</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.power_meter_recording.st.voltage}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">S-N</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.power_meter_recording.sn.voltage}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">KVA</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.power_meter_recording.kva}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">S</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.power_meter_recording.s_ampere}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-1 py-1 font-bold">T-R</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.power_meter_recording.tr.voltage}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">T-N</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.power_meter_recording.tn.voltage}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">KVAR</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.power_meter_recording.kvar}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">T</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.power_meter_recording.t_ampere}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-1 py-1"></td>
                <td className="border border-gray-300 px-1 py-1"></td>
                <td className="border border-gray-300 px-1 py-1 font-bold">N</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.power_meter_recording.n.voltage}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">Cos p</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.power_meter_recording.cos_p}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">N</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.power_meter_recording.n_ampere}</td>
              </tr>
            </tbody>
          </table>

          {/* Voltage & Current Measurement */}
          <table className="w-full text-[10px] border-collapse border border-gray-400">
            <thead>
              <tr className="bg-blue-700 text-white">
                <th colSpan={7} className="px-2 py-1 text-left text-xs font-bold">Voltage & Current Measurement</th>
              </tr>
              <tr className="bg-yellow-100 font-bold text-gray-800">
                <th className="border border-gray-300 px-1 py-1">Wire</th>
                <th className="border border-gray-300 px-1 py-1">Result (Voltage)</th>
                <th className="border border-gray-300 px-1 py-1">Wire</th>
                <th className="border border-gray-300 px-1 py-1">Result (Voltage)</th>
                <th className="border border-gray-300 px-1 py-1">Wire</th>
                <th className="border border-gray-300 px-1 py-1">Result (Ampere)</th>
                <th className="border border-gray-300 px-1 py-1">Standard</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-1 py-1 font-bold">R-S</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.voltage_current.voltage_rs}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">R-N</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.voltage_current.voltage_rn}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">R</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.voltage_current.ampere_r}</td>
                <td className="border border-gray-300 px-1 py-1 text-center text-[9px] text-red-600" rowSpan={4}>+5% - 10% from 380V & 220V load deviation 10%</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-1 py-1 font-bold">S-T</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.voltage_current.voltage_st}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">S-N</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.voltage_current.voltage_sn}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">S</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.voltage_current.ampere_s}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-1 py-1 font-bold">T-R</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.voltage_current.voltage_tr}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">T-N</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.voltage_current.voltage_tn}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">T</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.voltage_current.ampere_t}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-1 py-1"></td>
                <td className="border border-gray-300 px-1 py-1"></td>
                <td className="border border-gray-300 px-1 py-1 font-bold">N-G</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.voltage_current.voltage_ng}</td>
                <td className="border border-gray-300 px-1 py-1 font-bold">N</td>
                <td className="border border-gray-300 px-1 py-1 text-center"></td>
              </tr>
            </tbody>
          </table>

          {/* Thermal Measurement */}
          <table className="w-full text-[10px] border-collapse border border-gray-400">
            <thead>
              <tr className="bg-blue-700 text-white">
                <th colSpan={3} className="px-2 py-1 text-left text-xs font-bold">
                  Thermal Measurement <span className="font-normal text-[9px]">Please mark OK (✓), not OK(✗), not applicable (N/A) in the box</span>
                </th>
              </tr>
              <tr className="bg-yellow-100 font-bold text-gray-800">
                <th className="border border-gray-300 px-1 py-1">Result Temperature (°C)</th>
                <th className="border border-gray-300 px-1 py-1">Standard</th>
                <th className="border border-gray-300 px-1 py-1">Remarks</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-1 py-1 font-bold">Breaker</td>
                <td className="border border-gray-300 px-1 py-1" rowSpan={2}></td>
                <td className="border border-gray-300 px-1 py-1" rowSpan={2}>{reportData.thermal_measurement.remarks}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.thermal_measurement.result_temperature || '—'}°C</td>
              </tr>
            </tbody>
          </table>

          {/* Grounding Resistance */}
          <table className="w-full text-[10px] border-collapse border border-gray-400">
            <thead>
              <tr className="bg-blue-700 text-white">
                <th colSpan={4} className="px-2 py-1 text-left text-xs font-bold">
                  Grounding Resistance Measurement <span className="font-normal text-[9px]">Please mark OK (✓), not OK(✗), not applicable (N/A) in the box</span>
                </th>
              </tr>
              <tr className="bg-yellow-100 font-bold text-gray-800">
                <th className="border border-gray-300 px-1 py-1">Wire</th>
                <th className="border border-gray-300 px-1 py-1">Result (Ω)</th>
                <th className="border border-gray-300 px-1 py-1">Standard</th>
                <th className="border border-gray-300 px-1 py-1">Remarks</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-1 py-1 font-bold">Grounding</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{reportData.grounding_resistance.result_ohm || '—'}</td>
                <td className="border border-gray-300 px-1 py-1 text-center text-red-600">{'<5 Ω'}</td>
                <td className="border border-gray-300 px-1 py-1">{reportData.grounding_resistance.remarks}</td>
              </tr>
            </tbody>
          </table>

          {/* Operation Status */}
          <table className="w-full text-[10px] border-collapse border border-gray-400">
            <tbody>
              <tr>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50 w-40">
                  {reportData.operation_status.is_normal ? '☑ Normal operation' : '☐ Normal operation'}
                </td>
                <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50 w-20">Remark</td>
                <td className="border border-gray-300 px-1.5 py-1">{reportData.operation_status.remark}</td>
              </tr>
            </tbody>
          </table>
          {!reportData.operation_status.is_normal && (
            <table className="w-full text-[10px] border-collapse border border-gray-400">
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50 w-40">☑ Abnormal operation</td>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Fault symptom</td>
                  <td className="border border-gray-300 px-1.5 py-1">{reportData.operation_status.fault_symptom}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">(Please fill the items if the service is repair)</td>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Fault analysis</td>
                  <td className="border border-gray-300 px-1.5 py-1">{reportData.operation_status.fault_analysis}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-1.5 py-1"></td>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Work done / action taken</td>
                  <td className="border border-gray-300 px-1.5 py-1">{reportData.operation_status.work_done}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-1.5 py-1"></td>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Fault Part SN</td>
                  <td className="border border-gray-300 px-1.5 py-1">{reportData.operation_status.fault_part_sn}</td>
                </tr>
              </tbody>
            </table>
          )}

          {/* Time Spent */}
          <table className="w-full text-[10px] border-collapse border border-gray-400">
            <thead>
              <tr className="bg-yellow-200 text-gray-800 font-bold italic">
                <th colSpan={4} className="px-2 py-1 text-left text-xs">TIME SPENT</th>
              </tr>
              <tr className="bg-yellow-100 font-bold text-gray-800">
                <th className="border border-gray-300 px-1 py-1">Date</th>
                <th className="border border-gray-300 px-1 py-1">Departure</th>
                <th className="border border-gray-300 px-1 py-1">Start</th>
                <th className="border border-gray-300 px-1 py-1">Finish</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-1 py-2 text-center">{timeSpent.date}</td>
                <td className="border border-gray-300 px-1 py-2 text-center">{timeSpent.departure}</td>
                <td className="border border-gray-300 px-1 py-2 text-center">{timeSpent.start}</td>
                <td className="border border-gray-300 px-1 py-2 text-center">{timeSpent.finish}</td>
              </tr>
            </tbody>
          </table>

          {/* Customer Acknowledgement */}
          <div className="text-center mt-6">
            <p className="text-xs font-bold text-gray-800 mb-4 uppercase">Customer Acknowledgement:</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-[10px] font-bold text-gray-600">Prepared</p>
                <div className="h-16 border-b border-gray-400 mt-1"></div>
                <p className="text-[10px] font-bold text-gray-800 mt-1">Engineer</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-gray-600">Checked</p>
                <div className="h-16 border-b border-gray-400 mt-1"></div>
                <p className="text-[10px] font-bold text-gray-800 mt-1">SM/PM</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-gray-600">Approved</p>
                <div className="h-16 border-b border-gray-400 mt-1"></div>
                <p className="text-[10px] font-bold text-gray-800 mt-1">Client / Owner</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documentation Page Preview */}
      {originalReportCards && originalReportCards.length > 0 && (
        <div className="max-w-4xl mx-auto mt-6 bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 sm:p-8 space-y-4 font-sans text-slate-900">
            {/* Blue header bar */}
            <div className="bg-blue-700 text-white px-3 py-1.5 rounded font-bold text-xs">
              DOKUMENTASI MAINTENANCE
            </div>
            
            {/* Grid of photos */}
            <div className="grid grid-cols-3 gap-3">
              {originalReportCards.map((card, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden flex flex-col bg-gray-50">
                  <div className="aspect-video w-full relative bg-slate-900 flex items-center justify-center overflow-hidden">
                    {card.photoBase64 ? (
                      <img src={card.photoBase64} alt={card.description} className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-[10px] text-gray-500">No Photo</span>
                    )}
                  </div>
                  <div className="p-2 border-t border-gray-100 flex-1">
                    <p className="text-[9px] text-gray-700 font-medium line-clamp-2 leading-tight">
                      {card.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
