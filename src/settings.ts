// The installer's business settings. Env vars give the defaults; changes made
// in the dashboard are stored in the ledger and win over them.
//
// The supplier address is the one thing the agent will pay, so in live mode it
// can only be set by whoever controls the server's environment, never through
// the API.
import { z } from "zod";
import type { Address } from "viem";
import type { Config } from "./config.js";
import type { Ledger } from "./ledger.js";

export type Settings = {
  installerName: string;
  restockBps: number;
  unitName: string;
  unitUsdCost: number;
  supplierName: string;
  supplierAddress: Address | null;
  minConvertCngn: number;
  autoRestock: boolean;
};

const SIM_SUPPLIER = "0x5099000000000000000000000000000000005099" as Address;

export const SettingsPatch = z
  .object({
    installerName: z.string().trim().min(1).max(80),
    restockBps: z.number().int().min(0).max(10_000),
    unitName: z.string().trim().min(1).max(80),
    unitUsdCost: z.number().positive().max(1_000_000),
    supplierName: z.string().trim().min(1).max(80),
    supplierAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/)
      .transform((s) => s as Address),
    minConvertCngn: z.number().min(1500).max(100_000_000),
    autoRestock: z.boolean(),
  })
  .partial()
  .strict();

export function defaultSettings(cfg: Config): Settings {
  const sim = cfg.MODE === "sim";
  return {
    installerName: cfg.INSTALLER_NAME === "Installer" && sim ? "Sunrise Solar (sample)" : cfg.INSTALLER_NAME,
    restockBps: cfg.RESTOCK_BPS,
    unitName: cfg.UNIT_NAME,
    unitUsdCost: cfg.UNIT_USD_COST,
    supplierName: cfg.SUPPLIER_NAME === "Supplier" && sim ? "Sample importer" : cfg.SUPPLIER_NAME,
    supplierAddress: cfg.SUPPLIER_ADDRESS ?? (sim ? SIM_SUPPLIER : null),
    minConvertCngn: cfg.MIN_CONVERT_CNGN,
    autoRestock: cfg.AUTO_RESTOCK,
  };
}

export function readSettings(cfg: Config, ledger: Ledger): Settings {
  const stored = ledger.get("settings");
  const overrides = stored ? (JSON.parse(stored) as Partial<Settings>) : {};
  const s = { ...defaultSettings(cfg), ...overrides };
  // The env always decides the supplier in live mode.
  if (cfg.MODE === "live") s.supplierAddress = cfg.SUPPLIER_ADDRESS ?? null;
  return s;
}

export function writeSettings(cfg: Config, ledger: Ledger, patch: unknown): Settings {
  const p = SettingsPatch.parse(patch);
  if (cfg.MODE === "live" && p.supplierAddress !== undefined)
    throw new Error("In live mode the supplier address is set by SUPPLIER_ADDRESS in the server's environment.");
  const stored = ledger.get("settings");
  const next = { ...(stored ? JSON.parse(stored) : {}), ...p };
  ledger.set("settings", JSON.stringify(next));
  return readSettings(cfg, ledger);
}
