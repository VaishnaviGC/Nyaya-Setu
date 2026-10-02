// Real, publicly listed Indian national helpline numbers for safety-critical
// categories. Student project - double check numbers are current before a
// real demo or report.

const EMERGENCY_HELPLINES = {
  "Domestic Violence": [
    { label: "Women's Helpline (24x7, all India)", number: "181" },
    { label: "Police Emergency", number: "112" },
    { label: "National Commission for Women", number: "011-26942369" },
  ],
};

export const GENERAL_LEGAL_AID = {
  label: "NALSA Free Legal Aid Helpline (toll-free)",
  number: "15100",
};

export function getEmergencyHelplines(category) {
  return EMERGENCY_HELPLINES[category] || null;
}
