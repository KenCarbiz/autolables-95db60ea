import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDealerSettings } from "@/contexts/DealerSettingsContext";
import { useAudit } from "@/contexts/AuditContext";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type GuideType = "as-is" | "implied" | "warranty";
type Language = "en" | "es";

interface VehicleInfo {
  year: string;
  make: string;
  model: string;
  vin: string;
  stock: string;
  mileage: string;
  price: string;
}

const LABELS: Record<Language, Record<string, string>> = {
  en: {
    title: "BUYERS GUIDE",
    important: "IMPORTANT: Spoken promises are difficult to enforce. Ask the dealer to put all promises in writing. Keep this form.",
    warranties_heading: "WARRANTIES FOR THIS VEHICLE:",
    as_is_title: "AS IS — NO DEALER WARRANTY",
    as_is_body: "YOU WILL PAY ALL COSTS FOR ANY REPAIRS. The dealer assumes no responsibility for any repairs regardless of any oral statements about the vehicle.",
    implied_title: "IMPLIED WARRANTIES ONLY",
    implied_body: "The dealer makes no warranties, express or implied, on this vehicle, except for implied warranties of merchantability. Implied warranty of merchantability means that the dealer warrants that the vehicle will pass without objection in the trade and is fit for the ordinary purpose for which it is used. The entire risk as to quality and performance is with the buyer. However, the buyer may have other rights under applicable state law.",
    warranty_title: "DEALER WARRANTY",
    warranty_body: "The dealer will pay a percentage of the labor and parts costs for the covered systems that fail during the warranty period.",
    warranty_duration: "WARRANTY DURATION:",
    warranty_percentage: "PERCENTAGE OF COSTS COVERED:",
    covered_systems: "SYSTEMS COVERED:",
    system_engine: "Engine — All lubricated internal engine parts, water pump, fuel pump, manifolds, engine block, cylinder heads, rotary engine housings and flywheel.",
    system_transmission: "Transmission — All lubricated internal transmission parts, torque converter, drive shaft, universal joints, rear axle, and all internally lubricated parts.",
    system_steering: "Steering — The steering gear housing and all internal parts, power steering pump, valve body, piston and rack.",
    system_brakes: "Brakes — Master cylinder, vacuum assist booster, wheel cylinders, hydraulic lines and fittings, and disc brake calipers.",
    system_electrical: "Electrical — Alternator, voltage regulator, starter, ignition switch, and electronic ignition.",
    service_contact: "SERVICE CONTRACT",
    service_body: "A service contract is available at an extra charge on this vehicle. Ask for details as to coverage, deductible, price, and exclusions. If you buy a service contract within 90 days of the time of sale, state law \"implied warranties\" may give you additional rights.",
    pre_purchase: "PRE-PURCHASE INSPECTION: ASK THE DEALER IF YOU MAY HAVE THIS VEHICLE INSPECTED BY YOUR MECHANIC EITHER ON OR OFF THE LOT.",
    vehicle_make: "Vehicle Make",
    vehicle_model: "Model",
    vehicle_year: "Year",
    vehicle_vin: "VIN Number",
    mileage: "Mileage",
    price: "Price",
    stock_no: "Stock No.",
    dealer_name: "Dealer Name",
    dealer_address: "Address",
  },
  es: {
    title: "GUÍA DEL COMPRADOR",
    important: "IMPORTANTE: Las promesas verbales son difíciles de hacer cumplir. Pida al concesionario que ponga todas las promesas por escrito. Conserve este formulario.",
    warranties_heading: "GARANTÍAS PARA ESTE VEHÍCULO:",
    as_is_title: "TAL COMO ESTÁ — SIN GARANTÍA DEL CONCESIONARIO",
    as_is_body: "USTED PAGARÁ TODOS LOS COSTOS DE CUALQUIER REPARACIÓN. El concesionario no asume ninguna responsabilidad por cualquier reparación sin importar cualquier declaración verbal sobre el vehículo.",
    implied_title: "SOLO GARANTÍAS IMPLÍCITAS",
    implied_body: "El concesionario no hace ninguna garantía, expresa o implícita, sobre este vehículo, excepto las garantías implícitas de comerciabilidad. La garantía implícita de comerciabilidad significa que el concesionario garantiza que el vehículo pasará sin objeción en el comercio y es apto para el propósito ordinario para el cual se usa. Todo el riesgo en cuanto a calidad y rendimiento es del comprador. Sin embargo, el comprador puede tener otros derechos según la ley estatal aplicable.",
    warranty_title: "GARANTÍA DEL CONCESIONARIO",
    warranty_body: "El concesionario pagará un porcentaje de los costos de mano de obra y piezas para los sistemas cubiertos que fallen durante el período de garantía.",
    warranty_duration: "DURACIÓN DE LA GARANTÍA:",
    warranty_percentage: "PORCENTAJE DE COSTOS CUBIERTOS:",
    covered_systems: "SISTEMAS CUBIERTOS:",
    system_engine: "Motor — Todas las partes internas lubricadas del motor, bomba de agua, bomba de combustible, múltiples, bloque del motor, cabezas de cilindros, carcasas del motor rotativo y volante.",
    system_transmission: "Transmisión — Todas las partes internas lubricadas de la transmisión, convertidor de torque, eje de transmisión, juntas universales, eje trasero y todas las partes lubricadas internamente.",
    system_steering: "Dirección — La carcasa del engranaje de dirección y todas las partes internas, bomba de dirección asistida, cuerpo de válvula, pistón y cremallera.",
    system_brakes: "Frenos — Cilindro maestro, refuerzo de vacío, cilindros de rueda, líneas hidráulicas y accesorios, y calibradores de frenos de disco.",
    system_electrical: "Eléctrico — Alternador, regulador de voltaje, motor de arranque, interruptor de encendido y encendido electrónico.",
    service_contact: "CONTRATO DE SERVICIO",
    service_body: "Un contrato de servicio está disponible con un cargo extra en este vehículo. Pregunte por los detalles sobre la cobertura, deducible, precio y exclusiones. Si compra un contrato de servicio dentro de los 90 días posteriores a la venta, las \"garantías implícitas\" de la ley estatal pueden darle derechos adicionales.",
    pre_purchase: "INSPECCIÓN PREVIA A LA COMPRA: PREGUNTE AL CONCESIONARIO SI PUEDE HACER QUE ESTE VEHÍCULO SEA INSPECCIONADO POR SU MECÁNICO DENTRO O FUERA DEL LOTE.",
    vehicle_make: "Marca del Vehículo",
    vehicle_model: "Modelo",
    vehicle_year: "Año",
    vehicle_vin: "Número VIN",
    mileage: "Millaje",
    price: "Precio",
    stock_no: "No. de Stock",
    dealer_name: "Nombre del Concesionario",
    dealer_address: "Dirección",
  },
};

const WARRANTY_SYSTEMS = ["system_engine", "system_transmission", "system_steering", "system_brakes", "system_electrical"];

const BuyersGuide = () => {
  const navigate = useNavigate();
  const { settings } = useDealerSettings();
  const { log } = useAudit();
  const { currentStore } = useTenant();
  const { user } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);

  const [guideType, setGuideType] = useState<GuideType>("as-is");
  const [lang, setLang] = useState<Language>("en");
  const [vehicle, setVehicle] = useState<VehicleInfo>({
    year: "", make: "", model: "", vin: "", stock: "", mileage: "", price: "",
  });
  const [warrantyDuration, setWarrantyDuration] = useState("30 Days / 1,000 Miles");
  const [warrantyPct, setWarrantyPct] = useState("100%");
  const [coveredSystems, setCoveredSystems] = useState<string[]>(WARRANTY_SYSTEMS);

  const L = LABELS[lang];

  const handleSave = () => {
    const record = {
      id: crypto.randomUUID(),
      store_id: currentStore?.id || "",
      vehicle_vin: vehicle.vin,
      vehicle_ymm: [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" "),
      guide_type: guideType,
      language: lang,
      warranty_duration: warrantyDuration,
      warranty_percentage: warrantyPct,
      covered_systems: coveredSystems,
      created_by: user?.id || "",
      created_at: new Date().toISOString(),
    };
    const saved = JSON.parse(localStorage.getItem("buyers_guides") || "[]");
    saved.push(record);
    localStorage.setItem("buyers_guides", JSON.stringify(saved));
    log({ store_id: currentStore?.id || "", user_id: user?.id || "", action: "buyers_guide_created", entity_type: "buyers_guide", entity_id: record.id, details: { vin: vehicle.vin, type: guideType, language: lang } });
    toast.success("Buyers Guide saved!");
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    const card = cardRef.current;
    if (!card) return;
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const { default: jsPDF } = await import("jspdf");
      const canvas = await html2canvas(card, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdfWidth = 8.5;
      const pdfHeight = (canvas.height / canvas.width) * pdfWidth;
      const pdf = new jsPDF({ unit: "in", format: [pdfWidth, pdfHeight], orientation: "portrait" });
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Buyers-Guide-${vehicle.vin || "draft"}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-background py-4 px-2 md:px-4">
      {/* Controls */}
      <div className="max-w-[8.5in] mx-auto mb-3 flex flex-wrap gap-2 items-center no-print">
        <button onClick={() => navigate("/addendum")} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-navy text-primary-foreground tracking-[0.4px] hover:opacity-85">
          ← Back to Addendum
        </button>
        <div className="flex gap-1 bg-muted rounded-md p-0.5">
          {(["as-is", "implied", "warranty"] as GuideType[]).map((t) => (
            <button
              key={t}
              onClick={() => setGuideType(t)}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded ${guideType === t ? "bg-navy text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t === "as-is" ? "As-Is" : t === "implied" ? "Implied" : "Warranty"}
            </button>
          ))}
        </div>
        {settings.feature_spanish_buyers_guide && (
          <div className="flex gap-1 bg-muted rounded-md p-0.5">
            <button onClick={() => setLang("en")} className={`text-[12px] font-semibold px-3 py-1.5 rounded ${lang === "en" ? "bg-action text-primary-foreground" : "text-muted-foreground"}`}>English</button>
            <button onClick={() => setLang("es")} className={`text-[12px] font-semibold px-3 py-1.5 rounded ${lang === "es" ? "bg-action text-primary-foreground" : "text-muted-foreground"}`}>Español</button>
          </div>
        )}
        <button onClick={handlePrint} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-navy text-primary-foreground tracking-[0.4px] hover:opacity-85">
          Print
        </button>
        <button onClick={handleDownloadPdf} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-navy text-primary-foreground tracking-[0.4px] hover:opacity-85">
          Download PDF
        </button>
        {user && (
          <button onClick={handleSave} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-teal text-primary-foreground tracking-[0.4px] hover:opacity-85">
            Save Guide
          </button>
        )}
      </div>

      {/* Guide Card — FTC mandates minimum 11" high × 7.25" wide (16 CFR § 455) */}
      <div ref={cardRef} className="mx-auto bg-card shadow-lg rounded-lg overflow-hidden border-2 border-foreground" style={{ minWidth: "7.25in", minHeight: "11in", maxWidth: "8.5in" }}>
        {/* Header */}
        <div className="bg-foreground text-card text-center py-3 px-4">
          <h1 className="text-2xl font-extrabold tracking-wide font-barlow-condensed uppercase">{L.title}</h1>
        </div>

        {/* Important notice */}
        <div className="bg-gold/20 border-b-2 border-foreground px-4 py-2">
          <p className="text-[10px] font-bold text-foreground leading-tight">{L.important}</p>
        </div>

        {/* Vehicle info */}
        <div className="grid grid-cols-4 gap-3 px-4 py-3 border-b-2 border-foreground">
          {[
            { label: L.vehicle_year, key: "year" as const },
            { label: L.vehicle_make, key: "make" as const },
            { label: L.vehicle_model, key: "model" as const },
            { label: L.stock_no, key: "stock" as const },
          ].map(f => (
            <div key={f.key}>
              <span className="text-[8px] font-bold text-muted-foreground uppercase">{f.label}</span>
              <input
                value={vehicle[f.key]}
                onChange={(e) => setVehicle({ ...vehicle, [f.key]: e.target.value })}
                className="w-full border-b border-border-custom bg-transparent text-xs text-foreground outline-none py-0.5"
              />
            </div>
          ))}
          <div className="col-span-2">
            <span className="text-[8px] font-bold text-muted-foreground uppercase">{L.vehicle_vin}</span>
            <input
              value={vehicle.vin}
              onChange={(e) => setVehicle({ ...vehicle, vin: e.target.value })}
              className="w-full border-b border-border-custom bg-transparent text-xs text-foreground outline-none py-0.5 font-mono"
            />
          </div>
          <div>
            <span className="text-[8px] font-bold text-muted-foreground uppercase">{L.mileage}</span>
            <input
              value={vehicle.mileage}
              onChange={(e) => setVehicle({ ...vehicle, mileage: e.target.value })}
              className="w-full border-b border-border-custom bg-transparent text-xs text-foreground outline-none py-0.5"
            />
          </div>
          <div>
            <span className="text-[8px] font-bold text-muted-foreground uppercase">{L.price}</span>
            <input
              value={vehicle.price}
              onChange={(e) => setVehicle({ ...vehicle, price: e.target.value })}
              className="w-full border-b border-border-custom bg-transparent text-xs text-foreground outline-none py-0.5"
            />
          </div>
        </div>

        {/* Warranties heading */}
        <div className="px-4 py-2 border-b border-foreground bg-muted/30">
          <p className="text-xs font-extrabold text-foreground">{L.warranties_heading}</p>
        </div>

        {/* Guide type content */}
        <div className="px-4 py-3 space-y-3">
          {guideType === "as-is" && (
            <div className="border-2 border-foreground rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 border-2 border-foreground flex items-center justify-center text-xs font-bold">✓</div>
                <h3 className="text-sm font-extrabold text-foreground">{L.as_is_title}</h3>
              </div>
              <p className="text-[10px] text-foreground leading-relaxed">{L.as_is_body}</p>
            </div>
          )}

          {guideType === "implied" && (
            <div className="border-2 border-foreground rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 border-2 border-foreground flex items-center justify-center text-xs font-bold">✓</div>
                <h3 className="text-sm font-extrabold text-foreground">{L.implied_title}</h3>
              </div>
              <p className="text-[10px] text-foreground leading-relaxed">{L.implied_body}</p>
            </div>
          )}

          {guideType === "warranty" && (
            <div className="border-2 border-foreground rounded p-3 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 border-2 border-foreground flex items-center justify-center text-xs font-bold">✓</div>
                <h3 className="text-sm font-extrabold text-foreground">{L.warranty_title}</h3>
              </div>
              <p className="text-[10px] text-foreground">{L.warranty_body}</p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-[9px] font-bold text-muted-foreground">{L.warranty_duration}</span>
                  <input
                    value={warrantyDuration}
                    onChange={(e) => setWarrantyDuration(e.target.value)}
                    className="w-full border-b border-border-custom bg-transparent text-xs text-foreground outline-none py-0.5"
                  />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-muted-foreground">{L.warranty_percentage}</span>
                  <input
                    value={warrantyPct}
                    onChange={(e) => setWarrantyPct(e.target.value)}
                    className="w-full border-b border-border-custom bg-transparent text-xs text-foreground outline-none py-0.5"
                  />
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[9px] font-bold text-muted-foreground mb-1">{L.covered_systems}</p>
                <div className="space-y-1">
                  {WARRANTY_SYSTEMS.map((sys) => (
                    <label key={sys} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={coveredSystems.includes(sys)}
                        onChange={(e) => {
                          setCoveredSystems(e.target.checked
                            ? [...coveredSystems, sys]
                            : coveredSystems.filter(s => s !== sys)
                          );
                        }}
                        className="mt-0.5"
                      />
                      <span className="text-[9px] text-foreground leading-tight">{L[sys]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Non-selected options shown unchecked */}
          {guideType !== "as-is" && (
            <div className="border border-border-custom rounded p-3 opacity-50">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-border-custom" />
                <h3 className="text-sm font-bold text-muted-foreground">{L.as_is_title}</h3>
              </div>
            </div>
          )}
          {guideType !== "implied" && (
            <div className="border border-border-custom rounded p-3 opacity-50">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-border-custom" />
                <h3 className="text-sm font-bold text-muted-foreground">{L.implied_title}</h3>
              </div>
            </div>
          )}
          {guideType !== "warranty" && (
            <div className="border border-border-custom rounded p-3 opacity-50">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-border-custom" />
                <h3 className="text-sm font-bold text-muted-foreground">{L.warranty_title}</h3>
              </div>
            </div>
          )}
        </div>

        {/* Service contract */}
        <div className="px-4 py-3 border-t-2 border-foreground">
          <h3 className="text-xs font-extrabold text-foreground mb-1">{L.service_contact}</h3>
          <p className="text-[9px] text-foreground leading-relaxed">{L.service_body}</p>
        </div>

        {/* Pre-purchase */}
        <div className="px-4 py-3 border-t-2 border-foreground bg-muted/30">
          <p className="text-[9px] font-bold text-foreground">{L.pre_purchase}</p>
        </div>

        {/* Dealer info footer */}
        <div className="px-4 py-3 border-t-2 border-foreground">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[8px] font-bold text-muted-foreground uppercase">{L.dealer_name}</span>
              <p className="text-xs font-semibold text-foreground">{settings.dealer_name}</p>
            </div>
            <div>
              <span className="text-[8px] font-bold text-muted-foreground uppercase">{L.dealer_address}</span>
              <p className="text-xs text-foreground">{settings.dealer_tagline}</p>
            </div>
          </div>
        </div>

        {/* BACK OF BUYERS GUIDE — FTC Required (16 CFR § 455) */}
        <div className="border-t-4 border-foreground mt-1">
          <div className="px-4 py-3 bg-muted/20">
            <p className="text-[10px] font-extrabold text-foreground mb-2">IMPORTANT: Refer to this information when you visit the dealer!</p>

            <p className="text-[8px] text-foreground leading-relaxed mb-2">
              <strong>Contract Cancellation:</strong> Federal law does not provide a "cooling off" period for used car purchases. In some states, once you sign a contract, you may not be able to cancel it. Check with your state's Attorney General's office or consumer protection agency.
            </p>

            <p className="text-[8px] text-foreground leading-relaxed mb-2">
              <strong>Vehicle History Reports:</strong> Before you buy a used vehicle, ask the dealer if the vehicle has a history report. This report may contain important information about the vehicle's title, odometer, and damage history.
            </p>

            <p className="text-[8px] text-foreground leading-relaxed mb-2">
              <strong>Vehicle Return Policies:</strong> Some dealers may offer a return policy, money-back guarantee, or exchange privilege. Be sure to get any return policy in writing and understand its terms and conditions.
            </p>

            <p className="text-[8px] text-foreground leading-relaxed mb-2">
              <strong>Below is a list of some of the major defects that may occur in used motor vehicles:</strong>
            </p>

            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[7px] text-foreground mb-2">
              <div><strong>Frame & Body:</strong> Frame cracks, damage, or repairs; water damage or flood damage</div>
              <div><strong>Engine:</strong> Oil leaks, excessive oil consumption, unusual noises, poor compression</div>
              <div><strong>Transmission:</strong> Slipping, rough shifting, unusual noises, fluid leaks</div>
              <div><strong>Differential:</strong> Excessive noise, fluid leaks</div>
              <div><strong>Cooling System:</strong> Leaks, overheating, water pump failure</div>
              <div><strong>Electrical:</strong> Alternator, starter, wiring problems, battery failure</div>
              <div><strong>Fuel System:</strong> Leaks, fuel pump failure, emission control issues</div>
              <div><strong>Brakes:</strong> Worn pads/shoes, fluid leaks, brake failure, ABS malfunction</div>
              <div><strong>Steering:</strong> Excessive play, hard steering, fluid leaks, alignment</div>
              <div><strong>Suspension:</strong> Worn shocks/struts, broken springs, ball joint failure</div>
              <div><strong>Tires:</strong> Uneven wear, damage, improper size</div>
              <div><strong>Exhaust:</strong> Leaks, catalytic converter failure, excessive emissions</div>
              <div><strong>Air Conditioning:</strong> Inoperative, refrigerant leaks, compressor failure</div>
              <div><strong>Air Bags:</strong> Inoperative, previously deployed, warning light on</div>
            </div>

            <p className="text-[7px] text-muted-foreground leading-relaxed">
              <strong>COMPLAINT PROCEDURE:</strong> If you have a complaint about the vehicle or the conduct of the dealer, contact: your state's Attorney General's office, your state's motor vehicle regulatory agency, the Better Business Bureau (BBB), or the Federal Trade Commission (FTC) at ftc.gov or 1-877-FTC-HELP.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuyersGuide;
