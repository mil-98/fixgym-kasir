// ================================================================
// api.js — Pengganti google.script.run untuk GitHub Pages
// Perbaikan: Better error handling, CORS support, timeout
// ================================================================

// GANTI INI dengan Web App URL kamu dari GAS
// Cara deploy: GAS > Deploy > New Deployment > Type: Web App
// Execute as: (akun kamu) | Execute as: Anyone
// Copy deployment URL di sini
const GAS_URL = "https://script.google.com/macros/s/AKfycbxGd5iUQpADOOIivftXoxaO6XB7Lu7jQ3uMbSHHiGotxeUpLeC_ohlnNlalkvgF3usz/exec";

/**
 * Helper function untuk call GAS Web App
 * Menggunakan GET + URLSearchParams untuk avoid CORS preflight issues
 * Timeout: 15 detik (adjust jika perlu)
 */
async function callGAS(action, params = {}) {
  // Validasi GAS_URL
  if (!GAS_URL || GAS_URL.includes("AKfycb...") || GAS_URL.trim() === "") {
    throw new Error(
      "⚠️ GAS_URL belum dikonfigurasi!\n\n" +
      "1. Buka Google Apps Script project kamu\n" +
      "2. Klik 'Deploy' → 'New Deployment'\n" +
      "3. Type: 'Web app'\n" +
      "4. Execute as: (pilih akun kamu)\n" +
      "5. Who has access: 'Anyone'\n" +
      "6. Copy URL deployment\n" +
      "7. Paste di api.js baris 9 (GAS_URL = ...)\n" +
      "8. Refresh browser\n\n" +
      "Deploy documentation: https://developers.google.com/apps-script/concepts/deployments"
    );
  }

  try {
    // Build query string
    const qs = new URLSearchParams({ action });
    for (const [key, val] of Object.entries(params)) {
      qs.set(key, typeof val === "object" ? JSON.stringify(val) : String(val));
    }

    const url = GAS_URL + "?" + qs.toString();
    
    // Fetch dengan timeout 15 detik
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error(
        "Invalid response from GAS. Expected JSON.\n\n" +
        "Kemungkinan:\n" +
        "1. GAS_URL salah atau belum deploy\n" +
        "2. Backend GAS error (check di GAS Logs)\n" +
        "3. Timeout (GAS mungkin lambat)\n\n" +
        "Silakan check di: apps.google.com/script"
      );
    }

    const data = await response.json();
    
    // Check error dari GAS
    if (data && data.error) {
      throw new Error(data.error);
    }

    return data;
  } catch (err) {
    // Re-throw dengan konteks yang lebih jelas
    if (err.name === "AbortError") {
      throw new Error("Request timeout (15s). GAS mungkin lambat atau tidak merespons.");
    }
    throw err;
  }
}

// ================================================================
// Wrapper fungsi API — harus match dengan GAS backend
// ================================================================

const gasAPI = {
  // Auth
  loginUser: (email, password) =>
    callGAS("login", { email, password }),

  // Products
  getProducts: () =>
    callGAS("getProducts"),
  addProduct: (name, price, category, stock, callerEmail) =>
    callGAS("addProduct", { name, price, category, stock, callerEmail }),
  updateProduct: (productId, name, price, category, stock, callerEmail) =>
    callGAS("updateProduct", { productId, name, price, category, stock, callerEmail }),
  deleteProduct: (productId, callerEmail) =>
    callGAS("deleteProduct", { productId, callerEmail }),
  addStock: (productId, addAmount, callerEmail) =>
    callGAS("addStock", { productId, addAmount, callerEmail }),

  // Staff
  getStaffs: () =>
    callGAS("getStaffs"),
  addStaff: (email, password, name, callerEmail) =>
    callGAS("addStaff", { email, password, name, callerEmail }),
  updateStaff: (targetEmail, newName, newPassword, callerEmail) =>
    callGAS("updateStaff", { targetEmail, newName, newPassword, callerEmail }),
  deleteStaff: (targetEmail, callerEmail) =>
    callGAS("deleteStaff", { targetEmail, callerEmail }),
  changePassword: (email, newPassword) =>
    callGAS("changePassword", { email, newPassword }),

  // Transactions
  processTransaction: (cart, staffName, shift, paymentMethod) =>
    callGAS("processTransaction", { cart, staffName, shift, paymentMethod }),
  voidTransaction: (transactionId, callerEmail) =>
    callGAS("voidTransaction", { transactionId, callerEmail }),

  // Reports
  getReports: () =>
    callGAS("getReports"),
  getTransactionHistory: () =>
    callGAS("getTransactionHistory"),
  generatePDF: (data, start, end, staff, shift, payment, total) =>
    callGAS("generatePDF", { data, start, end, staff, shift, payment, total }),
  getRekapPeriode: () =>
    callGAS("getRekapPeriode"),

  // Logs
  getActivityLog: () =>
    callGAS("getActivityLog"),
};
