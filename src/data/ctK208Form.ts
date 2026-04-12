// ──────────────────────────────────────────────────────────────
// Connecticut DMV Form K-208
// CT Licensed Dealer Vehicle Inspection Form
//
// Per CGS 14-62(g), CT licensed dealers must complete a safety
// inspection on every used motor vehicle before retail sale.
//
// Penalties:
//   - $500 fine if inspection not performed
//   - $250 fine if customer copy not provided
//
// Copies: Customer receives one, dealer retains one in the deal.
//
// Source: https://portal.ct.gov/-/media/DMV/20/29/K208pdf.pdf
// ──────────────────────────────────────────────────────────────

export interface K208FormData {
  // Vehicle Information
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleBodyStyle: string;
  vehicleVin: string;
  vehicleColor: string;
  vehicleMileage: string;
  vehiclePlate: string;

  // Dealer Information
  dealerName: string;
  dealerPhone: string;
  dealerAddress: string;
  dealerCity: string;
  dealerState: string;
  dealerZip: string;
  dealerLicenseNumber: string;

  // Inspection Items — each is "pass" | "fail" | "na"
  inspectionItems: Record<string, "pass" | "fail" | "na" | "">;

  // Certification
  inspectedBy: string;        // Name of inspector
  inspectionDate: string;
  inspectorSignature: string;
  inspectorSignatureType: "draw" | "type";

  // Buyer Information
  buyerName: string;
  buyerAddress: string;
  buyerSignature: string;
  buyerSignatureType: "draw" | "type";
  buyerDate: string;

  // Notes
  notes: string;
  failureNotes: string;       // What failed and what was done
}

export const K208_INSPECTION_CATEGORIES = [
  {
    category: "Service Brakes",
    items: [
      { id: "brake_pedal", label: "Brake pedal reserve & travel" },
      { id: "brake_lines", label: "Brake lines & hoses (leaks, damage)" },
      { id: "brake_pads_front", label: "Front brake pads/shoes (wear)" },
      { id: "brake_pads_rear", label: "Rear brake pads/shoes (wear)" },
      { id: "brake_rotors", label: "Rotors/drums (condition)" },
      { id: "brake_fluid", label: "Brake fluid level & condition" },
      { id: "abs_system", label: "ABS warning light" },
    ],
  },
  {
    category: "Parking Brake",
    items: [
      { id: "parking_brake", label: "Parking brake operation" },
      { id: "parking_brake_hold", label: "Parking brake holds vehicle on grade" },
    ],
  },
  {
    category: "Steering System",
    items: [
      { id: "steering_play", label: "Steering wheel play/free movement" },
      { id: "steering_linkage", label: "Steering linkage & joints" },
      { id: "power_steering", label: "Power steering operation & fluid" },
      { id: "steering_column", label: "Steering column mounting" },
    ],
  },
  {
    category: "Tires & Wheels",
    items: [
      { id: "tire_tread_lf", label: "LF tire tread depth (min 2/32\")" },
      { id: "tire_tread_rf", label: "RF tire tread depth (min 2/32\")" },
      { id: "tire_tread_lr", label: "LR tire tread depth (min 2/32\")" },
      { id: "tire_tread_rr", label: "RR tire tread depth (min 2/32\")" },
      { id: "tire_condition", label: "Tire condition (cuts, bulges, damage)" },
      { id: "tire_matching", label: "Tires matching on same axle" },
      { id: "spare_tire", label: "Spare tire & jack (if equipped)" },
      { id: "wheel_lugs", label: "Wheel lug nuts/bolts (all present & tight)" },
    ],
  },
  {
    category: "Lights & Signals",
    items: [
      { id: "headlights_low", label: "Headlights — low beam" },
      { id: "headlights_high", label: "Headlights — high beam" },
      { id: "tail_lights", label: "Tail lights" },
      { id: "brake_lights", label: "Brake lights" },
      { id: "turn_signals_front", label: "Turn signals — front" },
      { id: "turn_signals_rear", label: "Turn signals — rear" },
      { id: "hazard_lights", label: "Hazard warning lights" },
      { id: "reverse_lights", label: "Reverse/backup lights" },
      { id: "license_plate_light", label: "License plate light" },
      { id: "side_markers", label: "Side marker lights" },
    ],
  },
  {
    category: "Horn & Mirrors",
    items: [
      { id: "horn", label: "Horn operation" },
      { id: "mirror_interior", label: "Interior rearview mirror" },
      { id: "mirror_driver", label: "Driver side exterior mirror" },
      { id: "mirror_passenger", label: "Passenger side exterior mirror" },
    ],
  },
  {
    category: "Windshield & Wipers",
    items: [
      { id: "windshield", label: "Windshield (cracks, chips, visibility)" },
      { id: "wipers_front", label: "Windshield wipers — operation" },
      { id: "wipers_rear", label: "Rear wiper (if equipped)" },
      { id: "washer_fluid", label: "Windshield washer operation" },
      { id: "defroster", label: "Defroster operation" },
    ],
  },
  {
    category: "Exhaust System",
    items: [
      { id: "exhaust_leaks", label: "Exhaust leaks" },
      { id: "exhaust_condition", label: "Exhaust system condition" },
      { id: "catalytic_converter", label: "Catalytic converter present" },
      { id: "muffler", label: "Muffler condition" },
    ],
  },
  {
    category: "Suspension",
    items: [
      { id: "shocks_struts", label: "Shocks/struts condition" },
      { id: "springs", label: "Springs (sagging, broken)" },
      { id: "ball_joints", label: "Ball joints" },
      { id: "tie_rods", label: "Tie rod ends" },
      { id: "cv_joints", label: "CV joints/boots" },
    ],
  },
  {
    category: "Body & Frame",
    items: [
      { id: "frame_condition", label: "Frame/unibody (rust, damage)" },
      { id: "doors", label: "Doors open/close/latch properly" },
      { id: "hood_latch", label: "Hood latch — primary & safety" },
      { id: "trunk_latch", label: "Trunk/hatch latch" },
      { id: "bumpers", label: "Bumpers (attached, condition)" },
      { id: "floor_pan", label: "Floor pan (rust-through)" },
    ],
  },
  {
    category: "Safety Equipment",
    items: [
      { id: "seat_belts_front", label: "Front seat belts (operation & condition)" },
      { id: "seat_belts_rear", label: "Rear seat belts (operation & condition)" },
      { id: "airbag_light", label: "Airbag warning light (not illuminated)" },
      { id: "seats", label: "Seats (secure, adjustment works)" },
      { id: "speedometer", label: "Speedometer operation" },
      { id: "odometer", label: "Odometer operation" },
    ],
  },
  {
    category: "Fluid Levels & Leaks",
    items: [
      { id: "engine_oil", label: "Engine oil level & condition" },
      { id: "coolant", label: "Coolant level" },
      { id: "transmission_fluid", label: "Transmission fluid" },
      { id: "power_steering_fluid", label: "Power steering fluid" },
      { id: "fluid_leaks", label: "No visible fluid leaks underneath" },
    ],
  },
  {
    category: "Emissions",
    items: [
      { id: "check_engine_light", label: "Check engine / MIL light off" },
      { id: "emissions_sticker", label: "Emissions compliance (if applicable)" },
    ],
  },
];

export const K208_CERTIFICATION_TEXT =
  "I hereby certify that I have personally inspected the above-described motor vehicle and that it meets the safety standards as set forth in CGS 14-62(g) and applicable regulations. I further certify that the inspection was performed in accordance with Connecticut Department of Motor Vehicles requirements, and that any deficiencies found were corrected prior to offering this vehicle for retail sale.";

export const K208_BUYER_ACKNOWLEDGMENT_TEXT =
  "I, the undersigned buyer, acknowledge that I have received a copy of this completed vehicle safety inspection form as required by Connecticut law. I understand that this inspection was performed by the dealer prior to the sale of this vehicle. I acknowledge that a copy of this form has been provided to me and that the dealer retains a copy in the deal file.";

export const K208_PENALTIES = {
  noInspection: "$500 fine — Failure to perform safety inspection before retail sale (CGS 14-62(g))",
  noCopyToCustomer: "$250 fine — Failure to provide customer with a copy of the inspection form",
};

export const emptyK208: K208FormData = {
  vehicleYear: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleBodyStyle: "",
  vehicleVin: "",
  vehicleColor: "",
  vehicleMileage: "",
  vehiclePlate: "",
  dealerName: "",
  dealerPhone: "",
  dealerAddress: "",
  dealerCity: "",
  dealerState: "CT",
  dealerZip: "",
  dealerLicenseNumber: "",
  inspectionItems: {},
  inspectedBy: "",
  inspectionDate: "",
  inspectorSignature: "",
  inspectorSignatureType: "draw",
  buyerName: "",
  buyerAddress: "",
  buyerSignature: "",
  buyerSignatureType: "draw",
  buyerDate: "",
  notes: "",
  failureNotes: "",
};
