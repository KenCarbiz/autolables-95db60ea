import { useState, useEffect } from "react";

export type GetReadyStatus = "pending" | "in_progress" | "inspection" | "detail" | "photo" | "ready" | "inventory";

export type InstallMethod = "internal_ro" | "third_party_check_request";

export interface CheckRequest {
  id: string;
  vendorName: string;
  vendorContact: string;
  vendorPhone: string;
  vendorEmail: string;
  poNumber: string;
  amount: number;
  description: string;
  vehicleVin: string;
  vehicleYmm: string;
  stockNumber: string;
  status: "pending" | "submitted" | "approved" | "paid";
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  createdAt: string;
}

export interface GetReadyItem {
  id: string;
  label: string;
  category: "accessory" | "inspection" | "detail" | "photo" | "other";
  assignedTo: string;
  status: "pending" | "complete";
  completedAt?: string;
  completedBy?: string;
  notes?: string;
  // Install method — dealer chooses per item
  installMethod?: InstallMethod;
  roNumber?: string;           // If internal RO
  checkRequest?: CheckRequest; // If third-party check request
}

export interface GetReadyRecord {
  id: string;
  storeId: string;
  vin: string;
  stockNumber: string;
  ymm: string;
  condition: "new" | "used";

  // Timeline — proves accessories installed BEFORE inventory date
  acquiredDate: string;        // Date dealer acquired the vehicle
  getReadyStartDate: string;   // Date get-ready process began
  getReadyCompleteDate: string; // Date car was marked ready for sale
  inventoryDate: string;       // Date car hit active inventory for sale

  // Checklist items
  items: GetReadyItem[];

  // Accessories to install (from products)
  accessoriesToInstall: { productId: string; productName: string; installed: boolean; installedDate?: string; installedBy?: string }[];

  // Inspection
  inspectionRequired: boolean;
  inspectionFormType?: string;  // e.g. "CT-K208"
  inspectionComplete: boolean;
  inspectionDate?: string;
  inspectionBy?: string;
  inspectionSignatureData?: string;
  autocurbInspectionId?: string; // Link to autocurb.io inspection if available

  // Service department assignment
  assignedTechnician: string;
  serviceAdvisor: string;
  roNumber: string;

  // Overall status
  status: GetReadyStatus;

  // Metadata
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

const STORAGE_KEY = "get_ready_records";

export const useGetReady = (storeId: string) => {
  const [records, setRecords] = useState<GetReadyRecord[]>([]);

  useEffect(() => { load(); }, [storeId]);

  const load = () => {
    try {
      const all: GetReadyRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      setRecords(all.filter(r => r.storeId === storeId));
    } catch { /* */ }
  };

  const getAll = (): GetReadyRecord[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  };

  const persist = (all: GetReadyRecord[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    setRecords(all.filter(r => r.storeId === storeId));
  };

  const createGetReady = (data: {
    vin: string;
    stockNumber: string;
    ymm: string;
    condition: "new" | "used";
    acquiredDate: string;
    accessoriesToInstall: { productId: string; productName: string }[];
    inspectionRequired: boolean;
    inspectionFormType?: string;
    assignedTechnician?: string;
    serviceAdvisor?: string;
    roNumber?: string;
    createdBy: string;
  }): GetReadyRecord => {
    const now = new Date().toISOString();

    // Build default checklist
    const items: GetReadyItem[] = [];

    // Add accessory installation items
    data.accessoriesToInstall.forEach(acc => {
      items.push({
        id: crypto.randomUUID(),
        label: `Install: ${acc.productName}`,
        category: "accessory",
        assignedTo: data.assignedTechnician || "",
        status: "pending",
      });
    });

    // Add inspection if required
    if (data.inspectionRequired) {
      items.push({
        id: crypto.randomUUID(),
        label: `Safety Inspection${data.inspectionFormType ? ` (${data.inspectionFormType})` : ""}`,
        category: "inspection",
        assignedTo: data.serviceAdvisor || "",
        status: "pending",
      });
    }

    // Standard get-ready items
    items.push(
      { id: crypto.randomUUID(), label: "Detail — interior", category: "detail", assignedTo: "", status: "pending" },
      { id: crypto.randomUUID(), label: "Detail — exterior wash", category: "detail", assignedTo: "", status: "pending" },
      { id: crypto.randomUUID(), label: "Photos for listing", category: "photo", assignedTo: "", status: "pending" },
    );

    const record: GetReadyRecord = {
      id: crypto.randomUUID(),
      storeId,
      vin: data.vin,
      stockNumber: data.stockNumber,
      ymm: data.ymm,
      condition: data.condition,
      acquiredDate: data.acquiredDate,
      getReadyStartDate: now,
      getReadyCompleteDate: "",
      inventoryDate: "",
      items,
      accessoriesToInstall: data.accessoriesToInstall.map(a => ({
        ...a,
        installed: false,
      })),
      inspectionRequired: data.inspectionRequired,
      inspectionFormType: data.inspectionFormType,
      inspectionComplete: false,
      assignedTechnician: data.assignedTechnician || "",
      serviceAdvisor: data.serviceAdvisor || "",
      roNumber: data.roNumber || "",
      status: "pending",
      createdAt: now,
      createdBy: data.createdBy,
      updatedAt: now,
    };

    persist([...getAll(), record]);
    return record;
  };

  const completeItem = (recordId: string, itemId: string, completedBy: string) => {
    const all = getAll();
    const record = all.find(r => r.id === recordId);
    if (!record) return;
    const item = record.items.find(i => i.id === itemId);
    if (!item) return;
    item.status = "complete";
    item.completedAt = new Date().toISOString();
    item.completedBy = completedBy;
    record.updatedAt = new Date().toISOString();

    // Check if all items complete → mark get-ready as ready
    if (record.items.every(i => i.status === "complete")) {
      record.status = "ready";
      record.getReadyCompleteDate = new Date().toISOString();
    } else {
      record.status = "in_progress";
    }

    persist(all);
  };

  const markInventory = (recordId: string) => {
    const all = getAll();
    const record = all.find(r => r.id === recordId);
    if (!record) return;

    // Validate get-ready is complete before allowing inventory date
    if (record.status !== "ready") return;

    record.inventoryDate = new Date().toISOString();
    record.status = "inventory";
    record.updatedAt = new Date().toISOString();
    persist(all);
  };

  const completeInspection = (recordId: string, data: {
    inspectedBy: string;
    signatureData?: string;
    autocurbInspectionId?: string;
  }) => {
    const all = getAll();
    const record = all.find(r => r.id === recordId);
    if (!record) return;
    record.inspectionComplete = true;
    record.inspectionDate = new Date().toISOString();
    record.inspectionBy = data.inspectedBy;
    record.inspectionSignatureData = data.signatureData;
    record.autocurbInspectionId = data.autocurbInspectionId;
    record.updatedAt = new Date().toISOString();

    // Mark inspection checklist item as complete
    const inspItem = record.items.find(i => i.category === "inspection");
    if (inspItem) {
      inspItem.status = "complete";
      inspItem.completedAt = new Date().toISOString();
      inspItem.completedBy = data.inspectedBy;
    }

    persist(all);
  };

  const markAccessoryInstalled = (recordId: string, productId: string, installedBy: string) => {
    const all = getAll();
    const record = all.find(r => r.id === recordId);
    if (!record) return;
    const acc = record.accessoriesToInstall.find(a => a.productId === productId);
    if (!acc) return;
    acc.installed = true;
    acc.installedDate = new Date().toISOString();
    acc.installedBy = installedBy;
    record.updatedAt = new Date().toISOString();

    // Mark matching checklist item as complete
    const item = record.items.find(i => i.category === "accessory" && i.label === `Install: ${acc.productName}`);
    if (item) {
      item.status = "complete";
      item.completedAt = new Date().toISOString();
      item.completedBy = installedBy;
    }

    persist(all);
  };

  const getByVin = (vin: string): GetReadyRecord | null =>
    records.find(r => r.vin === vin) || null;

  // Set install method for a checklist item
  const setInstallMethod = (recordId: string, itemId: string, method: InstallMethod, data?: {
    roNumber?: string;
    checkRequest?: Omit<CheckRequest, "id" | "createdAt">;
  }) => {
    const all = getAll();
    const record = all.find(r => r.id === recordId);
    if (!record) return;
    const item = record.items.find(i => i.id === itemId);
    if (!item) return;

    item.installMethod = method;

    if (method === "internal_ro" && data?.roNumber) {
      item.roNumber = data.roNumber;
    }

    if (method === "third_party_check_request" && data?.checkRequest) {
      item.checkRequest = {
        ...data.checkRequest,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
    }

    record.updatedAt = new Date().toISOString();
    persist(all);
  };

  // Get all pending check requests across all get-ready records
  const getPendingCheckRequests = (): { record: GetReadyRecord; item: GetReadyItem; checkRequest: CheckRequest }[] => {
    const results: { record: GetReadyRecord; item: GetReadyItem; checkRequest: CheckRequest }[] = [];
    for (const record of records) {
      for (const item of record.items) {
        if (item.checkRequest && item.checkRequest.status !== "paid") {
          results.push({ record, item, checkRequest: item.checkRequest });
        }
      }
    }
    return results;
  };

  const getPending = (): GetReadyRecord[] =>
    records.filter(r => r.status !== "inventory");

  // Full timeline validation — the compliance chain
  // Acquired → Get-Ready Start → Accessories Installed → Get-Ready Complete → Ready for Sale → Addendum Date → Delivery
  const validateTimeline = (record: GetReadyRecord): { valid: boolean; warnings: string[]; chain: { step: string; date: string; ok: boolean }[] } => {
    const warnings: string[] = [];

    const acquired = record.acquiredDate ? new Date(record.acquiredDate) : null;
    const getReadyStart = record.getReadyStartDate ? new Date(record.getReadyStartDate) : null;
    const getReadyComplete = record.getReadyCompleteDate ? new Date(record.getReadyCompleteDate) : null;
    const inventory = record.inventoryDate ? new Date(record.inventoryDate) : null;

    // Find earliest and latest accessory install dates
    const installDates = record.accessoriesToInstall
      .filter(a => a.installedDate)
      .map(a => new Date(a.installedDate!));
    const earliestInstall = installDates.length > 0 ? new Date(Math.min(...installDates.map(d => d.getTime()))) : null;
    const latestInstall = installDates.length > 0 ? new Date(Math.max(...installDates.map(d => d.getTime()))) : null;

    // Build chain
    const chain: { step: string; date: string; ok: boolean }[] = [
      { step: "Vehicle Acquired", date: record.acquiredDate || "Not set", ok: !!acquired },
      { step: "Get-Ready Started", date: record.getReadyStartDate || "Not set", ok: !!getReadyStart },
    ];

    if (earliestInstall) {
      chain.push({ step: "First Accessory Installed", date: earliestInstall.toISOString(), ok: true });
    }
    if (latestInstall) {
      chain.push({ step: "Last Accessory Installed", date: latestInstall.toISOString(), ok: true });
    }
    if (record.inspectionDate) {
      chain.push({ step: "Safety Inspection", date: record.inspectionDate, ok: true });
    }

    chain.push({ step: "Get-Ready Complete", date: record.getReadyCompleteDate || "Pending", ok: !!getReadyComplete });
    chain.push({ step: "Ready for Sale (Inventory)", date: record.inventoryDate || "Pending", ok: !!inventory });

    // Validation rules
    if (acquired && getReadyStart && getReadyStart < acquired) {
      warnings.push("Get-ready start date is BEFORE acquisition date.");
    }
    if (acquired && earliestInstall && earliestInstall < acquired) {
      warnings.push("Accessories installed BEFORE vehicle was acquired.");
    }
    if (getReadyComplete && inventory && getReadyComplete > inventory) {
      warnings.push("Get-ready completed AFTER inventory date — accessories may have been installed after vehicle was listed for sale.");
    }
    if (latestInstall && inventory && latestInstall > inventory) {
      warnings.push("Accessories installed AFTER inventory date — this is a compliance risk.");
    }
    if (getReadyComplete && !inventory) {
      // This is fine — waiting to add to inventory
    }
    if (inventory && !getReadyComplete) {
      warnings.push("Vehicle in inventory but get-ready not marked complete.");
    }

    // Check all accessories are installed before inventory
    const uninstalled = record.accessoriesToInstall.filter(a => !a.installed);
    if (inventory && uninstalled.length > 0) {
      warnings.push(`${uninstalled.length} accessory(ies) not yet installed but vehicle is in inventory: ${uninstalled.map(a => a.productName).join(", ")}`);
    }

    return {
      valid: warnings.length === 0,
      warnings,
      chain,
    };
  };

  return {
    records,
    createGetReady,
    completeItem,
    markInventory,
    completeInspection,
    markAccessoryInstalled,
    getByVin,
    getPending,
    setInstallMethod,
    getPendingCheckRequests,
    validateTimeline,
  };
};
