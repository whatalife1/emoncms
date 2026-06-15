// ─── Solar Geometry / Lahore Configuration ──────────────────────────────────
const SOL_LAT = 31.5497;
const SOL_LON = 74.3436;
const SOL_TZ  = 5;

const SOLAR_DEFAULTS = {
  panelWatts: 580, panelCount: 6, tiltDeg: 10, azimuthDeg: 200,
  sysEff: 0.82, batteryKwh: 0, pkrPerUnit: 60, cloudPct: 0
};
let solarCfg = { ...SOLAR_DEFAULTS };
