import { useEffect, useRef } from "react";

interface VinBarcodeProps {
  vin: string;
}

// Code 39 barcode implementation for VIN display
const CODE39_MAP: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn",
  "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw",
  "8": "wnnwnnwnn", "9": "nnwwnnwnn", "A": "wnnnnwnnw", "B": "nnwnnwnnw",
  "C": "wnwnnwnnn", "D": "nnnnwwnnw", "E": "wnnnwwnnn", "F": "nnwnwwnnn",
  "G": "nnnnnwwnw", "H": "wnnnnwwnn", "I": "nnwnnwwnn", "J": "nnnnwwwnn",
  "K": "wnnnnnnww", "L": "nnwnnnnww", "M": "wnwnnnnwn", "N": "nnnnwnnww",
  "O": "wnnnwnnwn", "P": "nnwnwnnwn", "Q": "nnnnnnwww", "R": "wnnnnnwwn",
  "S": "nnwnnnwwn", "T": "nnnnwnwwn", "U": "wwnnnnnnw", "V": "nwwnnnnnw",
  "W": "wwwnnnnnn", "X": "nwnnwnnnw", "Y": "wwnnwnnnn", "Z": "nwwnwnnnn",
  "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "*": "nwnnwnwnn",
};

const VinBarcode = ({ vin }: VinBarcodeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!vin || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const barWidth = 1;
    const wideWidth = 2.5;
    const height = 30;
    const gap = 1;

    // Encode with start/stop characters
    const data = `*${vin.toUpperCase()}*`;
    let totalWidth = 0;

    for (const char of data) {
      const pattern = CODE39_MAP[char];
      if (!pattern) continue;
      for (let i = 0; i < pattern.length; i++) {
        totalWidth += pattern[i] === "w" ? wideWidth : barWidth;
      }
      totalWidth += gap;
    }

    canvas.width = Math.ceil(totalWidth);
    canvas.height = height;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let x = 0;
    for (const char of data) {
      const pattern = CODE39_MAP[char];
      if (!pattern) continue;
      for (let i = 0; i < pattern.length; i++) {
        const w = pattern[i] === "w" ? wideWidth : barWidth;
        if (i % 2 === 0) {
          ctx.fillStyle = "#000000";
          ctx.fillRect(x, 0, w, height);
        }
        x += w;
      }
      x += gap;
    }
  }, [vin]);

  if (!vin) return null;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <canvas ref={canvasRef} className="h-[30px]" style={{ imageRendering: "pixelated" }} />
      <span className="text-[7px] font-mono text-muted-foreground tracking-wider">{vin}</span>
    </div>
  );
};

export default VinBarcode;
