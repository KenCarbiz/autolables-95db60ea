import { useState, useEffect, useCallback } from "react";
import type {
  VehicleFile,
  StickerRecord,
  SigningRecord,
  AftermarketInstall,
  AttachedDocument,
  AttachedDocType,
  StickerType,
  DealStatus,
} from "@/types/vehicleFile";

const STORAGE_KEY = "vehicle_files";

/**
 * Generate a unique tracking code (UPC) for each sticker.
 * Format: AC-{STORE_PREFIX}-{VIN_LAST6}-{TYPE_CODE}-{TIMESTAMP_HEX}
 *
 * This code is printed on the sticker and can be scanned or typed
 * to retrieve the full vehicle file and its legal addendum.
 */
function generateTrackingCode(vin: string, type: StickerType, storeId: string): string {
  const storePrefix = storeId.slice(0, 4).toUpperCase();
  const vinSuffix = vin.slice(-6).toUpperCase();
  const typeCode: Record<StickerType, string> = {
    new_car_addendum: "NA",
    used_car_sticker: "US",
    used_car_addendum: "UA",
    buyers_guide: "BG",
    trade_up: "TU",
    stock_label: "SL",
  };
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  return `AC-${storePrefix}-${vinSuffix}-${typeCode[type]}-${ts}`;
}

/**
 * Generate a simple content hash for immutability verification.
 * In production, use SubtleCrypto.digest("SHA-256", ...) for a real hash.
 */
function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export const useVehicleFiles = (storeId: string) => {
  const [files, setFiles] = useState<VehicleFile[]>([]);

  useEffect(() => {
    load();
  }, [storeId]);

  const load = () => {
    try {
      const all: VehicleFile[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      setFiles(all.filter(f => f.store_id === storeId));
    } catch { /* ignore */ }
  };

  const getAll = (): VehicleFile[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  };

  const persist = (all: VehicleFile[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    setFiles(all.filter(f => f.store_id === storeId));
  };

  // Get or create a vehicle file by VIN
  const getOrCreateFile = useCallback((data: {
    vin: string;
    year: string;
    make: string;
    model: string;
    trim: string;
    stock_number: string;
    condition: "new" | "used" | "cpo";
    mileage: number;
    msrp?: number;
    market_value?: number;
    factory_equipment?: string[];
    created_by: string;
  }): VehicleFile => {
    const all = getAll();
    const existing = all.find(f => f.vin === data.vin && f.store_id === storeId);
    if (existing) {
      // Update mutable fields
      const updated = {
        ...existing,
        stock_number: data.stock_number || existing.stock_number,
        mileage: data.mileage || existing.mileage,
        msrp: data.msrp || existing.msrp,
        market_value: data.market_value || existing.market_value,
        factory_equipment: data.factory_equipment?.length
          ? data.factory_equipment
          : existing.factory_equipment,
        updated_at: new Date().toISOString(),
      };
      persist(all.map(f => f.id === existing.id ? updated : f));
      return updated;
    }

    const file: VehicleFile = {
      id: crypto.randomUUID(),
      store_id: storeId,
      vin: data.vin,
      year: data.year,
      make: data.make,
      model: data.model,
      trim: data.trim,
      stock_number: data.stock_number,
      condition: data.condition,
      mileage: data.mileage,
      msrp: data.msrp || 0,
      market_value: data.market_value || 0,
      factory_equipment: data.factory_equipment || [],
      aftermarket_installs: [],
      stickers: [],
      signings: [],
      attached_documents: [],
      deal_qr_token: crypto.randomUUID(),
      deal_status: "stickered",
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      cobuyer_name: "",
      cobuyer_phone: "",
      cobuyer_email: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: data.created_by,
    };

    persist([...all, file]);
    return file;
  }, [storeId]);

  // Register a printed sticker against a vehicle file
  const registerSticker = useCallback((
    fileId: string,
    type: StickerType,
    data: {
      paper_size: string;
      products_snapshot: any[];
      base_price: number;
      accessories_total: number;
      doc_fee: number;
      printed_by: string;
    }
  ): StickerRecord => {
    const all = getAll();
    const file = all.find(f => f.id === fileId);
    if (!file) throw new Error("Vehicle file not found");

    const token = crypto.randomUUID();
    const signingUrl = `${window.location.origin}/sign/${token}`;

    const sticker: StickerRecord = {
      id: crypto.randomUUID(),
      type,
      tracking_code: generateTrackingCode(file.vin, type, storeId),
      signing_url: signingUrl,
      signing_token: token,
      printed_at: new Date().toISOString(),
      printed_by: data.printed_by,
      paper_size: data.paper_size,
      content_hash: simpleHash(JSON.stringify({
        vin: file.vin,
        type,
        products: data.products_snapshot,
        prices: { base: data.base_price, acc: data.accessories_total, doc: data.doc_fee },
        ts: new Date().toISOString(),
      })),
      products_snapshot: data.products_snapshot,
      totals: {
        base_price: data.base_price,
        accessories_total: data.accessories_total,
        doc_fee: data.doc_fee,
        final_price: data.base_price + data.accessories_total + data.doc_fee,
      },
      status: "printed",
    };

    const updatedFile = { ...file, stickers: [...file.stickers, sticker], updated_at: new Date().toISOString() };
    persist(all.map(f => f.id === fileId ? updatedFile : f));
    return sticker;
  }, [storeId]);

  // Record a signing event
  const recordSigning = useCallback((
    fileId: string,
    stickerId: string,
    data: Omit<SigningRecord, "id" | "sticker_id" | "signed_at">
  ): SigningRecord => {
    const all = getAll();
    const file = all.find(f => f.id === fileId);
    if (!file) throw new Error("Vehicle file not found");

    const signing: SigningRecord = {
      ...data,
      id: crypto.randomUUID(),
      sticker_id: stickerId,
      signed_at: new Date().toISOString(),
    };

    const updatedStickers = file.stickers.map(s =>
      s.id === stickerId ? { ...s, status: "signed" as const } : s
    );
    const updatedFile = {
      ...file,
      signings: [...file.signings, signing],
      stickers: updatedStickers,
      deal_status: "signed" as const,
      customer_name: data.customer_name,
      updated_at: new Date().toISOString(),
    };
    persist(all.map(f => f.id === fileId ? updatedFile : f));
    return signing;
  }, [storeId]);

  // Update deal status
  const updateDealStatus = useCallback((fileId: string, status: DealStatus) => {
    const all = getAll();
    const file = all.find(f => f.id === fileId);
    if (!file) return;
    persist(all.map(f => f.id === fileId ? { ...f, deal_status: status, updated_at: new Date().toISOString() } : f));
  }, [storeId]);

  // Update customer info
  const updateCustomer = useCallback((fileId: string, data: {
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
  }) => {
    const all = getAll();
    const file = all.find(f => f.id === fileId);
    if (!file) return;
    const updated = {
      ...file,
      ...(data.customer_name !== undefined ? { customer_name: data.customer_name } : {}),
      ...(data.customer_phone !== undefined ? { customer_phone: data.customer_phone } : {}),
      ...(data.customer_email !== undefined ? { customer_email: data.customer_email } : {}),
      updated_at: new Date().toISOString(),
    };
    persist(all.map(f => f.id === fileId ? updated : f));
  }, [storeId]);

  // Void a sticker
  const voidSticker = useCallback((fileId: string, stickerId: string, reason: string) => {
    const all = getAll();
    const file = all.find(f => f.id === fileId);
    if (!file) return;
    if (!file.stickers.find(s => s.id === stickerId)) return;
    const updatedFile = {
      ...file,
      stickers: file.stickers.map(s => s.id === stickerId
        ? { ...s, status: "voided" as const, voided_at: new Date().toISOString(), voided_reason: reason }
        : s
      ),
      updated_at: new Date().toISOString(),
    };
    persist(all.map(f => f.id === fileId ? updatedFile : f));
  }, [storeId]);

  // Record an aftermarket install on a vehicle
  const addAftermarketInstall = useCallback((fileId: string, data: Omit<AftermarketInstall, "id" | "created_at">): AftermarketInstall | null => {
    const all = getAll();
    const file = all.find(f => f.id === fileId);
    if (!file) return null;

    const install: AftermarketInstall = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    const updatedFile = {
      ...file,
      aftermarket_installs: [...(file.aftermarket_installs || []), install],
      updated_at: new Date().toISOString(),
    };
    persist(all.map(f => f.id === fileId ? updatedFile : f));
    return install;
  }, [storeId]);

  // Look up a vehicle file by tracking code
  const findByTrackingCode = useCallback((code: string): {
    file: VehicleFile;
    sticker: StickerRecord;
  } | null => {
    const all = getAll();
    for (const file of all) {
      for (const sticker of file.stickers) {
        if (sticker.tracking_code === code) {
          return { file, sticker };
        }
      }
    }
    return null;
  }, []);

  // Look up by VIN
  const findByVin = useCallback((vin: string): VehicleFile | null => {
    return files.find(f => f.vin === vin) || null;
  }, [files]);

  // Attach a compliance document (K-208, FTC Buyers Guide, etc.)
  const attachDocument = useCallback((fileId: string, doc: {
    type: AttachedDocType;
    label: string;
    data: any;
    created_by: string;
  }): AttachedDocument | null => {
    const all = getAll();
    const file = all.find(f => f.id === fileId);
    if (!file) return null;

    const attached: AttachedDocument = {
      id: crypto.randomUUID(),
      type: doc.type,
      label: doc.label,
      data: doc.data,
      created_at: new Date().toISOString(),
      created_by: doc.created_by,
    };

    const updatedFile = {
      ...file,
      attached_documents: [...(file.attached_documents || []), attached],
      updated_at: new Date().toISOString(),
    };
    persist(all.map(f => f.id === fileId ? updatedFile : f));
    return attached;
  }, [storeId]);

  // Look up by deal QR token (for the signing flow when car is sold)
  const findByDealQrToken = useCallback((token: string): VehicleFile | null => {
    const all = getAll();
    return all.find(f => f.deal_qr_token === token) || null;
  }, []);

  // Look up by signing token
  const findBySigningToken = useCallback((token: string): {
    file: VehicleFile;
    sticker: StickerRecord;
  } | null => {
    const all = getAll();
    for (const file of all) {
      for (const sticker of file.stickers) {
        if (sticker.signing_token === token) {
          return { file, sticker };
        }
      }
    }
    return null;
  }, []);

  // Stats
  const stats = {
    totalFiles: files.length,
    totalStickers: files.reduce((sum, f) => sum + f.stickers.length, 0),
    pendingSign: files.filter(f => f.deal_status === "pending_sign").length,
    signed: files.filter(f => f.deal_status === "signed").length,
    delivered: files.filter(f => f.deal_status === "delivered").length,
  };

  return {
    files,
    stats,
    getOrCreateFile,
    registerSticker,
    recordSigning,
    updateDealStatus,
    updateCustomer,
    voidSticker,
    addAftermarketInstall,
    attachDocument,
    findByTrackingCode,
    findByVin,
    findByDealQrToken,
    findBySigningToken,
  };
};
