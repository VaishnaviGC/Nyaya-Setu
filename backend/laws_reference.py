"""
Curated reference laws per legal problem category.

This list is fed into the Gemini prompt so the model explains rights
using REAL, correct sections instead of guessing / hallucinating.
NOTE: This is a student-project reference list, not legal advice.
Verify sections before using in the demo report.
"""

CATEGORIES = [
    "Land Dispute",
    "Domestic Violence",
    "Labour Issue",
    "Consumer Complaint",
    "RTI",
    "Other",
]

# Land Dispute is deliberately the most detailed category: this app's core
# real-world use case is rural/farmer land problems - family partition after
# a death, land record (RTC/Pahani) mismatches, tenant-farmer eviction,
# boundary encroachment, and government land acquisition. These are far more
# common for a village user than a straightforward urban property sale.
LAW_REFERENCE = {
    "Land Dispute": [
        # --- Ownership, sale, and registration ---
        "Transfer of Property Act, 1882 - governs sale, mortgage, lease, and gift of immovable property",
        "The Registration Act, 1908 - Section 17: sale, gift, or lease (over 1 year) of immovable property above a small value must be registered at the Sub-Registrar's office to be legally valid",
        "Specific Relief Act, 1963 - lets a rightful owner seek a court injunction (to stop interference) or recovery of possession from someone wrongfully occupying their land",
        "Limitation Act, 1963 - Article 65: generally a 12-year time limit to file a suit to recover possession of land - don't delay taking action",

        # --- Family inheritance and partition disputes (very common: one sibling takes over shared family land) ---
        "Hindu Succession Act, 1956 (as amended in 2005) - Section 6: sons AND daughters have EQUAL coparcenary rights in ancestral/joint family property; when a person dies without a will (intestate), ALL legal heirs inherit equally, not just one sibling or the eldest son",
        "Hindu Succession Act, 1956 - every legal heir has the right to inspect and obtain certified copies of land records (RTC/Pahani, mutation register) relating to family property, even if another family member is currently listed as the sole cultivator",
        "Partition Act, 1893 - any co-owner of jointly-held family land (e.g. siblings who inherited together) can file a partition suit in civil court to legally divide the land into separate individually-owned shares; if physical division isn't practical, the court can order the land sold and proceeds split fairly",
        "Indian Penal Code (IPC) Section 447 / Bharatiya Nyaya Sanhita (BNS) equivalent - criminal trespass: if a family member or neighbour occupies or works land without your consent after a dispute, this can also be reported to police as a criminal matter, separate from filing a civil case",

        # --- Land records: RTC / Pahani / khata mutation (this is THE most common village-level land problem) ---
        "State Land Revenue laws (e.g. Karnataka Land Revenue Act, 1964 - other states have equivalent laws under different names, such as the Maharashtra Land Revenue Code) - governs the Record of Rights, Tenancy and Crops (RTC/Pahani in Karnataka; called 7/12 extract in Maharashtra, Khatauni in UP, Jamabandi in Punjab/Haryana, Adangal in Tamil Nadu) - the official document showing who owns/cultivates a plot",
        "Mutation (khata transfer) rules under state Land Revenue law - after inheritance, sale, or gift, land records MUST be updated to reflect the new owner/heir within a prescribed time; a farmer whose name is wrongly missing from these records can file a written mutation application with evidence (death certificate, sale deed, heirship proof)",
        "Revenue department appeal process (administrative remedy, not a single Act) - if the Village Accountant does not update records or respond, a written appeal can be escalated in order to: the Revenue Inspector, then the Tahsildar, then the Assistant Commissioner/Sub-Divisional Officer - each is expected to respond within a set time, and unreasonable delay can itself be challenged (also see RTI Act to formally request status of a pending application)",

        # --- Tenant farmers and land ceiling ---
        "State Land Reforms / Tenancy Acts (e.g. Karnataka Land Reforms Act, 1961; similar tenancy laws exist in most agricultural states) - protects tenant farmers who have genuinely been cultivating land (even without a formal lease or with only an oral agreement) from arbitrary eviction by the landowner, and in many states gives long-term tenant-cultivators the right to eventually claim formal ownership ('occupancy rights')",
        "State laws preventing fragmentation of agricultural holdings (e.g. Karnataka Prevention of Fragmentation and Consolidation of Holdings Act, 1966; equivalents exist in other states) - restricts splitting small agricultural land into uneconomically tiny fragments, relevant when a family wants to divide inherited farmland among many heirs",

        # --- Government land acquisition ---
        "Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013 (RFCTLARR Act) - governs how the government can acquire private/agricultural land for public projects (roads, dams, industry); requires fair market-value compensation, consent from a majority of affected landowners for many private projects, and resettlement/rehabilitation support - directly relevant if a farmer's land is being taken for a government scheme",

        # --- Forest and tribal land rights ---
        "Scheduled Tribes and Other Traditional Forest Dwellers (Recognition of Forest Rights) Act, 2006 (Forest Rights Act) - protects the rights of tribal and traditional forest-dwelling communities to land they have genuinely been cultivating inside forest areas, even if this was historically never formally recorded in revenue documents",

        # --- Boundary and access disputes between neighbouring farmers ---
        "Indian Easements Act, 1882 - governs right-of-way and access disputes between neighbouring landowners (e.g. a shared farm access path)",
        "State Land Revenue law provisions on boundary demarcation (e.g. Karnataka Land Revenue Act Section on boundary marks) - a farmer can request the Revenue Department formally re-survey and re-fix boundary markers (locally often called 'hadbast'/'hidbast' survey) when a neighbour has encroached by shifting a fence or boundary stone",
    ],
    "Domestic Violence": [
        "Protection of Women from Domestic Violence Act, 2005 (PWDVA) - Section 12: application for relief; Section 18: protection orders; Section 19: residence orders; Section 20: monetary relief",
        "Indian Penal Code (IPC) Section 498A / Bharatiya Nyaya Sanhita (BNS) Section 85 - cruelty by husband or relatives",
        "Dowry Prohibition Act, 1961 - Sections 3 & 4: giving/taking and demanding dowry is punishable",
        "Code of Criminal Procedure (CrPC) Section 125 / Bharatiya Nagarik Suraksha Sanhita (BNSS) Section 144 - maintenance for wife, children, parents",
    ],
    "Labour Issue": [
        "Payment of Wages Act, 1936 - Section 5: timely payment of wages; wages must be paid within 2 working days of termination",
        "Industrial Disputes Act, 1947 - Section 25F: conditions precedent to retrenchment (notice + compensation)",
        "The Code on Wages, 2019 - minimum wage and timely payment provisions (subsuming older wage laws)",
        "Employees' Provident Funds Act, 1952 - employer must deposit PF contributions",
        "Maternity Benefit Act, 1961 - paid maternity leave entitlement",
    ],
    "Consumer Complaint": [
        "Consumer Protection Act, 2019 - Section 2(9): definition of unfair trade practice; Section 35: complaint filing to District Commission",
        "Consumer Protection Act, 2019 - Section 69: limitation period of 2 years from date of cause of action",
        "Consumer Protection (E-Commerce) Rules, 2020 - duties of e-commerce entities, return/refund disclosure",
    ],
    "RTI": [
        "Right to Information Act, 2005 - Section 6: how to file an RTI application; Section 7: response within 30 days (48 hrs if life/liberty involved)",
        "RTI Act, 2005 - Section 19: first appeal to appellate authority, second appeal to Information Commission",
        "RTI Act, 2005 - Section 20: penalty on Public Information Officer for delay/refusal without reasonable cause",
    ],
    "Other": [
        "Constitution of India - Article 21: right to life and personal liberty (used as a general fallback)",
        "Legal Services Authorities Act, 1987 - free legal aid entitlement for eligible citizens",
    ],
}


def get_reference_for(category: str) -> str:
    """Return a plain-text block of reference laws for a category (or 'Other')."""
    laws = LAW_REFERENCE.get(category, LAW_REFERENCE["Other"])
    return "\n".join(f"- {law}" for law in laws)