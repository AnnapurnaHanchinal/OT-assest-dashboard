import axios from "axios";

export async function fetchDashboardData() {
  const response = await axios.get("http://localhost:5000/api/dashboard");
  return response.data;
}