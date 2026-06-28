export const projectExposureZones = [
  "standard",
  "coastal_sea_spray",
  "geothermal",
  "coastal_and_geothermal",
] as const;

export type ProjectExposureZone = (typeof projectExposureZones)[number];

export type MaintenanceSchedule = {
  key: string;
  title: string;
  defaultFrequencyMonths: number;
  coastalFrequencyMonths?: number;
  geothermalFrequencyMonths?: number;
  description: string;
  startBasis: "ccc_granted_date";
};

export const maintenanceSchedules: MaintenanceSchedule[] = [
  {
    key: "clean-exterior-house",
    title: "Clean outside of house",
    defaultFrequencyMonths: 6,
    coastalFrequencyMonths: 3,
    geothermalFrequencyMonths: 3,
    description: "Wash exterior cladding, joinery, exposed fixings, soffits, and nearby surfaces. Coastal sea spray and geothermal exposure use a shorter interval.",
    startBasis: "ccc_granted_date",
  },
  {
    key: "clear-gutters-downpipes",
    title: "Clear gutters and downpipes",
    defaultFrequencyMonths: 6,
    coastalFrequencyMonths: 3,
    geothermalFrequencyMonths: 6,
    description: "Clear leaves, check downpipes, and confirm water discharges away from the building.",
    startBasis: "ccc_granted_date",
  },
  {
    key: "service-heat-pump",
    title: "Service heat pump / ventilation",
    defaultFrequencyMonths: 12,
    coastalFrequencyMonths: 12,
    geothermalFrequencyMonths: 12,
    description: "Clean filters and arrange model-specific servicing where required by the supplier or manufacturer.",
    startBasis: "ccc_granted_date",
  },
];

export function getMaintenanceSchedule(key?: string | null) {
  return maintenanceSchedules.find((schedule) => schedule.key === key) || null;
}

export function getEffectiveMaintenanceFrequencyMonths(
  schedule: MaintenanceSchedule,
  exposureZone: ProjectExposureZone = "standard",
) {
  if (exposureZone === "coastal_and_geothermal") {
    return Math.min(
      schedule.coastalFrequencyMonths || schedule.defaultFrequencyMonths,
      schedule.geothermalFrequencyMonths || schedule.defaultFrequencyMonths,
    );
  }

  if (exposureZone === "coastal_sea_spray") {
    return schedule.coastalFrequencyMonths || schedule.defaultFrequencyMonths;
  }

  if (exposureZone === "geothermal") {
    return schedule.geothermalFrequencyMonths || schedule.defaultFrequencyMonths;
  }

  return schedule.defaultFrequencyMonths;
}

export function formatExposureZone(zone?: ProjectExposureZone | string | null) {
  const labels: Record<ProjectExposureZone, string> = {
    standard: "Standard exposure",
    coastal_sea_spray: "Coastal / sea spray zone",
    geothermal: "Geothermal zone",
    coastal_and_geothermal: "Coastal + geothermal exposure",
  };

  return labels[(zone || "standard") as ProjectExposureZone] || labels.standard;
}

export function calculateNextMaintenanceDueDate(
  cccGrantedDate: string | undefined,
  scheduleKey: string,
  exposureZone: ProjectExposureZone = "standard",
) {
  const schedule = getMaintenanceSchedule(scheduleKey);
  if (!schedule || !cccGrantedDate) {
    return "";
  }

  const start = new Date(`${cccGrantedDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    return "";
  }

  const due = new Date(start);
  due.setMonth(due.getMonth() + getEffectiveMaintenanceFrequencyMonths(schedule, exposureZone));
  return due.toISOString().slice(0, 10);
}
