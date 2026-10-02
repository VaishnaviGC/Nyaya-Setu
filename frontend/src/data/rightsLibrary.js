// Static "Know Your Rights" library - works fully offline, no backend needed.
// Educational content for a student project, not a substitute for professional
// legal advice.

const rightsLibrary = [
  {
    id: "land",
    icon: "🏞️",
    title: "Land & Property",
    intro: "Your basic rights when there's a dispute over land, a plot, or a boundary.",
    points: [
      "Any sale of land above a small value must be registered at the Sub-Registrar's office (Registration Act, 1908) — an unregistered sale deed usually cannot prove ownership in court.",
      "If someone occupies your land without permission, you can seek an injunction (a court order to stop them) and recovery of possession under the Specific Relief Act, 1963.",
      "A dispute over a shared boundary or right of way between neighbours is covered under the Indian Easements Act, 1882.",
      "There is a time limit — generally 12 years — within which you must file a suit to recover possession of immovable property, so don't delay.",
      "Always keep copies of the registered sale deed, mutation records (khata/patta), and property tax receipts — they're your strongest evidence.",
    ],
  },
  {
    id: "labour",
    icon: "🛠️",
    title: "Labour & Employment",
    intro: "What the law says about wages, termination, and working conditions.",
    points: [
      "If you're terminated, your employer must pay all outstanding wages within 2 working days (Payment of Wages Act, 1936).",
      "For most establishments, retrenchment requires prior notice and compensation under the Industrial Disputes Act, 1947, Section 25F.",
      "Employers must deposit your Provident Fund (PF) contributions — you can check your PF balance on the EPFO portal or app.",
      "Women employees are entitled to paid maternity leave under the Maternity Benefit Act, 1961.",
      "Keep your appointment letter, salary slips, and any termination letter safe — these are essential if you file a complaint with the Labour Commissioner.",
    ],
  },
  {
    id: "domestic-violence",
    icon: "🛡️",
    title: "Domestic Violence",
    intro: "Protections available to survivors of domestic violence in India.",
    points: [
      "The Protection of Women from Domestic Violence Act, 2005 covers physical, emotional, sexual, verbal, and economic abuse — not just physical violence.",
      "You can apply for a Protection Order, a Residence Order (right to stay in the shared household), and Monetary Relief through a Magistrate under this Act.",
      "IPC Section 498A (cruelty by husband or his relatives) is a criminal provision you can also invoke alongside civil remedies.",
      "You can seek maintenance for yourself and your children under Section 125 CrPC, regardless of religion.",
      "A Protection Officer or a registered NGO can help you file an application — you do not need a lawyer to get started, and legal aid is free if you cannot afford one.",
    ],
  },
  {
    id: "consumer",
    icon: "🛒",
    title: "Consumer Rights",
    intro: "What to do when a product, service, or online purchase lets you down.",
    points: [
      "The Consumer Protection Act, 2019 covers defective goods, deficient services, unfair trade practices, and misleading advertisements.",
      "You can file a complaint with the District Consumer Disputes Redressal Commission for claims typically up to ₹50 lakh (check current limits).",
      "You generally have 2 years from the date of the issue to file a consumer complaint.",
      "E-commerce companies must clearly disclose return, refund, and exchange policies under the Consumer Protection (E-Commerce) Rules, 2020.",
      "Keep the invoice/receipt, product photos, and any chat/email with the seller — this is your evidence.",
    ],
  },
  {
    id: "rti",
    icon: "📄",
    title: "Right to Information (RTI)",
    intro: "How to ask any government office for information using the RTI Act.",
    points: [
      "Any citizen can file an RTI application asking a government office for information about its work, decisions, or records (RTI Act, 2005).",
      "The Public Information Officer (PIO) must respond within 30 days — or within 48 hours if the information concerns life or liberty.",
      "The application fee is usually a small amount (e.g. ₹10) and is waived for applicants below the poverty line.",
      "If you don't get a response, or an unsatisfactory one, you can file a First Appeal, and then a Second Appeal to the Information Commission.",
      "PIOs can be fined for delaying or wrongly refusing information without valid reason (Section 20).",
    ],
  },
];

export default rightsLibrary;
