import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { parse } from "csv-parse/sync";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || "main";

const githubRaw = (file) =>
  `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/data/${file}`;

function normalizeKey(value = "") {
  return String(value).trim().toLowerCase();
}

function daysAgo(dateString) {
  if (!dateString) return null;
  const now = new Date();
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  return Math.floor((now - date) / (1000 * 60 * 60 * 24));
}

function parseCsv(csvText) {
  return parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
}

async function fetchCsvFile(fileName) {
  const response = await axios.get(githubRaw(fileName));
  return parseCsv(response.data);
}

async function fetchGitHubData() {
  const results = {};
  results.cmdb = await fetchCsvFile("cmdb.csv");
  results.solarwinds = await fetchCsvFile("solarwinds.csv");
  results.trellix = await fetchCsvFile("trellix.csv");
  results.veeam = await fetchCsvFile("veeam.csv");

  try {
    results.hypervisor = await fetchCsvFile("hypervisor.csv");
  } catch {
    results.hypervisor = [];
  }

  return results;
}

function getAssetKeyFromAny(record) {
  return normalizeKey(
    record.AssetName ||
    record.Hostname ||
    record.ServerName ||
    record.hostname ||
    record.IP ||
    record.ipAddress ||
    ""
  );
}

function ensureAsset(assetMap, key, displayName = "Unknown") {
  if (!key) return null;

  if (!assetMap[key]) {
    assetMap[key] = {
      assetKey: key,
      hostname: displayName,
      ipAddress: "N/A",
      os: "Unknown",
      assetType: "Unknown",
      owner: "N/A",
      location: "N/A",
      criticality: "Unknown",
      cmdbStatus: "Missing",
      networkStatus: "Unknown",
      vendor: "N/A",
      model: "N/A",
      backupStatus: "Unknown",
      backupSizeGB: null,
      restorePoint: null,
      avStatus: "Unknown",
      threatCount: 0,
      ciId: null,
      virtualization: null,
      hostCluster: null,
      powerState: "Unknown",
      provisionedGB: null,
      usedGB: null,
      hypervisorHostNode: "N/A",
      hypervisorLastSync: null,
      sources: {
        cmdb: false,
        solarwinds: false,
        trellix: false,
        veeam: false,
        hypervisor: false
      },
      timestamps: {
        solarwindsLastSeen: null,
        trellixLastScan: null,
        veeamLastBackup: null
      }
    };
  }

  return assetMap[key];
}

function mapCmdb(assetMap, rows) {
  rows.forEach((row) => {
    const key = getAssetKeyFromAny(row);
    const asset = ensureAsset(assetMap, key, row.AssetName || "Unknown");
    if (!asset) return;

    asset.hostname = row.AssetName || asset.hostname;
    asset.assetType = row.AssetType || asset.assetType;
    asset.owner = row.Owner || asset.owner;
    asset.location = row.Location || asset.location;
    asset.criticality = row.Criticality || asset.criticality;
    asset.cmdbStatus = row.Status || asset.cmdbStatus;
    asset.ciId = row.AssetID || asset.ciId;
    asset.sources.cmdb = true;
  });
}

function mapSolarwinds(assetMap, rows) {
  rows.forEach((row) => {
    const key = getAssetKeyFromAny(row);
    const asset = ensureAsset(assetMap, key, row.Hostname || "Unknown");
    if (!asset) return;

    asset.hostname = row.Hostname || asset.hostname;
    asset.ipAddress = row.IP || asset.ipAddress;
    asset.location = row.Location || asset.location;
    asset.networkStatus = row.Status || asset.networkStatus;
    asset.vendor = row.Vendor || asset.vendor;
    asset.model = row.Model || asset.model;
    asset.timestamps.solarwindsLastSeen = row.LastSeen || null;
    asset.sources.solarwinds = true;
  });
}

function mapTrellix(assetMap, rows) {
  rows.forEach((row) => {
    const key = getAssetKeyFromAny(row);
    const asset = ensureAsset(assetMap, key, row.Hostname || "Unknown");
    if (!asset) return;

    asset.hostname = row.Hostname || asset.hostname;
    asset.os = row.OS || asset.os;
    asset.threatCount = Number(row.ThreatCount || 0);
    asset.avStatus = row.Status || asset.avStatus;
    asset.timestamps.trellixLastScan = row.LastScan || null;
    asset.sources.trellix = true;
  });
}

function mapVeeam(assetMap, rows) {
  rows.forEach((row) => {
    const key = getAssetKeyFromAny(row);
    const asset = ensureAsset(assetMap, key, row.ServerName || "Unknown");
    if (!asset) return;

    asset.hostname = row.ServerName || asset.hostname;
    asset.backupStatus = row.BackupStatus || asset.backupStatus;
    asset.backupSizeGB = row.BackupSizeGB ? Number(row.BackupSizeGB) : null;
    asset.restorePoint = row.RestorePoint ? Number(row.RestorePoint) : null;
    asset.timestamps.veeamLastBackup = row.LastBackup || null;
    asset.sources.veeam = true;
  });
}

function mapHypervisor(assetMap, rows) {
  rows.forEach((row) => {
    const key = normalizeKey(row.Hostname || "");
    const asset = ensureAsset(assetMap, key, row.Hostname || "Unknown");
    if (!asset) return;

    asset.hostname = row.Hostname || asset.hostname;
    asset.virtualization = row.HypervisorType || asset.virtualization;
    asset.hostCluster = row.Cluster || asset.hostCluster;
    asset.powerState = row.PowerState || asset.powerState;
    asset.provisionedGB = row.ProvisionedGB ? Number(row.ProvisionedGB) : null;
    asset.usedGB = row.UsedGB ? Number(row.UsedGB) : null;
    asset.hypervisorHostNode = row.HostNode || asset.hypervisorHostNode;
    asset.hypervisorLastSync = row.LastSync || null;
    asset.sources.hypervisor = true;
  });
}

function computeRisk(asset) {
  let score = 0;
  const reasons = [];

  if (!asset.sources.cmdb) {
    score += 30;
    reasons.push("Missing in CMDB");
  }

  if (!asset.sources.veeam) {
    score += 20;
    reasons.push("Missing in Backup Source");
  } else if (asset.backupStatus === "Failed") {
    score += 25;
    reasons.push("Backup Failed");
  } else if (asset.backupStatus === "Warning") {
    score += 10;
    reasons.push("Backup Warning");
  }

  if (!asset.sources.trellix) {
    score += 20;
    reasons.push("Missing in Trellix");
  } else if (asset.avStatus === "Threat Found") {
    score += 30;
    reasons.push("Threat Found");
  } else if (asset.avStatus === "Warning") {
    score += 15;
    reasons.push("Security Warning");
  }

  if (asset.networkStatus === "Offline") {
    score += 15;
    reasons.push("Offline in SolarWinds");
  } else if (asset.networkStatus === "Warning") {
    score += 8;
    reasons.push("SolarWinds Warning");
  }

  if (asset.cmdbStatus === "Inactive") {
    score += 10;
    reasons.push("CMDB Inactive");
  } else if (asset.cmdbStatus === "Maintenance") {
    score += 5;
    reasons.push("CMDB Maintenance");
  }

  if (asset.criticality === "Critical") {
    score += 10;
    reasons.push("Critical Asset");
  } else if (asset.criticality === "High") {
    score += 5;
    reasons.push("High Criticality");
  }

  const swAge = daysAgo(asset.timestamps.solarwindsLastSeen);
  const trAge = daysAgo(asset.timestamps.trellixLastScan);
  const vbAge = daysAgo(asset.timestamps.veeamLastBackup);

  if ((swAge && swAge > 7) || (trAge && trAge > 7) || (vbAge && vbAge > 7)) {
    score += 10;
    reasons.push("Stale Data");
  }

  let riskLevel = "Low";
  if (score >= 60) riskLevel = "High";
  else if (score >= 30) riskLevel = "Medium";

  return { score, riskLevel, reasons };
}

function computeStatus(asset) {
  const count = Object.values(asset.sources).filter(Boolean).length;
  if (!asset.sources.cmdb) return "Missing in CMDB";
  if (count >= 4) return "Matched";
  if (count >= 2) return "Partial Match";
  return "Low Confidence";
}

function buildDashboardData(files) {
  const assetMap = {};

  mapCmdb(assetMap, files.cmdb || []);
  mapSolarwinds(assetMap, files.solarwinds || []);
  mapTrellix(assetMap, files.trellix || []);
  mapVeeam(assetMap, files.veeam || []);
  mapHypervisor(assetMap, files.hypervisor || []);

  const assets = Object.values(assetMap).map((asset) => {
    const risk = computeRisk(asset);
    return {
      ...asset,
      status: computeStatus(asset),
      riskScore: risk.score,
      riskLevel: risk.riskLevel,
      riskReasons: risk.reasons
    };
  });

  const kpis = {
    totalAssets: assets.length,
    matchedAssets: assets.filter((a) => a.status === "Matched").length,
    missingInCmdb: assets.filter((a) => !a.sources.cmdb).length,
    highRiskAssets: assets.filter((a) => a.riskLevel === "High").length,
    protectedAssets: assets.filter((a) => a.avStatus === "Protected").length
  };

  const sourceCoverage = [
    { name: "CMDB", value: assets.filter((a) => a.sources.cmdb).length },
    { name: "SolarWinds", value: assets.filter((a) => a.sources.solarwinds).length },
    { name: "Trellix", value: assets.filter((a) => a.sources.trellix).length },
    { name: "Veeam", value: assets.filter((a) => a.sources.veeam).length },
    { name: "Hypervisor", value: assets.filter((a) => a.sources.hypervisor).length }
  ];

  const riskDistribution = [
    { name: "Low", value: assets.filter((a) => a.riskLevel === "Low").length },
    { name: "Medium", value: assets.filter((a) => a.riskLevel === "Medium").length },
    { name: "High", value: assets.filter((a) => a.riskLevel === "High").length }
  ];

  const statusDistribution = [
    { name: "Matched", value: assets.filter((a) => a.status === "Matched").length },
    { name: "Partial Match", value: assets.filter((a) => a.status === "Partial Match").length },
    { name: "Missing in CMDB", value: assets.filter((a) => a.status === "Missing in CMDB").length },
    { name: "Low Confidence", value: assets.filter((a) => a.status === "Low Confidence").length }
  ];

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    kpis,
    sourceCoverage,
    riskDistribution,
    statusDistribution,
    assets
  };
}

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server running" });
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const files = await fetchGitHubData();
    const dashboard = buildDashboardData(files);
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data from GitHub",
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});