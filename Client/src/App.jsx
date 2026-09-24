import React, { useEffect, useMemo, useState } from "react";
import { fetchDashboardData } from "./api";
import { Shield, Database, BarChart3, Server } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from "recharts";

const COLORS = ["#7c3aed", "#06b6d4", "#f59e0b", "#ef4444"];

export default function App() {
  const [data, setData] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    riskLevel: "",
    status: ""
  });

  useEffect(() => {
    fetchDashboardData().then(setData).catch(console.error);
  }, []);

  const filteredAssets = useMemo(() => {
    if (!data?.assets) return [];
    return data.assets.filter((a) => {
      const s = filters.search.toLowerCase();
      const searchOk =
        !s ||
        a.hostname.toLowerCase().includes(s) ||
        a.ipAddress.toLowerCase().includes(s) ||
        a.assetType.toLowerCase().includes(s) ||
        a.location.toLowerCase().includes(s);

      const riskOk = !filters.riskLevel || a.riskLevel === filters.riskLevel;
      const statusOk = !filters.status || a.status === filters.status;

      return searchOk && riskOk && statusOk;
    });
  }, [data, filters]);

  if (!data) return <div className="loading-screen">Loading dashboard...</div>;

  const missingBackup = filteredAssets.filter((a) => a.backupStatus !== "Success").length;
  const securityIssues = filteredAssets.filter((a) => a.avStatus === "Threat Found" || a.avStatus === "Warning").length;
  const offline = filteredAssets.filter((a) => a.networkStatus === "Offline").length;
  const partial = filteredAssets.filter((a) => a.status === "Partial Match").length;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">OT AI</div>
        <div className="nav-item active"><BarChart3 size={18} /> Dashboard</div>
        <div className="nav-item"><Server size={18} /> Assets</div>
        <div className="nav-item"><Database size={18} /> Reconciliation</div>
        <div className="nav-item"><Shield size={18} /> Risk</div>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <div>
            <h1>OT Asset / Inventory Intelligence</h1>
            <p>Advanced GitHub-powered reconciliation dashboard</p>
          </div>
          <div className="refresh-chip">
            Updated: {new Date(data.generatedAt).toLocaleString()}
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card"><div className="kpi-title">Total Assets</div><div className="kpi-value">{data.kpis.totalAssets}</div></div>
          <div className="kpi-card"><div className="kpi-title">Matched</div><div className="kpi-value">{data.kpis.matchedAssets}</div></div>
          <div className="kpi-card"><div className="kpi-title">Missing in CMDB</div><div className="kpi-value">{data.kpis.missingInCmdb}</div></div>
          <div className="kpi-card"><div className="kpi-title">High Risk</div><div className="kpi-value">{data.kpis.highRiskAssets}</div></div>
          <div className="kpi-card"><div className="kpi-title">Protected</div><div className="kpi-value">{data.kpis.protectedAssets}</div></div>
        </div>

        <div className="insight-grid">
          <div className="insight-card"><span>Backup Issues</span><strong>{missingBackup}</strong></div>
          <div className="insight-card"><span>Security Issues</span><strong>{securityIssues}</strong></div>
          <div className="insight-card"><span>Offline Devices</span><strong>{offline}</strong></div>
          <div className="insight-card"><span>Partial Match</span><strong>{partial}</strong></div>
        </div>

        <div className="filters-row">
          <input
            placeholder="Search asset, IP, type, location"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <select
            value={filters.riskLevel}
            onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value })}
          >
            <option value="">All Risk</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="Matched">Matched</option>
            <option value="Partial Match">Partial Match</option>
            <option value="Missing in CMDB">Missing in CMDB</option>
            <option value="Low Confidence">Low Confidence</option>
          </select>
        </div>

        <div className="charts-grid">
          <div className="chart-card">
            <h3>Source Coverage</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.sourceCoverage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263247" />
                <XAxis dataKey="name" stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Tooltip />
                <Bar dataKey="value" fill="#7c3aed" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Risk Distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.riskDistribution} dataKey="value" outerRadius={90} label>
                  {data.riskDistribution.map((e, i) => (
                    <Cell key={e.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Status Distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.statusDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263247" />
                <XAxis dataKey="name" stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Tooltip />
                <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="table-card">
          <div className="table-header">
            <h3>Asset Inventory</h3>
            <span>{filteredAssets.length} records</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>IP</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>CMDB</th>
                  <th>SolarWinds</th>
                  <th>Trellix</th>
                  <th>Veeam</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => (
                  <tr key={asset.assetKey} onClick={() => setSelectedAsset(asset)}>
                    <td>{asset.hostname}</td>
                    <td>{asset.ipAddress}</td>
                    <td>{asset.assetType}</td>
                    <td>{asset.location}</td>
                    <td>{asset.status}</td>
                    <td>{asset.riskLevel} ({asset.riskScore})</td>
                    <td>{asset.cmdbStatus}</td>
                    <td>{asset.networkStatus}</td>
                    <td>{asset.avStatus}</td>
                    <td>{asset.backupStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedAsset && (
          <div className="modal-overlay" onClick={() => setSelectedAsset(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h2>{selectedAsset.hostname}</h2>
                <button onClick={() => setSelectedAsset(null)}>Close</button>
              </div>
              <div className="modal-grid">
                <div><strong>Asset:</strong> {selectedAsset.hostname}</div>
                <div><strong>IP:</strong> {selectedAsset.ipAddress}</div>
                <div><strong>Type:</strong> {selectedAsset.assetType}</div>
                <div><strong>Owner:</strong> {selectedAsset.owner}</div>
                <div><strong>Location:</strong> {selectedAsset.location}</div>
                <div><strong>Criticality:</strong> {selectedAsset.criticality}</div>
                <div><strong>CMDB Status:</strong> {selectedAsset.cmdbStatus}</div>
                <div><strong>Network Status:</strong> {selectedAsset.networkStatus}</div>
                <div><strong>OS:</strong> {selectedAsset.os}</div>
                <div><strong>Trellix Status:</strong> {selectedAsset.avStatus}</div>
                <div><strong>Threat Count:</strong> {selectedAsset.threatCount}</div>
                <div><strong>Backup Status:</strong> {selectedAsset.backupStatus}</div>
                <div><strong>Backup Size GB:</strong> {selectedAsset.backupSizeGB ?? "N/A"}</div>
                <div><strong>Restore Point:</strong> {selectedAsset.restorePoint ?? "N/A"}</div>
                <div><strong>CI ID:</strong> {selectedAsset.ciId || "N/A"}</div>
                <div><strong>Hypervisor:</strong> {selectedAsset.virtualization || "N/A"}</div>
                <div><strong>Cluster:</strong> {selectedAsset.hostCluster || "N/A"}</div>
                <div><strong>Power State:</strong> {selectedAsset.powerState || "N/A"}</div>
              </div>
              <div className="risk-box">
                <strong>Risk Reasons:</strong>
                <ul>
                  {selectedAsset.riskReasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}