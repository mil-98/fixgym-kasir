// ================================================================
// api.js — Pengganti google.script.run untuk GitHub Pages
// Ganti GAS_URL dengan URL Web App GAS kamu setelah deploy
// ================================================================

const GAS_URL = "https://script.google.com/macros/s/AKfycbwpMfP6ijtlUrH-3Zc-t67DrkwB-qA3Goennf_jWkrx1Pk03jheGw66zyL055BeG5KB/exec";
// Contoh: "https://script.google.com/macros/s/AKfycb.../exec"

/**
 * Kirim request ke GAS Web App
 * @param {string} action - nama fungsi/action
 * @param {object} params - parameter tambahan
 * @returns {Promise<any>} - hasil dari GAS
 */
async function callGAS(action, params = {}) {
  const body = JSON.stringify({ action, ...params });
  const response = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" }, // GAS butuh text/plain bukan application/json untuk avoid preflight
    body,
    redirect: "follow",
  });
  if (!response.ok) throw new Error("HTTP error: " + response.status);
  const data = await response.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

// ================================================================
// Wrapper fungsi — sesuai dengan fungsi di GAS Code.gs
// ================================================================

const gasAPI = {
  loginUser:              (email, password)                          => callGAS("login",              { email, password }),
  getProducts:            ()                                         => callGAS("getProducts"),
  addProduct:             (name, price, category, stock, callerEmail) => callGAS("addProduct",        { name, price, category, stock, callerEmail }),
  updateProduct:          (productId, name, price, category, stock, callerEmail) => callGAS("updateProduct", { productId, name, price, category, stock, callerEmail }),
  deleteProduct:          (productId, callerEmail)                   => callGAS("deleteProduct",       { productId, callerEmail }),
  addStock:               (productId, addAmount, callerEmail)        => callGAS("addStock",            { productId, addAmount, callerEmail }),
  getStaffs:              ()                                         => callGAS("getStaffs"),
  addStaff:               (email, password, name, callerEmail)       => callGAS("addStaff",            { email, password, name, callerEmail }),
  updateStaff:            (targetEmail, newName, newPassword, callerEmail) => callGAS("updateStaff",  { targetEmail, newName, newPassword, callerEmail }),
  deleteStaff:            (targetEmail, callerEmail)                 => callGAS("deleteStaff",         { targetEmail, callerEmail }),
  changePassword:         (email, newPassword)                       => callGAS("changePassword",      { email, newPassword }),
  processTransaction:     (cart, staffName, shift, paymentMethod)    => callGAS("processTransaction",  { cart, staffName, shift, paymentMethod }),
  getReports:             ()                                         => callGAS("getReports"),
  getTransactionHistory:  ()                                         => callGAS("getTransactionHistory"),
  voidTransaction:        (transactionId, callerEmail)               => callGAS("voidTransaction",     { transactionId, callerEmail }),
  generatePDF:            (data, start, end, staff, shift, payment, total) => callGAS("generatePDF", { data, start, end, staff, shift, payment, total }),
  getRekapPeriode:        ()                                         => callGAS("getRekapPeriode"),
  getActivityLog:         ()                                         => callGAS("getActivityLog"),
};
