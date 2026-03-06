// ================================================================
// api.js — Pengganti google.script.run untuk GitHub Pages
// Ganti GAS_URL dengan URL Web App GAS kamu setelah deploy
// ================================================================

const GAS_URL = "https://script.google.com/macros/s/AKfycbzP5mpyA6i_IHtHEpDlXkmez16kndMuOpxLf1rNqPneKxwjYDO3IVAZjAQbw5axh3A7/exec";
// Contoh: "https://script.google.com/macros/s/AKfycb.../exec"

/**
 * Kirim request ke GAS Web App via GET dengan query params.
 *
 * Kenapa GET, bukan POST?
 * GAS Web App melakukan HTTP redirect saat dipanggil dari luar.
 * fetch() POST + redirect = browser blokir (CORS preflight gagal).
 * GET + URLSearchParams = simple request, browser ikuti redirect tanpa preflight,
 * dan GAS bisa balas dengan header CORS yang benar.
 *
 * Untuk payload besar (cart, dll) kita stringify ke JSON lalu encode sebagai query param.
 */
async function callGAS(action, params = {}) {
  // Encode semua params sebagai query string
  const qs = new URLSearchParams({ action });
  for (const [key, val] of Object.entries(params)) {
    // Object/array di-stringify dulu
    qs.set(key, typeof val === "object" ? JSON.stringify(val) : val);
  }

  const url = GAS_URL + "?" + qs.toString();
  const response = await fetch(url, {
    method: "GET",
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
