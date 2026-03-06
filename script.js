// ================================================================
// script.js — Fix Gym Kasir (GitHub Pages version)
// Semua google.script.run sudah diganti dengan gasAPI (fetch)
// ================================================================

var currentUser       = null;
var currentShift      = null;
var cart              = [];
var products          = [];
var reportsData       = [];
var selectedPayMethod = null;
var LOW_STOCK_THRESHOLD = 5;

// --- PAYMENT METHOD ---
function selectPayMethod(method) {
  selectedPayMethod = method;
  ['tunai','qris','transfer'].forEach(function(m) {
    var d  = document.getElementById('dPay-' + m);
    var mo = document.getElementById('mPay-' + m);
    if (d)  d.classList.toggle('selected',  m === method);
    if (mo) mo.classList.toggle('selected', m === method);
  });
}

// --- CLOCK ---
function tickClock() {
  var el = document.getElementById('liveClock');
  if (el) el.innerText = new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
setInterval(tickClock, 1000);
tickClock();

// --- INIT ---
window.onload = function() {
  var d = document.getElementById('dashDate');
  if (d) d.innerText = new Date().toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  var saved = sessionStorage.getItem('kasirUser');
  if (saved) {
    currentUser = JSON.parse(saved);
    showApp();
  } else {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appPage').style.display   = 'none';
  }
};

function showApp() {
  document.getElementById('loginPage').style.display = 'none';
  var app = document.getElementById('appPage');
  app.style.display = 'flex';
  app.classList.remove('hidden-section');
  initApp();
}

function initApp() {
  var name = currentUser.name || currentUser.email;
  var ini  = name.charAt(0).toUpperCase();
  ['topbarAva','sidebarAva','mobileAva'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.innerText = ini;
  });
  document.getElementById('sidebarName').innerText = name;
  document.getElementById('sidebarRole').innerText = currentUser.role;
  if (currentUser.role !== 'Super Admin') {
    document.getElementById('nav-settings').style.display = 'none';
    document.getElementById('label-sistem').style.display = 'none';
  }
  checkShiftAvailability();
  loadProducts();
  loadReports();
  updateDashboard();
}

// --- UTILS ---
function escapeHtml(str) {
  var d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str || '')));
  return d.innerHTML;
}

function showToast(msg, type) {
  type = type || 'info';
  var dots = { success:'background:var(--green)', error:'background:var(--red)', info:'background:var(--accent)' };
  var t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = '<div class="toast-dot" style="' + (dots[type]||dots.info) + '"></div><span>' + escapeHtml(msg) + '</span>';
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(function() { t.classList.add('exit'); setTimeout(function(){ t.remove(); }, 250); }, 3200);
}

function showLoading(show) {
  document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showConfirm(msg, labelYes, onYes) {
  var modal = document.getElementById('confirmModal');
  document.getElementById('confirmMsg').innerText = msg;
  document.getElementById('confirmYes').innerText = labelYes || 'Ya';
  modal.style.display = 'flex';
  document.getElementById('confirmYes').onclick = function() { modal.style.display = 'none'; onYes(); };
  document.getElementById('confirmNo').onclick  = function() { modal.style.display = 'none'; };
}

// --- LOGIN ---
async function handleLogin() {
  var email = document.getElementById('email').value.trim();
  var pass  = document.getElementById('password').value;
  if (!email || !pass) { showToast('Email dan password wajib diisi!', 'error'); return; }
  showLoading(true);
  try {
    var res = await gasAPI.loginUser(email, pass);
    showLoading(false);
    if (res.success) {
      currentUser = res;
      sessionStorage.setItem('kasirUser', JSON.stringify(res));
      showApp();
    } else {
      showToast(res.message, 'error');
    }
  } catch (err) {
    showLoading(false);
    showToast('Gagal terhubung: ' + err.message, 'error');
  }
}

// --- LOGOUT ---
function logout() {
  sessionStorage.removeItem('kasirUser');
  currentUser = null; currentShift = null;
  cart = []; products = []; reportsData = []; selectedPayMethod = null;
  document.querySelectorAll('.section-content').forEach(function(el) {
    el.classList.add('hidden-section');
    el.classList.remove('active-section');
  });
  location.reload();
}

// --- SECTION NAVIGATION ---
var sectionTitles = { dashboard:'Dashboard', pos:'Kasir (POS)', reports:'Laporan', settings:'Pengaturan' };

function showSection(id) {
  if (id === 'settings' && currentUser.role !== 'Super Admin') { showToast('Akses ditolak!', 'error'); return; }
  document.querySelectorAll('.section-content').forEach(function(el) {
    el.classList.add('hidden-section'); el.classList.remove('active-section');
  });
  document.querySelectorAll('.nav-item').forEach(function(el) { el.classList.remove('active'); });
  var target = document.getElementById(id);
  target.classList.remove('hidden-section'); target.classList.add('active-section');
  var nav = document.getElementById('nav-' + id); if (nav) nav.classList.add('active');
  var tb = document.getElementById('topbarTitle'); if (tb) tb.innerText = sectionTitles[id] || id;
  if (window.innerWidth <= 900) closeSidebar();
  if (id === 'reports')   loadReports();
  if (id === 'dashboard') { updateDashboard(); checkLowStock(); }
  if (id === 'settings')  { populateStockProductSelect(); renderProductTable(); renderStaffTable(); }
  var fab = document.getElementById('floatingCartBtn');
  if (id === 'pos') { fab.classList.add('visible'); } else { fab.classList.remove('visible'); }
}

// --- MOBILE CART ---
function openMobileCart() {
  document.getElementById('mobileCartDrawer').classList.add('open');
  document.getElementById('mobileCartBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMobileCart() {
  document.getElementById('mobileCartDrawer').classList.remove('open');
  document.getElementById('mobileCartBackdrop').classList.remove('open');
  document.body.style.overflow = '';
}
function closeDesktopCart() { document.getElementById('cartPanel').classList.remove('open'); }

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { closeMobileCart(); closeDesktopCart(); }
});

// --- CART BADGE ---
function updateCartBadge() {
  var badge = document.getElementById('cartBadge');
  var total = cart.reduce(function(s, it){ return s + it.qty; }, 0);
  if (total > 0) { badge.style.display = 'flex'; badge.innerText = total > 99 ? '99+' : total; }
  else { badge.style.display = 'none'; }
}

// --- SIDEBAR ---
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarBackdrop').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('open');
}

// --- SHIFT ---
function checkShiftAvailability() {
  var h = new Date().getHours();
  var bp = document.getElementById('btnShiftPagi'), bs = document.getElementById('btnShiftSore');
  var dp = document.getElementById('currentShiftDisplay');
  bp.disabled = false; bs.disabled = false;
  if (h >= 6 && h < 13)       { currentShift = 'Pagi'; dp.innerText = 'Pagi (06:00–13:00)'; dp.style.color = 'var(--accent)'; bs.disabled = true; }
  else if (h >= 15 && h < 23) { currentShift = 'Sore'; dp.innerText = 'Sore (15:00–23:00)'; dp.style.color = 'var(--green)'; bp.disabled = true; }
  else { currentShift = null; dp.innerText = 'Sistem Tutup'; dp.style.color = 'var(--red)'; bp.disabled = true; bs.disabled = true; }
  updateCartTag();
}

function updateCartTag() {
  var content, color;
  if (currentShift === 'Pagi')      { content = '<i class="fas fa-sun" style="font-size:9px;"></i> Shift Pagi'; color = 'var(--accent)'; }
  else if (currentShift === 'Sore') { content = '<i class="fas fa-moon" style="font-size:9px;"></i> Shift Sore'; color = 'var(--green)'; }
  else                              { content = 'Pilih shift dulu'; color = 'var(--text3)'; }
  var el = document.getElementById('cartShiftDisplay'), elM = document.getElementById('mobileCartShiftTag');
  if (el)  { el.innerHTML  = content; el.style.color  = color; }
  if (elM) { elM.innerHTML = content; elM.style.color = color; }
}

function setShift(type) {
  var h = new Date().getHours();
  if (type==='Pagi' && h>=6 && h<13)       { currentShift='Pagi'; showToast('Shift Pagi aktif','success'); }
  else if (type==='Sore' && h>=15 && h<23) { currentShift='Sore'; showToast('Shift Sore aktif','success'); }
  else { showToast('Tidak bisa pilih shift ini sekarang','error'); return; }
  updateCartTag();
}

// --- CATEGORY ---
function handleCategoryChange() {
  var cat = document.getElementById('prodCat').value;
  var inp = document.getElementById('prodStock');
  if (cat === 'Makanan / Minuman') { inp.disabled = false; inp.placeholder = 'Jumlah stok awal'; }
  else { inp.disabled = true; inp.value = ''; inp.placeholder = 'Pilih kategori dulu'; }
}

function getCatClass(cat) {
  if (cat === 'Extend Member')  return 'cat-extend';
  if (cat === 'New Membership') return 'cat-member';
  return 'cat-food';
}

function getStockBadge(p) {
  if (p.category !== 'Makanan / Minuman') return '<span class="stock-badge stock-none">Tak terbatas</span>';
  var s = p.stock;
  if (s === null || s === undefined) return '<span class="stock-badge stock-none">—</span>';
  if (s === 0)  return '<span class="stock-badge stock-empty">Habis</span>';
  if (s <= 5)   return '<span class="stock-badge stock-low">Sisa ' + s + '</span>';
  return '<span class="stock-badge stock-ok">Stok ' + s + '</span>';
}

function setProductListEnabled(enabled) {
  var l = document.getElementById('productList');
  l.style.pointerEvents = enabled ? 'auto' : 'none';
  l.style.opacity = enabled ? '1' : '0.6';
}

// --- LOAD PRODUCTS ---
async function loadProducts() {
  setProductListEnabled(false); showLoading(true);
  try {
    var data = await gasAPI.getProducts();
    showLoading(false);
    products = data || [];
    renderProducts();
    renderProductTable();
    setProductListEnabled(true);
    checkLowStock();
  } catch (err) {
    showLoading(false);
    setProductListEnabled(true);
    showToast('Gagal memuat produk: ' + err.message, 'error');
  }
}

function renderProducts() {
  var c = document.getElementById('productList'), html = '';
  var cnt = document.getElementById('productCount');
  products.forEach(function(p, i) {
    var safeName = escapeHtml(p.name), safeCat = escapeHtml(p.category||'-');
    var isEmpty  = (p.category==='Makanan / Minuman' && p.stock===0);
    var cls      = 'product-card' + (isEmpty?' disabled':'');
    var click    = isEmpty ? '' : ' data-index="'+i+'" onclick="addToCartByIndex(this.dataset.index)"';
    html += '<div class="'+cls+'"'+click+'>' +
      '<span class="product-cat '+getCatClass(p.category)+'">'+safeCat+'</span>' +
      '<div class="product-name">'+safeName+'</div>' +
      '<div class="product-price">Rp '+parseInt(p.price).toLocaleString('id-ID')+'</div>' +
      getStockBadge(p) + '</div>';
  });
  c.innerHTML = html || '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:40px;font-size:13px;"><i class="fas fa-box-open" style="font-size:28px;opacity:0.3;display:block;margin-bottom:10px;"></i>Belum ada produk</div>';
  if (cnt) cnt.innerText = products.length + ' produk';
}

// --- CART ---
function addToCartByIndex(idx) {
  var p = products[parseInt(idx)]; if (!p) return;
  if (p.category==='Makanan / Minuman') {
    var inCart = 0;
    cart.forEach(function(it){ if(it.id===p.id) inCart = it.qty; });
    if (p.stock !== null && (inCart+1) > p.stock) { showToast('Stok '+p.name+' tidak cukup! Sisa: '+p.stock,'error'); return; }
  }
  var ex = cart.find(function(it){ return it.id===p.id; });
  if (ex) ex.qty++; else cart.push(Object.assign({},p,{qty:1}));
  renderCart();
  updateCartBadge();
  if (window.innerWidth > 900) document.getElementById('cartPanel').classList.add('open');
  if (window.innerWidth <= 900 && cart.length === 1) openMobileCart();
}

function buildCartItemHtml(item, idx) {
  var subtotal = item.price * item.qty;
  return '<div class="cart-item">' +
    '<div class="cart-item-top">' +
      '<div>' +
        '<div class="cart-item-name">' + escapeHtml(item.name) + '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px;">Rp ' + Number(item.price).toLocaleString('id-ID') + ' / pcs</div>' +
      '</div>' +
      '<div class="cart-del" onclick="removeFromCart('+idx+')"><i class="fas fa-times"></i></div>' +
    '</div>' +
    '<div class="cart-item-bottom">' +
      '<div class="qty-stepper">' +
        '<button class="qty-btn minus" onclick="changeQty('+idx+',-1)"><i class="fas fa-minus"></i></button>' +
        '<input class="qty-input" type="number" min="1" value="'+item.qty+'" ' +
          'onchange="setQtyDirect('+idx+',this.value)" onblur="setQtyDirect('+idx+',this.value)" onclick="this.select()">' +
        '<button class="qty-btn" onclick="changeQty('+idx+',1)"><i class="fas fa-plus"></i></button>' +
      '</div>' +
      '<div class="cart-item-subtotal">Rp ' + subtotal.toLocaleString('id-ID') + '</div>' +
    '</div>' +
    '</div>';
}

function renderCart() {
  var desktopEl = document.getElementById('cartItems');
  var mobileEl  = document.getElementById('mobileCartItems');
  var total = 0, html = '';
  if (cart.length === 0) {
    var emptyHtml = '<div class="cart-empty"><div class="cart-empty-icon"><i class="fas fa-shopping-basket"></i></div><p>Keranjang kosong</p><span>Klik produk untuk menambahkan</span></div>';
    if (desktopEl) desktopEl.innerHTML = emptyHtml;
    if (mobileEl)  mobileEl.innerHTML  = emptyHtml;
  } else {
    cart.forEach(function(item, idx) { total += item.price * item.qty; html += buildCartItemHtml(item, idx); });
    if (desktopEl) desktopEl.innerHTML = html;
    if (mobileEl)  mobileEl.innerHTML  = html;
  }
  var totalStr = 'Rp ' + total.toLocaleString('id-ID');
  var dtTotal  = document.getElementById('cartTotal');
  var mbTotal  = document.getElementById('mobileCartTotal');
  if (dtTotal) dtTotal.innerText = totalStr;
  if (mbTotal) mbTotal.innerText = totalStr;
  updateCartBadge();
}

function changeQty(idx, delta) {
  var item = cart[idx]; if (!item) return;
  var newQty = item.qty + delta;
  if (newQty < 1) { removeFromCart(idx); return; }
  if (item.category === 'Makanan / Minuman') {
    var prod = products.find(function(p){ return p.id === item.id; });
    if (prod && prod.stock !== null && newQty > prod.stock) { showToast('Stok '+item.name+' tidak cukup! Sisa: '+prod.stock,'error'); return; }
  }
  item.qty = newQty; renderCart();
}

function setQtyDirect(idx, val) {
  var item = cart[idx]; if (!item) return;
  var newQty = parseInt(val, 10);
  if (isNaN(newQty) || newQty < 1) newQty = 1;
  if (item.category === 'Makanan / Minuman') {
    var prod = products.find(function(p){ return p.id === item.id; });
    if (prod && prod.stock !== null && newQty > prod.stock) { showToast('Stok '+item.name+' tidak cukup! Sisa: '+prod.stock,'error'); newQty = prod.stock; }
  }
  item.qty = newQty; renderCart();
}

function removeFromCart(idx) {
  cart.splice(idx, 1); renderCart(); updateCartBadge();
  if (cart.length === 0 && window.innerWidth > 900) closeDesktopCart();
}

// --- CHECKOUT ---
async function processCheckout() {
  if (!cart.length)       { showToast('Keranjang masih kosong!','error'); return; }
  if (!currentShift)      { showToast('Pilih shift terlebih dahulu!','error'); return; }
  if (!selectedPayMethod) { showToast('Silahkan pilih metode pembayaran terlebih dahulu!','error'); return; }
  var el = document.getElementById('cartTotal') || document.getElementById('mobileCartTotal');
  var totalText = el ? el.innerText : '';
  var methodLabel = { tunai:'Tunai', qris:'QRIS', transfer:'Transfer' }[selectedPayMethod];
  var snap = cart.slice();
  showConfirm('Shift: '+currentShift+'\nMetode: '+methodLabel+'\nTotal: '+totalText+'\n\nLanjutkan pembayaran?','Bayar Sekarang', async function(){
    showLoading(true);
    try {
      var res = await gasAPI.processTransaction(snap, currentUser.name, currentShift, selectedPayMethod);
      showLoading(false);
      if (res.success) {
        showToast('Transaksi berhasil! ID: '+res.id,'success');
        cart = []; selectedPayMethod = null;
        ['tunai','qris','transfer'].forEach(function(m){
          var d = document.getElementById('dPay-'+m), mo = document.getElementById('mPay-'+m);
          if (d) d.classList.remove('selected'); if (mo) mo.classList.remove('selected');
        });
        renderCart(); updateCartBadge(); closeMobileCart();
        if (window.innerWidth > 900) closeDesktopCart();
        loadProductsAndCheckLowStock(snap);
        loadReports();
      } else { showToast('Gagal memproses transaksi.','error'); }
    } catch (err) { showLoading(false); showToast('Error: '+err.message,'error'); }
  });
}

// --- LOW STOCK ---
function checkLowStock() {
  var low = products.filter(function(p) {
    return p.category === 'Makanan / Minuman' && p.stock !== null && p.stock !== undefined && p.stock <= LOW_STOCK_THRESHOLD;
  });
  var banner = document.getElementById('lowStockBanner');
  var list   = document.getElementById('lowStockList');
  if (!banner || !list) return;
  if (!low.length) { banner.style.display = 'none'; return; }
  var html = '';
  low.forEach(function(p) {
    var color  = p.stock === 0 ? '#dc2626' : '#d97706';
    var bg     = p.stock === 0 ? '#fef2f2' : '#fffbeb';
    var border = p.stock === 0 ? '#fecaca' : '#fde68a';
    var label  = p.stock === 0 ? 'Habis' : 'Sisa ' + p.stock;
    html += '<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:8px;background:'+bg+';border:1px solid '+border+';font-size:12px;">' +
      '<span style="font-weight:600;color:#1f2937;">'+escapeHtml(p.name)+'</span>' +
      '<span style="font-weight:700;color:'+color+';">'+label+'</span>' +
      '</div>';
  });
  list.innerHTML = html;
  banner.style.display = 'block';
}

async function loadProductsAndCheckLowStock(soldSnap) {
  showLoading(true);
  try {
    var data = await gasAPI.getProducts();
    showLoading(false);
    products = data || [];
    renderProducts(); renderProductTable(); populateStockProductSelect();
    if (soldSnap) {
      soldSnap.forEach(function(item) {
        if (item.category !== 'Makanan / Minuman') return;
        var prod = products.find(function(p){ return p.id === item.id; });
        if (!prod || prod.stock === null) return;
        if (prod.stock === 0)                       showToast('Stok ' + prod.name + ' habis!', 'error');
        else if (prod.stock <= LOW_STOCK_THRESHOLD) showToast('Stok ' + prod.name + ' tinggal ' + prod.stock + '!', 'info');
      });
    }
    checkLowStock();
  } catch (err) { showLoading(false); showToast('Gagal memuat produk: ' + err.message, 'error'); }
}

// --- REPORTS ---
async function loadReports() {
  showLoading(true);
  try {
    var data = await gasAPI.getTransactionHistory();
    showLoading(false);
    reportsData = data || [];
    filteredReports = reportsData.slice();
    currentPage = 1;
    renderReportTable(filteredReports);
    populateStaffFilter();
  } catch (err) { showLoading(false); showToast('Gagal memuat laporan: '+err.message,'error'); }
}

var currentPage     = 1;
var pageSize        = 10;
var filteredReports = [];

function applyFilters(data) {
  var start   = document.getElementById('startDate').value;
  var end     = document.getElementById('endDate').value;
  var staff   = document.getElementById('staffFilter').value;
  var shift   = document.getElementById('shiftFilter').value;
  var payment = document.getElementById('paymentFilter').value;
  var r = data.slice();
  if (start && end) {
    var s = new Date(start); s.setHours(0,0,0,0);
    var e = new Date(end);   e.setHours(23,59,59,999);
    r = r.filter(function(row){ var d = new Date(row[0]); return d >= s && d <= e; });
  }
  if (staff)   r = r.filter(function(row){ return row[3] === staff; });
  if (shift)   r = r.filter(function(row){ return row[2] === shift; });
  if (payment) r = r.filter(function(row){ return (row[5]||'') === payment; });
  return r;
}

function filterReports() { currentPage = 1; filteredReports = applyFilters(reportsData); renderReportTable(filteredReports); }
function resetFilter() {
  ['startDate','endDate','staffFilter','shiftFilter','paymentFilter'].forEach(function(id){ document.getElementById(id).value=''; });
  currentPage = 1; filteredReports = reportsData.slice(); renderReportTable(filteredReports);
}

function changePageSize() {
  pageSize = parseInt(document.getElementById('pageSizeSelect').value, 10);
  currentPage = 1; renderReportTable(filteredReports);
}

function changePage(delta) {
  var total = Math.ceil(filteredReports.length / pageSize);
  currentPage = Math.max(1, Math.min(currentPage + delta, total));
  renderReportTable(filteredReports);
}

function renderReportTable(data) {
  filteredReports = data;
  var tbody = document.getElementById('reportTableBody');
  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:36px;"><i class="fas fa-inbox" style="font-size:24px;opacity:0.3;display:block;margin-bottom:8px;"></i>Belum ada data transaksi</td></tr>';
    document.getElementById('paginationBar').style.display = 'none';
    updateTotal([]); return;
  }
  var sorted = data.map(function(r){ return [new Date(r[0]), r[1], r[2], r[3], Number(r[4]), r[5]||'', r[6]||'', r[7]||'']; })
                   .sort(function(a,b){ return b[0] - a[0]; });
  var total    = Math.ceil(sorted.length / pageSize);
  currentPage  = Math.max(1, Math.min(currentPage, total));
  var startIdx = (currentPage - 1) * pageSize;
  var pageData = sorted.slice(startIdx, startIdx + pageSize);
  var payIcons = {
    'Tunai':    '<i class="fas fa-money-bill-wave" style="color:var(--green);margin-right:4px;font-size:10px;"></i>',
    'QRIS':     '<i class="fas fa-qrcode" style="color:var(--accent);margin-right:4px;font-size:10px;"></i>',
    'Transfer': '<i class="fas fa-exchange-alt" style="color:var(--amber);margin-right:4px;font-size:10px;"></i>'
  };
  var isAdmin = currentUser && currentUser.role === 'Super Admin';
  var html = '';
  pageData.forEach(function(row){
    var isVoid = row[6] === 'VOID';
    var rowStyle = isVoid ? 'opacity:0.5;' : '';
    var badge = row[2] === 'Pagi'
      ? '<span class="badge-shift badge-pagi"><i class="fas fa-sun" style="font-size:9px;margin-right:3px;"></i>Pagi</span>'
      : '<span class="badge-shift badge-sore"><i class="fas fa-moon" style="font-size:9px;margin-right:3px;"></i>Sore</span>';
    var payMethod = escapeHtml(row[5]) || '—';
    var payIcon   = payIcons[row[5]] || '';
    var payCell   = '<span style="font-size:12px;font-weight:600;color:var(--text2);">'+payIcon+payMethod+'</span>';
    var statusCell = isVoid
      ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;"><i class="fas fa-ban" style="font-size:9px;"></i> VOID</span>'
      : '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;"><i class="fas fa-check" style="font-size:9px;"></i> Lunas</span>';
    var voidBtn = (isAdmin && !isVoid)
      ? '<button class="btn-act red" style="padding:4px 9px;font-size:11px;" onclick="confirmVoidTransaction(\''+escapeHtml(row[1])+'\')"><i class="fas fa-ban"></i> Void</button>'
      : '';
    var totalCell = isVoid
      ? '<span style="font-family:\'Bricolage Grotesque\',sans-serif;font-weight:800;font-size:14px;color:var(--text3);text-decoration:line-through;">Rp '+row[4].toLocaleString('id-ID')+'</span>'
      : '<span class="td-money">Rp '+row[4].toLocaleString('id-ID')+'</span>';
    html += '<tr style="'+rowStyle+'">' +
      '<td style="font-size:12px;color:var(--text3);">'+row[0].toLocaleString('id-ID')+'</td>' +
      '<td class="td-id">'+escapeHtml(row[1])+'</td>' +
      '<td>'+badge+'</td>' +
      '<td class="td-bold">'+escapeHtml(row[3])+'</td>' +
      '<td>'+totalCell+'</td>' +
      '<td>'+payCell+'</td>' +
      '<td>'+statusCell+'</td>' +
      '<td>'+voidBtn+'</td>' +
      '</tr>';
  });
  tbody.innerHTML = html;
  var bar = document.getElementById('paginationBar');
  bar.style.display = 'flex';
  document.getElementById('pageInfo').innerText =
    'Menampilkan '+(startIdx+1)+'–'+Math.min(startIdx+pageSize, sorted.length)+' dari '+sorted.length+' transaksi';
  var pageNums = document.getElementById('pageNumbers');
  var numHtml  = '';
  var startP   = Math.max(1, currentPage - 2);
  var endP     = Math.min(total, startP + 4);
  if (endP - startP < 4) startP = Math.max(1, endP - 4);
  for (var p = startP; p <= endP; p++) {
    numHtml += '<button class="page-num-btn'+(p===currentPage?' active':'')+'" onclick="goToPage('+p+')">'+p+'</button>';
  }
  pageNums.innerHTML = numHtml;
  document.getElementById('btnPrevPage').disabled = currentPage <= 1;
  document.getElementById('btnNextPage').disabled = currentPage >= total;
  updateTotal(sorted);
}

function goToPage(p) { currentPage = p; renderReportTable(filteredReports); }

function updateTotal(data) {
  var t = data.filter(function(r){ return r[6] !== 'VOID'; })
              .reduce(function(s,r){ return s + Number(r[4]); }, 0);
  document.getElementById('reportTotal').innerText = t.toLocaleString('id-ID');
}

function confirmVoidTransaction(transactionId) {
  showConfirm(
    'Yakin ingin membatalkan (void) transaksi:\n"' + transactionId + '"?\n\nStok produk akan dikembalikan otomatis.\nTindakan ini tidak bisa dibatalkan.',
    'Ya, Void Sekarang',
    function() { doVoidTransaction(transactionId); }
  );
}

async function doVoidTransaction(transactionId) {
  showLoading(true);
  try {
    var res = await gasAPI.voidTransaction(transactionId, currentUser.email);
    showLoading(false);
    if (res.success) {
      showToast('Transaksi berhasil di-void!', 'success');
      loadProducts(); loadReports(); updateDashboard();
    } else { showToast(res.message || 'Gagal void transaksi.', 'error'); }
  } catch (err) { showLoading(false); showToast('Error: ' + err.message, 'error'); }
}

async function populateStaffFilter() {
  try {
    var list = await gasAPI.getStaffs();
    var sel = document.getElementById('staffFilter');
    var html = '<option value="">Semua Staff</option>';
    (list||[]).forEach(function(s){ html += '<option value="'+escapeHtml(s.name)+'">'+escapeHtml(s.name)+'</option>'; });
    sel.innerHTML = html;
  } catch(e) {}
}

// --- DASHBOARD ---
async function updateDashboard() {
  showLoading(true);
  try {
    var data = await gasAPI.getReports();
    showLoading(false);
    document.getElementById('dashPagiTotal').innerText = 'Rp '+data.pagi.total.toLocaleString('id-ID');
    document.getElementById('dashPagiCount').innerText = data.pagi.count+' Transaksi';
    document.getElementById('dashSoreTotal').innerText = 'Rp '+data.sore.total.toLocaleString('id-ID');
    document.getElementById('dashSoreCount').innerText = data.sore.count+' Transaksi';
    var g = data.pagi.total + data.sore.total, gc = data.pagi.count + data.sore.count;
    document.getElementById('dashGrandTotal').innerText = 'Rp '+g.toLocaleString('id-ID');
    document.getElementById('dashGrandCount').innerText = gc+' Transaksi';
    renderChart(data);
    updateRekapDashboard();
  } catch (err) { showLoading(false); showToast('Gagal memuat dashboard: '+err.message,'error'); }
}

function renderChart(data) {
  var ctx = document.getElementById('salesChart').getContext('2d');
  if (window.myChart) window.myChart.destroy();
  window.myChart = new Chart(ctx, {
    type:'bar',
    data:{labels:['Shift Pagi','Shift Sore'],datasets:[{label:'Pendapatan',data:[data.pagi.total,data.sore.total],backgroundColor:['rgba(37,99,235,0.12)','rgba(22,163,74,0.12)'],borderColor:['#2563eb','#16a34a'],borderWidth:2,borderRadius:8,borderSkipped:false}]},
    options:{responsive:true,plugins:{legend:{display:false},tooltip:{backgroundColor:'#fff',titleColor:'#0f1117',bodyColor:'#4b5263',borderColor:'#e4e7ed',borderWidth:1,callbacks:{label:function(ctx){return 'Rp '+ctx.parsed.y.toLocaleString('id-ID');}}}},scales:{x:{grid:{display:false},ticks:{color:'#8b91a0',font:{family:'DM Sans',weight:'600',size:12}}},y:{grid:{color:'#f1f3f7'},border:{display:false},ticks:{color:'#8b91a0',font:{family:'DM Sans',size:11},callback:function(v){return 'Rp '+(v>=1000000?(v/1000000).toFixed(1)+'jt':v.toLocaleString('id-ID'));}}}}}
  });
}

// --- SETTINGS TAB ---
function switchSettingsTab(tab) {
  ['produk','staff','keamanan','log'].forEach(function(t) {
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
    document.getElementById('settingsTab-' + t).style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'staff')  renderStaffTable();
  if (tab === 'produk') { renderProductTable(); populateStockProductSelect(); }
  if (tab === 'log')    loadActivityLog();
}

// --- PRODUCT MODAL ---
function openAddProductModal() {
  ['prodName','prodPrice','prodCat','prodStock'].forEach(function(id){ document.getElementById(id).value=''; });
  handleCategoryChange();
  document.getElementById('addProductModal').style.display = 'flex';
}
function closeAddProductModal() { document.getElementById('addProductModal').style.display = 'none'; }

async function handleAddProduct() {
  var name = document.getElementById('prodName').value.trim();
  var price = document.getElementById('prodPrice').value;
  var cat   = document.getElementById('prodCat').value;
  var stock = document.getElementById('prodStock').value;
  if (!name) { showToast('Nama produk wajib diisi!','error'); return; }
  var pn = parseFloat(price);
  if (isNaN(pn)||pn<=0) { showToast('Harga harus angka > 0!','error'); return; }
  if (!cat) { showToast('Pilih kategori!','error'); return; }
  var sn = 0;
  if (cat==='Makanan / Minuman') {
    if (stock==='') { showToast('Stok wajib diisi!','error'); return; }
    sn = parseInt(stock,10);
    if (isNaN(sn)||sn<0) { showToast('Stok harus 0 atau lebih!','error'); return; }
  }
  showLoading(true);
  try {
    var res = await gasAPI.addProduct(name, pn, cat, sn, currentUser.email);
    showLoading(false);
    if (res.success) {
      showToast('Produk berhasil ditambahkan!','success');
      ['prodName','prodPrice','prodCat','prodStock'].forEach(function(id){ document.getElementById(id).value=''; });
      handleCategoryChange(); closeAddProductModal(); loadProductsAndRefreshTable();
    } else { showToast(res.message||'Gagal.','error'); }
  } catch (err) { showLoading(false); showToast('Error: '+err.message,'error'); }
}

// --- STOCK MODAL ---
function openAddStockModal() {
  populateStockProductSelect();
  document.getElementById('stockAdd').value = '';
  document.getElementById('addStockModal').style.display = 'flex';
}
function closeAddStockModal() { document.getElementById('addStockModal').style.display = 'none'; }

function populateStockProductSelect() {
  var sel = document.getElementById('stockProdSelect'); if (!sel) return;
  var html = '<option value="">— Pilih Produk —</option>';
  products.filter(function(p){ return p.category === 'Makanan / Minuman'; })
    .forEach(function(p){ html += '<option value="'+escapeHtml(p.id)+'">'+escapeHtml(p.name)+'</option>'; });
  sel.innerHTML = html;
  document.getElementById('stockCurrent').value = '';
  document.getElementById('stockAdd').value = '';
}

function handleStockProductChange() {
  var sel = document.getElementById('stockProdSelect');
  var prodId = sel.value;
  var inp = document.getElementById('stockCurrent');
  if (!prodId) { inp.value=''; inp.placeholder='Pilih produk dulu'; return; }
  var prod = products.find(function(p){ return String(p.id) === String(prodId); });
  inp.value = prod ? (prod.stock !== null && prod.stock !== undefined ? prod.stock : 0) : '';
}

async function handleAddStock() {
  var prodId = document.getElementById('stockProdSelect').value;
  var addVal = document.getElementById('stockAdd').value;
  if (!prodId) { showToast('Pilih produk terlebih dahulu!','error'); return; }
  var addNum = parseInt(addVal, 10);
  if (isNaN(addNum)||addNum<1) { showToast('Jumlah tambah stok harus minimal 1!','error'); return; }
  showLoading(true);
  try {
    var res = await gasAPI.addStock(prodId, addNum, currentUser.email);
    showLoading(false);
    if (res.success) { showToast('Stok berhasil ditambahkan!','success'); document.getElementById('stockAdd').value=''; closeAddStockModal(); loadProductsAndRefreshTable(); }
    else { showToast(res.message||'Gagal menambah stok.','error'); }
  } catch (err) { showLoading(false); showToast('Error: '+err.message,'error'); }
}

// --- STAFF MODAL ---
function openAddStaffModal() {
  ['staffEmail','staffPass','staffName'].forEach(function(id){ document.getElementById(id).value=''; });
  document.getElementById('addStaffModal').style.display = 'flex';
}
function closeAddStaffModal() { document.getElementById('addStaffModal').style.display = 'none'; }

async function handleAddStaff() {
  var e = document.getElementById('staffEmail').value.trim();
  var p = document.getElementById('staffPass').value;
  var n = document.getElementById('staffName').value.trim();
  if (!e||!p||!n) { showToast('Semua field wajib diisi!','error'); return; }
  showLoading(true);
  try {
    var res = await gasAPI.addStaff(e, p, n, currentUser.email);
    showLoading(false);
    if (res.success) {
      showToast('Staff berhasil ditambahkan!','success');
      ['staffEmail','staffPass','staffName'].forEach(function(id){ document.getElementById(id).value=''; });
      closeAddStaffModal(); renderStaffTable(); populateStaffFilter();
    } else { showToast(res.message||'Gagal.','error'); }
  } catch (err) { showLoading(false); showToast('Error: '+err.message,'error'); }
}

async function handleChangePassword() {
  var np = document.getElementById('newPass').value;
  if (!np) { showToast('Password baru tidak boleh kosong!','error'); return; }
  showLoading(true);
  try {
    var res = await gasAPI.changePassword(currentUser.email, np);
    showLoading(false);
    if (res.success) { showToast('Password berhasil diubah!','success'); document.getElementById('newPass').value=''; }
    else { showToast(res.message||'Gagal.','error'); }
  } catch (err) { showLoading(false); showToast('Error: '+err.message,'error'); }
}

// --- EXPORT PDF ---
async function exportPDF() {
  var start   = document.getElementById('startDate').value;
  var end     = document.getElementById('endDate').value;
  var staff   = document.getElementById('staffFilter').value;
  var shift   = document.getElementById('shiftFilter').value;
  var payment = document.getElementById('paymentFilter').value;
  var d = applyFilters(reportsData).filter(function(r){ return r[6] !== 'VOID'; });
  if (!d.length) { showToast('Tidak ada data untuk diexport.','error'); return; }
  var total = d.reduce(function(s,r){ return s+Number(r[4]); }, 0);
  showLoading(true);
  try {
    var html = await gasAPI.generatePDF(d, start, end, staff, shift, payment, total);
    showLoading(false);
    var w = window.open('','','height=700,width=900');
    w.document.write(html); w.document.close(); w.print();
  } catch (err) { showLoading(false); showToast('Gagal generate PDF: '+err.message,'error'); }
}

// --- PRODUCT TABLE ---
function renderProductTable() {
  var tbody = document.getElementById('productTableBody');
  var count = document.getElementById('prodTableCount');
  if (!tbody) return;
  if (!products || !products.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:36px;">Belum ada produk</td></tr>';
    if (count) count.innerText = '0 produk';
    return;
  }
  if (count) count.innerText = products.length + ' produk';
  var html = '';
  products.forEach(function(p) {
    var stockCell = p.category !== 'Makanan / Minuman' ? '<span class="stock-badge stock-none">Tak terbatas</span>'
      : p.stock === 0 ? '<span class="stock-badge stock-empty">Habis</span>'
      : p.stock <= 5  ? '<span class="stock-badge stock-low">Sisa ' + p.stock + '</span>'
      : '<span class="stock-badge stock-ok">' + p.stock + '</span>';
    var catClass = p.category==='Extend Member' ? 'cat-extend' : p.category==='New Membership' ? 'cat-member' : 'cat-food';
    html += '<tr>' +
      '<td class="td-bold">'+escapeHtml(p.name)+'</td>' +
      '<td><span class="product-cat '+catClass+'" style="font-size:10px;">'+escapeHtml(p.category)+'</span></td>' +
      '<td style="font-family:\'Bricolage Grotesque\',sans-serif;font-weight:700;color:var(--green);">Rp '+Number(p.price).toLocaleString('id-ID')+'</td>' +
      '<td>'+stockCell+'</td>' +
      '<td style="text-align:center;">' +
        '<div style="display:flex;gap:6px;justify-content:center;">' +
          '<button class="btn-act" style="padding:5px 10px;font-size:11px;" onclick="openEditProductModal(\''+escapeHtml(String(p.id))+'\')"><i class="fas fa-pencil-alt"></i> Edit</button>' +
          '<button class="btn-act red" style="padding:5px 10px;font-size:11px;" onclick="confirmDeleteProduct(\''+escapeHtml(String(p.id))+'\', \''+escapeHtml(p.name)+'\')"><i class="fas fa-trash"></i> Hapus</button>' +
        '</div>' +
      '</td></tr>';
  });
  tbody.innerHTML = html;
}

function openEditProductModal(productId) {
  var prod = products.find(function(p){ return String(p.id) === String(productId); });
  if (!prod) { showToast('Produk tidak ditemukan!','error'); return; }
  document.getElementById('editProdId').value    = prod.id;
  document.getElementById('editProdName').value  = prod.name;
  document.getElementById('editProdPrice').value = prod.price;
  document.getElementById('editProdCat').value   = prod.category;
  var stockInp = document.getElementById('editProdStock');
  if (prod.category === 'Makanan / Minuman') { stockInp.disabled = false; stockInp.value = prod.stock !== null ? prod.stock : 0; }
  else { stockInp.disabled = true; stockInp.value = ''; }
  document.getElementById('editProductModal').style.display = 'flex';
}

function closeEditProductModal() { document.getElementById('editProductModal').style.display = 'none'; }

function handleEditCategoryChange() {
  var cat = document.getElementById('editProdCat').value;
  var inp = document.getElementById('editProdStock');
  if (cat === 'Makanan / Minuman') { inp.disabled = false; inp.placeholder = 'Jumlah stok'; }
  else { inp.disabled = true; inp.value = ''; }
}

async function handleUpdateProduct() {
  var id    = document.getElementById('editProdId').value;
  var name  = document.getElementById('editProdName').value.trim();
  var price = document.getElementById('editProdPrice').value;
  var cat   = document.getElementById('editProdCat').value;
  var stock = document.getElementById('editProdStock').value;
  if (!name) { showToast('Nama produk wajib diisi!','error'); return; }
  var pn = parseFloat(price);
  if (isNaN(pn)||pn<=0) { showToast('Harga harus angka > 0!','error'); return; }
  var sn = 0;
  if (cat==='Makanan / Minuman') { sn=parseInt(stock,10); if(isNaN(sn)||sn<0){showToast('Stok harus 0 atau lebih!','error');return;} }
  showLoading(true);
  try {
    var res = await gasAPI.updateProduct(id, name, pn, cat, sn, currentUser.email);
    showLoading(false);
    if (res.success) { showToast('Produk berhasil diupdate!','success'); closeEditProductModal(); loadProductsAndRefreshTable(); }
    else { showToast(res.message||'Gagal update produk.','error'); }
  } catch (err) { showLoading(false); showToast('Error: '+err.message,'error'); }
}

function confirmDeleteProduct(productId, productName) {
  showConfirm('Yakin ingin menghapus produk:\n"'+productName+'"?\n\nTindakan ini tidak bisa dibatalkan.', 'Hapus Produk', function(){ doDeleteProduct(productId); });
}

async function doDeleteProduct(productId) {
  showLoading(true);
  try {
    var res = await gasAPI.deleteProduct(productId, currentUser.email);
    showLoading(false);
    if (res.success) { showToast('Produk berhasil dihapus!','success'); loadProductsAndRefreshTable(); }
    else { showToast(res.message||'Gagal menghapus produk.','error'); }
  } catch (err) { showLoading(false); showToast('Error: '+err.message,'error'); }
}

async function loadProductsAndRefreshTable() {
  showLoading(true);
  try {
    var data = await gasAPI.getProducts();
    showLoading(false);
    products = data || [];
    renderProducts(); renderProductTable(); populateStockProductSelect(); checkLowStock();
  } catch (err) { showLoading(false); showToast('Gagal memuat produk: '+err.message,'error'); }
}

// --- STAFF TABLE ---
var staffList = [];

async function renderStaffTable() {
  showLoading(true);
  try {
    var list = await gasAPI.getStaffs();
    showLoading(false);
    staffList = list || [];
    var tbody = document.getElementById('staffTableBody');
    var count = document.getElementById('staffTableCount');
    if (!tbody) return;
    if (!staffList.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:36px;">Belum ada staff</td></tr>';
      if (count) count.innerText = '0 staff'; return;
    }
    if (count) count.innerText = staffList.length + ' staff';
    var html = '';
    staffList.forEach(function(s) {
      html += '<tr>' +
        '<td class="td-bold">'+escapeHtml(s.name)+'</td>' +
        '<td style="font-size:12px;color:var(--text3);">'+escapeHtml(s.email)+'</td>' +
        '<td><span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:3px 8px;border-radius:99px;background:var(--accent-s);color:var(--accent);border:1px solid var(--accent-b);">'+escapeHtml(s.role)+'</span></td>' +
        '<td style="text-align:center;">' +
          '<div style="display:flex;gap:6px;justify-content:center;">' +
            '<button class="btn-act" style="padding:5px 10px;font-size:11px;" onclick="openEditStaffModal(\''+escapeHtml(s.email)+'\')"><i class="fas fa-pencil-alt"></i> Edit</button>' +
            '<button class="btn-act red" style="padding:5px 10px;font-size:11px;" onclick="confirmDeleteStaff(\''+escapeHtml(s.email)+'\', \''+escapeHtml(s.name)+'\')"><i class="fas fa-trash"></i> Hapus</button>' +
          '</div>' +
        '</td></tr>';
    });
    tbody.innerHTML = html;
  } catch (err) { showLoading(false); showToast('Gagal memuat staff: '+err.message,'error'); }
}

function openEditStaffModal(email) {
  var staff = staffList.find(function(s){ return s.email===email; });
  if (!staff) { showToast('Staff tidak ditemukan!','error'); return; }
  document.getElementById('editStaffEmail').value        = staff.email;
  document.getElementById('editStaffEmailDisplay').value = staff.email;
  document.getElementById('editStaffName').value         = staff.name;
  document.getElementById('editStaffPass').value         = '';
  document.getElementById('editStaffModal').style.display = 'flex';
}

function closeEditStaffModal() { document.getElementById('editStaffModal').style.display = 'none'; }

async function handleUpdateStaff() {
  var email   = document.getElementById('editStaffEmail').value;
  var name    = document.getElementById('editStaffName').value.trim();
  var newPass = document.getElementById('editStaffPass').value;
  if (!name) { showToast('Nama staff wajib diisi!','error'); return; }
  showLoading(true);
  try {
    var res = await gasAPI.updateStaff(email, name, newPass, currentUser.email);
    showLoading(false);
    if (res.success) { showToast('Staff berhasil diupdate!','success'); closeEditStaffModal(); renderStaffTable(); populateStaffFilter(); }
    else { showToast(res.message||'Gagal update staff.','error'); }
  } catch (err) { showLoading(false); showToast('Error: '+err.message,'error'); }
}

function confirmDeleteStaff(email, name) {
  showConfirm('Yakin ingin menghapus akun staff:\n"'+name+'" ('+email+')?\n\nTindakan ini tidak bisa dibatalkan.', 'Hapus Staff', function(){ doDeleteStaff(email); });
}

async function doDeleteStaff(email) {
  showLoading(true);
  try {
    var res = await gasAPI.deleteStaff(email, currentUser.email);
    showLoading(false);
    if (res.success) { showToast('Staff berhasil dihapus!','success'); renderStaffTable(); populateStaffFilter(); }
    else { showToast(res.message||'Gagal menghapus staff.','error'); }
  } catch (err) { showLoading(false); showToast('Error: '+err.message,'error'); }
}

// --- REKAP DASHBOARD ---
async function updateRekapDashboard() {
  try {
    var data = await gasAPI.getRekapPeriode();
    document.getElementById('dashMingguTotal').innerText = 'Rp '+data.minggu.total.toLocaleString('id-ID');
    document.getElementById('dashMingguCount').innerText = data.minggu.count+' Transaksi';
    document.getElementById('dashBulanTotal').innerText  = 'Rp '+data.bulan.total.toLocaleString('id-ID');
    document.getElementById('dashBulanCount').innerText  = data.bulan.count+' Transaksi';
  } catch (err) { showToast('Gagal memuat rekap: '+err.message,'error'); }
}

// --- ACTIVITY LOG ---
async function loadActivityLog() {
  var tbody = document.getElementById('activityLogBody'); if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:24px;">Memuat...</td></tr>';
  var typeConfig = {
    'TAMBAH_STOK':   { icon:'fa-layer-group',  color:'var(--green)',  bg:'var(--green-s)',  label:'Tambah Stok' },
    'TAMBAH_STAFF':  { icon:'fa-user-plus',    color:'var(--accent)', bg:'var(--accent-s)', label:'Tambah Staff' },
    'EDIT_STAFF':    { icon:'fa-user-edit',    color:'var(--amber)',  bg:'var(--amber-s)',  label:'Edit Staff' },
    'HAPUS_STAFF':   { icon:'fa-user-minus',   color:'var(--red)',    bg:'var(--red-s)',    label:'Hapus Staff' },
    'UBAH_PASSWORD': { icon:'fa-key',          color:'#7c3aed',      bg:'#f5f3ff',         label:'Ubah Password' },
    'TAMBAH_PRODUK': { icon:'fa-plus',         color:'var(--green)',  bg:'var(--green-s)',  label:'Tambah Produk' },
    'EDIT_PRODUK':   { icon:'fa-pencil-alt',   color:'var(--amber)',  bg:'var(--amber-s)',  label:'Edit Produk' },
    'HAPUS_PRODUK':  { icon:'fa-trash',        color:'var(--red)',    bg:'var(--red-s)',    label:'Hapus Produk' },
  };
  try {
    var data = await gasAPI.getActivityLog();
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:36px;">Belum ada aktivitas</td></tr>'; return;
    }
    var html = '';
    data.forEach(function(row) {
      var cfg = typeConfig[row.type] || { icon:'fa-circle', color:'var(--text3)', bg:'var(--bg2)', label: row.type };
      var tgl = row.timestamp ? new Date(row.timestamp).toLocaleString('id-ID') : '-';
      html += '<tr>' +
        '<td style="font-size:12px;color:var(--text3);white-space:nowrap;">'+tgl+'</td>' +
        '<td><span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:3px 9px;border-radius:99px;background:'+cfg.bg+';color:'+cfg.color+';">' +
          '<i class="fas '+cfg.icon+'" style="font-size:9px;"></i>'+cfg.label+'</span></td>' +
        '<td style="font-size:12px;color:var(--text2);">'+escapeHtml(row.doer)+'</td>' +
        '<td style="font-size:12px;color:var(--text2);">'+escapeHtml(row.detail)+'</td></tr>';
    });
    tbody.innerHTML = html;
  } catch (err) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--red);padding:24px;">Gagal memuat: '+err.message+'</td></tr>'; }
}
