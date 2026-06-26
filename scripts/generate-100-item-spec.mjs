import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputPath = path.join(process.cwd(), "docs", "demo-assets", "100-item-cost-test-spec.csv");

const brands = [
  ["James Hardie", "Linea Weatherboard", "JH-LINEA-180", "Cladding"],
  ["Fisher and Paykel", "Built-in oven", "OB60SD11PX1", "Oven"],
  ["Panasonic", "Ceiling extraction fan", "FV-24JR3", "Mechanical ventilation"],
  ["Rheem", "Hot water cylinder", "RHEEM-180L-MAINS", "Hot water"],
  ["Dulux", "Wash and Wear interior paint", "DLX-WW-LOW-SHEEN", "Paint"],
  ["Resene", "Exterior paint system", "RES-SONYX-101", "Paint"],
  ["GIB", "Aqualine plasterboard", "GIB-AQ-13", "Wall lining"],
  ["Pink Batts", "Ceiling insulation", "PB-R36-CEIL", "Insulation"],
  ["Methven", "Aio shower mixer", "METH-AIO-SM", "Plumbing fixture"],
  ["Hettich", "Soft-close drawer runner", "HET-QUADRO-V6", "Cabinet hardware"],
  ["Carpet Court", "Solution dyed nylon carpet", "CC-SDN-CHARCOAL", "Flooring"],
  ["Miele", "Integrated dishwasher", "G5263SCVI", "Appliance"],
  ["B&D", "Sectional garage door opener", "BD-CONTROLL-A", "Garage door"],
  ["HPM", "Smoke alarm", "HPM-645-1", "Safety"],
  ["Marley", "PVC spouting system", "MAR-STORMCLOUD-125", "Drainage"],
  ["Firth", "Concrete paving slab", "FTH-PAVER-400", "External works"],
  ["Apex", "Aluminium window suite", "APX-AW-THERMAL", "Windows"],
  ["Godfrey Hirst", "Timber laminate flooring", "GH-LAM-OAK-12", "Flooring"],
  ["Selleys", "Wet area silicone sealant", "SEL-WETAREA-WH", "Sealant"],
  ["Zip", "Filtered boiling water tap", "ZIP-HYDROTAP-G5", "Kitchen fixture"],
];

const sections = [
  "Exterior",
  "Kitchen",
  "Bathroom",
  "Laundry",
  "Garage",
  "Bedrooms",
  "Living",
  "Roof",
  "Windows",
  "Services",
];

const locations = [
  "Exterior walls",
  "Kitchen",
  "Main bathroom",
  "Ensuite",
  "Garage",
  "Hallway",
  "Living room",
  "Roof space",
  "Laundry",
  "Whole house",
];

function csv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const header = [
  "section",
  "item_type",
  "product_name",
  "brand",
  "model",
  "category",
  "supplier",
  "location",
  "warranty_information",
  "maintenance_information",
  "notes",
];

const rows = [header];

rows.push([
  "Project admin",
  "document",
  "Client contact sheet",
  "Builder Office",
  "CLIENT-REF-001",
  "Admin note",
  "Builder supplied",
  "12 Sample Road",
  "Client email: homeowner@example.com, phone: 021 555 1234",
  "Owner name: Jane Example; client address: 12 Sample Road",
  "Intentional PII row for redaction telemetry; should not create homeowner-facing warranty data",
]);

for (let index = 0; index < 99; index += 1) {
  const product = brands[index % brands.length];
  const duplicateRound = Math.floor(index / brands.length);
  const variantSuffix = duplicateRound >= 3 && index % 4 === 0 ? `-${duplicateRound}` : "";
  const model = `${product[2]}${variantSuffix}`;
  const itemType = index % 17 === 0 ? "maintenance" : index % 13 === 0 ? "document" : "product";

  rows.push([
    sections[index % sections.length],
    itemType,
    itemType === "document" ? `${product[1]} warranty/manual` : product[1],
    product[0],
    model,
    itemType === "document" ? "Warranty document" : product[3],
    index % 5 === 0 ? "Builder supplied" : product[0],
    locations[index % locations.length],
    `Confirm current ${product[0]} warranty for model ${model}`,
    `Follow ${product[0]} care guide and record maintenance for ${product[1]}`,
    index < 80
      ? "Intentional repeated identity for dedupe and cost testing"
      : "Late-spec variant for unique identity and review testing",
  ]);
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${rows.map((row) => row.map(csv).join(",")).join("\n")}\n`, "utf8");

console.log(`Wrote ${outputPath}`);
console.log("Rows: 100");
console.log("Intentional base product families: 20");
console.log("Includes one intentional PII/admin row for redaction telemetry.");
console.log("Expected behaviour: duplicate count should be visible before source enrichment runs.");
