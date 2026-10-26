/**
 * NEXUS MAGIC STOREFRONT - MASTER APPLICATION LOGIC
 * Framework-free, Ultra-fast Reactive Application
 */

// Sample initial orders for realistic dashboard
const SAMPLE_ORDERS = [
  { code: "NX98201", customerName: "Nguyễn Văn An", phoneNumber: "0988112233", totalAmount: 1058000, paymentMethod: "COD (Thu tiền khi nhận)", status: "pending", createdAt: "26/10/2026 11:20" },
  { code: "NX98202", customerName: "Trần Thị Thảo", phoneNumber: "0912334455", totalAmount: 499000, paymentMethod: "Chuyển khoản QR MB", status: "confirmed", createdAt: "26/10/2026 10:45" },
  { code: "NX98203", customerName: "Lê Quốc Hưng", phoneNumber: "0934556677", totalAmount: 788000, paymentMethod: "Chuyển khoản QR MB", status: "shipping", createdAt: "26/10/2026 09:15" },
  { code: "NX98204", customerName: "Hoàng Thu Trang", phoneNumber: "0977889900", totalAmount: 369000, paymentMethod: "COD (Thu tiền khi nhận)", status: "done", createdAt: "25/10/2026 16:30" }
];

// Application State
const State = {
  theme: localStorage.getItem("nexus_theme") || "light",
  priceMode: localStorage.getItem("nexus_price_mode") || CONFIG.DEFAULT_PRICE_MODE,
  cart: JSON.parse(localStorage.getItem("nexus_cart") || "[]"),
  wishlist: JSON.parse(localStorage.getItem("nexus_wishlist") || "[]"),
  appliedCoupon: JSON.parse(localStorage.getItem("nexus_coupon") || "null"),
  orders: JSON.parse(localStorage.getItem("nexus_orders") || JSON.stringify(SAMPLE_ORDERS)),
  reviews: JSON.parse(localStorage.getItem("nexus_reviews") || JSON.stringify(INITIAL_REVIEWS)),
  user: JSON.parse(localStorage.getItem("nexus_user") || "null"),
  adminLoggedIn: localStorage.getItem("nexus_admin_logged_in") === "true",
  adminRole: localStorage.getItem("nexus_admin_role") || "super_admin",
  adminTab: "overview", // 'overview' | 'orders' | 'staff' | 'rbac' | 'audit'
  users: (() => {
    let saved = JSON.parse(localStorage.getItem("nexus_staff_users") || "[]");
    if (saved.length > 0 && (saved[0].name === "Nguyễn Minh Huy" || saved[0].id === "usr-1")) {
      saved = [];
      localStorage.setItem("nexus_staff_users", JSON.stringify([]));
    }
    return saved;
  })(),
  permissions: JSON.parse(localStorage.getItem("nexus_permissions") || JSON.stringify(PERMISSION_MATRIX)),
  auditLogs: JSON.parse(localStorage.getItem("nexus_audit_logs") || JSON.stringify([
    { id: "log-1", time: "26/10/2026 13:45", user: "Nguyễn Minh Huy", role: "super_admin", action: "Đăng nhập hệ thống quản trị", ip: "118.69.182.45", status: "success" },
    { id: "log-2", time: "26/10/2026 12:30", user: "Trần Thị Mai", role: "telesale", action: "Xác nhận đơn hàng #NX98201", ip: "118.69.182.46", status: "success" },
    { id: "log-3", time: "26/10/2026 10:15", user: "Lê Hoàng Nam", role: "warehouse", action: "Đóng gói & xuất kho đơn #NX98203", ip: "118.69.182.47", status: "success" },
    { id: "log-4", time: "26/10/2026 09:00", user: "Nguyễn Minh Huy", role: "super_admin", action: "Cập nhật ma trận phân quyền RBAC 2.0", ip: "118.69.182.45", status: "info" }
  ])),
  currentView: "home",
  viewArg: null,
  activeCategory: "all",
  searchQuery: "",
  sortOption: "default",
  compareIds: ["b02pro", "b26", "mc570"],
  chatOpen: false,
  chatMessages: [
    {
      role: "assistant",
      text: "Xin chào! Mình là **Trợ lý Nexus**, trợ lý tư vấn sản phẩm Magic chính hãng tại Nexus X Magic. Bạn cần mình gợi ý bình giữ nhiệt inox 316, tăm nước hay quạt làm lạnh nào hôm nay?",
      productIds: ["b02pro", "mc570"]
    }
  ]
};

// Utilities
function vnd(amount) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

function saveState(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function showToast(message, icon = "check_circle") {
  let toast = document.getElementById("toastMsg");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toastMsg";
    toast.className = "toast-msg";
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span class="material-symbols-outlined">${icon}</span> <span>${message}</span>`;
  toast.classList.add("show");
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove("show"), 3200);
}

function getProductPrice(product) {
  if (State.priceMode === "camp" || (State.appliedCoupon && State.appliedCoupon.type === "camp")) {
    return product.campPrice;
  }
  return product.dailyPrice;
}

function getCartTotals() {
  let subtotal = 0;
  let listTotal = 0;

  State.cart.forEach(item => {
    const p = PRODUCTS.find(prod => prod.id === item.id);
    if (p) {
      const price = getProductPrice(p);
      subtotal += price * item.qty;
      listTotal += p.listPrice * item.qty;
    }
  });

  let discount = 0;
  if (State.appliedCoupon) {
    if (State.appliedCoupon.type === "percent") {
      discount = Math.round((subtotal * State.appliedCoupon.value) / 100);
    } else if (State.appliedCoupon.type === "fixed") {
      if (!State.appliedCoupon.minOrder || subtotal >= State.appliedCoupon.minOrder) {
        discount = State.appliedCoupon.value;
      }
    } else if (State.appliedCoupon.type === "shipping") {
      discount = State.appliedCoupon.value;
    }
  }

  const shipping = subtotal >= 500000 || (State.appliedCoupon && State.appliedCoupon.type === "shipping") ? 0 : 30000;
  const total = Math.max(0, subtotal - discount) + shipping;
  const savings = Math.max(0, listTotal - total);

  return { subtotal, listTotal, discount, shipping, total, savings, count: State.cart.reduce((a, c) => a + c.qty, 0) };
}

// Router & View Management
function navigate(view, arg = null) {
  State.currentView = view;
  State.viewArg = arg;
  window.location.hash = arg ? `${view}-${arg}` : view;
  renderApp();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initRouter() {
  window.addEventListener("hashchange", handleHashChange);
  handleHashChange();
}

function handleHashChange() {
  const hash = window.location.hash.replace("#", "") || "home";
  const parts = hash.split("-");
  const view = parts[0];
  const arg = parts.slice(1).join("-");

  if (["home", "store", "product", "compare", "cart", "checkout", "order", "account", "admin", "support"].includes(view)) {
    State.currentView = view;
    State.viewArg = arg || null;
  } else {
    State.currentView = "home";
    State.viewArg = null;
  }
  renderApp();
}

// Cart Operations
function addToCart(productId, colorName = null, qty = 1, openFlyout = true) {
  const p = PRODUCTS.find(prod => prod.id === productId);
  if (!p) return;

  const defaultColor = colorName || (p.colors && p.colors[0] ? p.colors[0].name : "Tiêu chuẩn");
  const existing = State.cart.find(item => item.id === productId && item.color === defaultColor);

  if (existing) {
    existing.qty += qty;
  } else {
    State.cart.push({ id: productId, color: defaultColor, qty: qty });
  }

  saveState("nexus_cart", State.cart);
  updateCartBadge();
  showToast(`Đã thêm ${p.shortName} (${defaultColor}) vào giỏ hàng`);

  if (openFlyout) {
    openCartFlyout();
  }
}

function updateCartQty(index, change) {
  if (State.cart[index]) {
    State.cart[index].qty += change;
    if (State.cart[index].qty <= 0) {
      State.cart.splice(index, 1);
    }
    saveState("nexus_cart", State.cart);
    updateCartBadge();
    renderCartFlyoutContent();
    if (State.currentView === "cart" || State.currentView === "checkout") {
      renderApp();
    }
  }
}

function removeCartItem(index) {
  State.cart.splice(index, 1);
  saveState("nexus_cart", State.cart);
  updateCartBadge();
  renderCartFlyoutContent();
  if (State.currentView === "cart" || State.currentView === "checkout") {
    renderApp();
  }
  showToast("Đã xóa sản phẩm khỏi giỏ");
}

function applyCoupon(code) {
  const c = CONFIG.COUPONS[code.trim().toUpperCase()];
  if (c) {
    State.appliedCoupon = { code: code.toUpperCase(), ...c };
    saveState("nexus_coupon", State.appliedCoupon);
    showToast(`Áp dụng mã ${code.toUpperCase()} thành công!`);
  } else {
    showToast("Mã ưu đãi không hợp lệ", "error");
  }
  renderCartFlyoutContent();
  if (State.currentView === "cart" || State.currentView === "checkout") {
    renderApp();
  }
}

function removeCoupon() {
  State.appliedCoupon = null;
  localStorage.removeItem("nexus_coupon");
  showToast("Đã hủy áp dụng mã ưu đãi");
  renderCartFlyoutContent();
  if (State.currentView === "cart" || State.currentView === "checkout") {
    renderApp();
  }
}

function updateCartBadge() {
  const totals = getCartTotals();
  const badges = document.querySelectorAll(".cart-count-badge");
  badges.forEach(b => {
    b.textContent = totals.count;
    b.style.display = totals.count > 0 ? "flex" : "none";
  });
}

// Wishlist
function toggleWishlist(productId) {
  const idx = State.wishlist.indexOf(productId);
  if (idx > -1) {
    State.wishlist.splice(idx, 1);
    showToast("Đã xóa khỏi danh sách yêu thích");
  } else {
    State.wishlist.push(productId);
    showToast("Đã lưu vào danh sách yêu thích", "favorite");
  }
  saveState("nexus_wishlist", State.wishlist);
  renderApp();
}

// Theme Toggle
function toggleTheme() {
  State.theme = State.theme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", State.theme);
  localStorage.setItem("nexus_theme", State.theme);
  updateThemeIcon();
}

function updateThemeIcon() {
  const icon = document.getElementById("themeIcon");
  if (icon) {
    icon.textContent = State.theme === "dark" ? "light_mode" : "dark_mode";
  }
}

// Countdown Timer for Flash Sale
function startCountdown() {
  const timerEl = document.getElementById("tickerTimer");
  if (!timerEl) return;

  function update() {
    const now = new Date();
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const diff = Math.max(0, end - now);

    const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");

    timerEl.textContent = `${h}:${m}:${s}`;
  }
  update();
  setInterval(update, 1000);
}

// Render Top Views
function renderApp() {
  const app = document.getElementById("appMain");
  if (!app) return;

  // Update active nav links
  document.querySelectorAll(".gnav-link").forEach(link => {
    link.classList.remove("active");
    if (link.dataset.view === State.currentView) {
      link.classList.add("active");
    }
  });

  switch (State.currentView) {
    case "home":
      app.innerHTML = renderHomeHTML();
      attachHomeEvents();
      break;
    case "store":
      app.innerHTML = renderStoreHTML();
      attachStoreEvents();
      break;
    case "product":
      app.innerHTML = renderProductPageHTML(State.viewArg);
      attachProductEvents();
      break;
    case "compare":
      app.innerHTML = renderCompareHTML();
      attachCompareEvents();
      break;
    case "cart":
      app.innerHTML = renderCartPageHTML();
      attachCartEvents();
      break;
    case "checkout":
      app.innerHTML = renderCheckoutHTML();
      attachCheckoutEvents();
      break;
    case "order":
      app.innerHTML = renderOrderSuccessHTML(State.viewArg);
      break;
    case "account":
      if (!State.user) {
        app.innerHTML = `
          <div class="container" style="padding: 6rem 1.5rem; text-align:center;">
            <span class="material-symbols-outlined" style="font-size:72px; color:var(--ink-tertiary);">account_circle</span>
            <h2 style="font-size:1.5rem; font-weight:800; margin:1rem 0 0.5rem;">Tài Khoản Của Bạn</h2>
            <p style="color:var(--ink-secondary); margin-bottom:2rem;">Đăng nhập để xem đơn hàng, sản phẩm yêu thích và thông tin cá nhân.</p>
            <div class="flex gap-3 justify-center" style="flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="openAuthModal('login')">
                <span class="material-symbols-outlined">login</span> Đăng Nhập
              </button>
              <button class="btn btn-outline" onclick="openAuthModal('register')">
                <span class="material-symbols-outlined">person_add</span> Tạo Tài Khoản
              </button>
            </div>
          </div>`;
      } else {
        const base = renderAccountHTML();
        app.innerHTML = base.replace(
          '<h1 class="section-title" style="margin-bottom: 2rem;">T\u00e0i Kho\u1ea3n &amp; \u0110\u01a1n H\u00e0ng</h1>',
          `<div class="flex justify-between items-center" style="margin-bottom:2rem; flex-wrap:wrap; gap:1rem;">
            <div class="flex items-center gap-3">
              <div style="width:48px;height:48px;background:linear-gradient(135deg,var(--primary-accent),#c0392b);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:800;">${State.user.name ? State.user.name[0].toUpperCase() : '?'}</div>
              <div>
                <h1 class="section-title" style="margin:0; text-align:left; font-size:1.5rem;">Xin ch\u00e0o, ${State.user.name}!</h1>
                <p style="color:var(--ink-secondary); font-size:0.85rem; margin:0.25rem 0 0;">${State.user.email}</p>
              </div>
            </div>
            <button class="btn btn-outline btn-sm" onclick="logoutUser()" style="gap:0.4rem;">
              <span class="material-symbols-outlined" style="font-size:16px;">logout</span> Đăng Xuất
            </button>
          </div>`
        );
        attachAccountEvents();
      }
      break;
    case "admin":
      if (!State.adminLoggedIn) {
        app.innerHTML = `
          <div class="container" style="padding: 6rem 1.5rem; text-align:center;">
            <span class="material-symbols-outlined" style="font-size:72px; color:var(--ink-tertiary);">admin_panel_settings</span>
            <h2 style="font-size:1.5rem; font-weight:800; margin:1rem 0 0.5rem;">Khu Vực Quản Trị Nexus</h2>
            <p style="color:var(--ink-secondary); margin-bottom:2rem;">Bạn cần xác thực quyền quản trị viên để truy cập bảng điều khiển.</p>
            <button class="btn btn-primary" onclick="openAdminAuthModal()">
              <span class="material-symbols-outlined">shield</span> Đăng nhập Admin
            </button>
          </div>`;
        setTimeout(() => openAdminAuthModal(), 150);
      } else {
        app.innerHTML = renderAdminHTML();
        attachAdminEvents();
      }
      break;
    case "support":
      app.innerHTML = renderSupportHTML();
      attachSupportEvents();
      break;
    default:
      app.innerHTML = renderHomeHTML();
      attachHomeEvents();
  }
}

// ----------------------------------------------------
// VIEW: HOME
// ----------------------------------------------------
function renderHomeHTML() {
  const b02 = PRODUCTS.find(p => p.id === "b02pro");
  const a014 = PRODUCTS.find(p => p.id === "a014");
  const b26 = PRODUCTS.find(p => p.id === "b26");
  const mc1200 = PRODUCTS.find(p => p.id === "mc1200");

  return `
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="container">
        <div class="hero-box">
          <div class="hero-ambient-glow"></div>
          <div class="hero-grid">
            <div class="hero-content">
              <div class="brand-tag" style="display:inline-block; margin-bottom: 1rem;">
                ★ ĐẠI LÝ ỦY QUYỀN CHÍNH THỨC MAGIC VIETNAM
              </div>
              <h1>
                Gia dụng Magic.<br>
                <span class="highlight">Chuẩn xác & Tinh tế</span> từng giác quan.
              </h1>
              <p class="subtitle">
                Trải nghiệm thiết bị chăm sóc răng miệng áp lực cao, quạt làm lạnh bán dẫn tức thì và bộ sưu tập bình giữ nhiệt Inox 316 y tế cao cấp với độ bền vượt trội.
              </p>
              
              <div class="hero-deal-pill">
                <div>
                  <div class="deal-meta">FLASH SALE ĐỘC QUYỀN HÔM NAY</div>
                  <div class="deal-prices">
                    <span class="price-main">${vnd(b02.dailyPrice)}</span>
                    <span class="price-list">${vnd(b02.listPrice)}</span>
                    <span class="discount-badge">-63%</span>
                  </div>
                </div>
                <div class="flex gap-3">
                  <button class="btn btn-primary" onclick="addToCart('b02pro')">
                    <span class="material-symbols-outlined">bolt</span> Mua ngay B‑02PRO
                  </button>
                  <button class="btn btn-outline" onclick="navigate('product', 'b02pro')">
                    Xem chi tiết
                  </button>
                </div>
              </div>

              <div class="trust-strip">
                <div class="trust-item">
                  <div class="trust-icon"><span class="material-symbols-outlined">verified</span></div>
                  <div class="trust-text">
                    <h4>100% Chính Hãng</h4>
                    <p>Magic ủy quyền chính thức</p>
                  </div>
                </div>
                <div class="trust-item">
                  <div class="trust-icon"><span class="material-symbols-outlined">published_with_changes</span></div>
                  <div class="trust-text">
                    <h4>1 Đổi 1 trong 30 ngày</h4>
                    <p>Bảo hành 12 tháng điện tử</p>
                  </div>
                </div>
                <div class="trust-item">
                  <div class="trust-icon"><span class="material-symbols-outlined">local_shipping</span></div>
                  <div class="trust-text">
                    <h4>Giao nhanh 24h</h4>
                    <p>Freeship đơn từ 500k</p>
                  </div>
                </div>
                <div class="trust-item">
                  <div class="trust-icon"><span class="material-symbols-outlined">support_agent</span></div>
                  <div class="trust-text">
                    <h4>Tư vấn 24/7</h4>
                    <p>Hotline: 0787 712 566</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="hero-hero-img-box">
              <img src="images/sq_tn1.jpg" alt="Tăm nước Magic B-02PRO" class="hero-hero-img">
              <div class="hero-float-tag">
                <span class="pulse-dot"></span>
                <span>Tăm nước Magic B‑02PRO • Áp lực 120 PSI</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Bento Grid Showcase -->
    <section class="bento-section">
      <div class="container">
        <div class="section-head">
          <span class="section-tag">Bộ Sưu Tập Tiêu Biểu</span>
          <h2 class="section-title">Công Nghệ Định Hình Chuẩn Mực Sống</h2>
          <p class="section-desc">Mỗi thiết bị là sự kết hợp chuẩn xác giữa tính thực dụng tối đa và vật liệu y sinh an toàn cho sức khỏe.</p>
        </div>

        <div class="bento-grid">
          <!-- Bento 1: B02PRO -->
          <div class="bento-card bento-col-8">
            <span class="bento-badge">TOP 1 CHĂM SÓC RĂNG MIỆNG</span>
            <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: 1.5rem;">
              <div style="flex: 1; min-width: 260px;">
                <h3 class="bento-title">Tăm nước Magic B‑02PRO</h3>
                <p class="bento-desc">Áp lực xung 1.400 nhịp/phút đánh bay 99.9% mảng bám kẽ răng. Thân gấp gọn thông minh, chống nước tuyệt đối IPX7 an toàn.</p>
                <div style="margin-bottom: 1.25rem;">
                  <span style="font-size: 1.6rem; font-weight: 800; color: var(--primary);">${vnd(b02.dailyPrice)}</span>
                  <span style="text-decoration: line-through; color: var(--ink-tertiary); margin-left: 0.5rem;">${vnd(b02.listPrice)}</span>
                </div>
                <div class="flex gap-2">
                  <button class="btn btn-primary btn-sm" onclick="addToCart('b02pro')">Thêm giỏ hàng</button>
                  <button class="btn btn-outline btn-sm" onclick="navigate('product', 'b02pro')">Xem tính năng</button>
                </div>
              </div>
              <img src="images/tn_full_bento.png" alt="Tăm nước B02PRO" style="width: 260px; height: 260px; object-fit: cover; border-radius: var(--radius-lg); flex-shrink: 0;">
            </div>
          </div>

          <!-- Bento 2: A014 Quạt Peltier -->
          <div class="bento-card bento-col-4">
            <span class="bento-badge">CÔNG NGHỆ BÁN DẪN</span>
            <h3 class="bento-title">Quạt Làm Lạnh A‑014</h3>
            <p class="bento-desc">Tấm kim loại Peltier làm lạnh buốt sau 3–5 giây. 5 cấp gió cực đã.</p>
            <img src="images/quat_a014_bento.png" alt="Quạt sạc A-014" style="width: 100%; height: 200px; object-fit: cover; object-position: center top; border-radius: var(--radius-md); margin-bottom: 1rem;">
            <div class="flex justify-between items-center">
              <span style="font-size: 1.3rem; font-weight: 800; color: var(--primary);">${vnd(a014.dailyPrice)}</span>
              <button class="btn btn-primary btn-sm" onclick="addToCart('a014')">Mua ngay</button>
            </div>
          </div>

          <!-- Bento 3: Bộ sưu tập bình giữ nhiệt Inox 316 -->
          <div class="bento-card bento-col-12" id="thermosBento">
            <span class="bento-badge">CHUẨN Y TẾ KHÁNG AXIT</span>
            <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: 2rem;">
              <div style="flex: 1; min-width: 300px;">
                <h3 class="bento-title">Bộ Sưu Tập Bình Giữ Nhiệt Inox 316</h3>
                <p class="bento-desc">Vỏ Inox 304, ruột Inox 316 tráng bóng không bám mùi. Giữ nóng 12h, giữ lạnh đến 24h không đổ mồ hôi thân bình. Chọn dung tích phù hợp với bạn:</p>
                
                <!-- Capacity Interactive Selector -->
                <div class="flex gap-2" style="flex-wrap: wrap; margin-bottom: 1.5rem;" id="bentoThermosBtns">
                  <button class="btn btn-outline btn-sm active-thermos" onclick="switchBentoThermos('mc500')">500ml (MC500)</button>
                  <button class="btn btn-outline btn-sm" onclick="switchBentoThermos('mc570')">570ml (MC570 - Giá tốt)</button>
                  <button class="btn btn-outline btn-sm" onclick="switchBentoThermos('mc650')">650ml (Có ống hút)</button>
                  <button class="btn btn-outline btn-sm" onclick="switchBentoThermos('mc870')">870ml (Nắp bật)</button>
                  <button class="btn btn-outline btn-sm" onclick="switchBentoThermos('mc1200')">1.200ml (Đại dung tích)</button>
                  <button class="btn btn-outline btn-sm" onclick="switchBentoThermos('mpi480')">480ml (Ly doanh nhân)</button>
                </div>

                <div id="bentoThermosDetail">
                  <div style="font-size: 1.6rem; font-weight: 800; color: var(--primary); margin-bottom: 0.5rem;" id="bentoThermosPrice">
                    ${vnd(mc1200.dailyPrice)}
                  </div>
                  <div class="flex gap-2">
                    <button class="btn btn-primary btn-sm" id="bentoThermosBuy" onclick="addToCart('mc1200')">Thêm vào giỏ</button>
                    <button class="btn btn-outline btn-sm" id="bentoThermosView" onclick="navigate('product', 'mc1200')">Xem thông số</button>
                  </div>
                </div>
              </div>

              <div style="text-align: center;">
                <img id="bentoThermosImg" src="images/m1200_all.jpg" alt="Bình giữ nhiệt Magic" style="max-height: 240px; border-radius: var(--radius-lg); object-fit: contain;">
              </div>
            </div>
          </div>

          <!-- Bento 4: Bàn chải Sonic B-26 -->
          <div class="bento-card bento-col-6">
            <span class="bento-badge">SÓNG ÂM 40.000 LẦN/PHÚT</span>
            <h3 class="bento-title">Bàn Chải Điện Magic B‑26</h3>
            <p class="bento-desc">5 chế độ chải chuyên sâu, hẹn giờ 2 phút chuẩn nha khoa. Pin dùng 30 ngày.</p>
            <div class="flex items-center gap-3" style="margin: 1rem 0;">
              <span style="font-size: 0.85rem; font-weight: 600;">Màu sắc:</span>
              <span class="swatch-dot" style="background:#c9b8ec;" title="Tím"></span>
              <span class="swatch-dot" style="background:#f4f4f2;" title="Trắng"></span>
              <span class="swatch-dot" style="background:#a9cbea;" title="Xanh"></span>
            </div>
            <div class="flex justify-between items-center" style="margin-top: auto;">
              <span style="font-size: 1.4rem; font-weight: 800; color: var(--primary);">${vnd(b26.dailyPrice)}</span>
              <button class="btn btn-primary btn-sm" onclick="addToCart('b26')">Mua ngay</button>
            </div>
          </div>

          <!-- Bento 5: Quạt để bàn A-028 -->
          <div class="bento-card bento-col-6">
            <span class="bento-badge">PIN KHỦNG 3.600MAH</span>
            <h3 class="bento-title">Quạt Để Bàn Xoay 360° A‑028</h3>
            <p class="bento-desc">7 cánh quạt êm ái, xoay 360 độ, màn hình LED hiển thị pin, mát cả khi cúp điện.</p>
            <div class="flex justify-between items-center" style="margin-top: auto;">
              <span style="font-size: 1.4rem; font-weight: 800; color: var(--primary);">${vnd(539000)}</span>
              <button class="btn btn-primary btn-sm" onclick="addToCart('a028')">Mua ngay</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- All Products Catalog Section -->
    <section style="padding: 2.5rem 0 4rem;">
      <div class="container">
        <div class="flex justify-between items-center" style="margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 class="section-title" style="text-align: left; margin: 0;">Sản Phẩm Magic Đang Khuyến Mãi</h2>
            <p style="color: var(--ink-secondary);">Cam kết 100% chính hãng, đầy đủ tem bảo hành và phụ kiện nguyên seal.</p>
          </div>
          <button class="btn btn-outline" onclick="navigate('store')">
            Xem toàn bộ cửa hàng <span class="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>

        <div class="products-grid">
          ${PRODUCTS.map(p => renderProductCardHTML(p)).join("")}
        </div>
      </div>
    </section>
  `;
}

// Switcher for Thermos Bento interactive card
window.switchBentoThermos = function(prodId) {
  const p = PRODUCTS.find(item => item.id === prodId);
  if (!p) return;

  const imgEl = document.getElementById("bentoThermosImg");
  const priceEl = document.getElementById("bentoThermosPrice");
  const buyEl = document.getElementById("bentoThermosBuy");
  const viewEl = document.getElementById("bentoThermosView");

  if (imgEl) imgEl.src = p.cardImg;
  if (priceEl) priceEl.textContent = vnd(getProductPrice(p));
  if (buyEl) buyEl.onclick = () => addToCart(p.id);
  if (viewEl) viewEl.onclick = () => navigate("product", p.id);

  // Update button active states
  const btns = document.querySelectorAll("#bentoThermosBtns button");
  btns.forEach(b => {
    if (b.getAttribute("onclick").includes(prodId)) {
      b.className = "btn btn-primary btn-sm";
    } else {
      b.className = "btn btn-outline btn-sm";
    }
  });
};

// ----------------------------------------------------
// PRODUCT CARD COMPONENT
// ----------------------------------------------------
function renderProductCardHTML(p) {
  const isSaved = State.wishlist.includes(p.id);
  const price = getProductPrice(p);
  const discountPercent = Math.round(((p.listPrice - price) / p.listPrice) * 100);

  let swatchesHTML = "";
  if (p.colors && p.colors.length > 0) {
    swatchesHTML = `
      <div class="swatch-row">
        ${p.colors.map((c, i) => `
          <span class="swatch-dot ${i === 0 ? "active" : ""}" 
                style="background: ${c.hex};" 
                title="${c.name}"
                onclick="event.stopPropagation(); changeCardColor('${p.id}', '${c.img}', '${c.name}', this)">
          </span>
        `).join("")}
      </div>
    `;
  } else {
    swatchesHTML = `<div class="swatch-row"><span style="font-size:0.75rem; color:var(--ink-tertiary);">Bản tiêu chuẩn</span></div>`;
  }

  return `
    <div class="product-card" id="card-${p.id}" onclick="navigate('product', '${p.id}')">
      <div class="card-top">
        <span class="card-badge ${p.badge ? "hot" : ""}">${p.badge || `-${discountPercent}%`}</span>
        <button class="wishlist-btn ${isSaved ? "saved" : ""}" 
                onclick="event.stopPropagation(); toggleWishlist('${p.id}')" 
                title="Lưu yêu thích">
          <span class="material-symbols-outlined">${isSaved ? "favorite" : "favorite_border"}</span>
        </button>
      </div>

      <div class="product-thumb-box">
        <img src="${p.cardImg}" alt="${p.name}" class="product-thumb-img" id="thumb-${p.id}">
      </div>

      ${swatchesHTML}

      <h3 class="product-name">${p.name}</h3>
      <p class="product-tagline">${p.tagline}</p>

      <div class="product-rating">
        <span class="material-symbols-outlined star-icon" style="font-size:16px;">star</span>
        <span>${p.rating}</span>
        <span style="color:var(--ink-tertiary); font-weight:normal;">(${p.reviewCount})</span>
      </div>

      <div class="card-pricing">
        <span class="price-current">${vnd(price)}</span>
        <span class="price-old">${vnd(p.listPrice)}</span>
      </div>

      <div class="card-actions" onclick="event.stopPropagation()">
        <button class="btn btn-outline btn-sm" onclick="navigate('product', '${p.id}')">
          Chi tiết
        </button>
        <button class="btn btn-primary btn-sm" onclick="addToCart('${p.id}')">
          <span class="material-symbols-outlined" style="font-size: 16px;">add_shopping_cart</span> Thêm
        </button>
      </div>
    </div>
  `;
}

window.changeCardColor = function(prodId, imgSrc, colorName, dotEl) {
  const imgEl = document.getElementById(`thumb-${prodId}`);
  if (imgEl) {
    imgEl.src = imgSrc;
  }
  const parent = dotEl.parentElement;
  if (parent) {
    parent.querySelectorAll(".swatch-dot").forEach(d => d.classList.remove("active"));
    dotEl.classList.add("active");
  }
};

// ----------------------------------------------------
// VIEW: STORE (CATALOG)
// ----------------------------------------------------
function renderStoreHTML() {
  let filtered = [...PRODUCTS];

  if (State.activeCategory !== "all") {
    filtered = filtered.filter(p => p.cat === State.activeCategory);
  }

  if (State.searchQuery.trim()) {
    const q = State.searchQuery.toLowerCase();
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.shortName.toLowerCase().includes(q) || 
      p.tagline.toLowerCase().includes(q)
    );
  }

  if (State.sortOption === "price-asc") {
    filtered.sort((a, b) => getProductPrice(a) - getProductPrice(b));
  } else if (State.sortOption === "price-desc") {
    filtered.sort((a, b) => getProductPrice(b) - getProductPrice(a));
  } else if (State.sortOption === "discount") {
    filtered.sort((a, b) => ((b.listPrice - getProductPrice(b)) / b.listPrice) - ((a.listPrice - getProductPrice(a)) / a.listPrice));
  }

  return `
    <div class="container" style="padding-top: 1.5rem; padding-bottom: 4rem;">
      <div class="section-head">
        <span class="section-tag">Cửa Hàng Trực Tuyến</span>
        <h1 class="section-title">Danh Mục Sản Phẩm Magic</h1>
        <p class="section-desc">Toàn bộ 10 sản phẩm chính hãng với bảo hành 12 tháng 1 đổi 1 và ưu đãi trực tiếp tại Nexus.</p>
      </div>

      <!-- Category Filter Tabs -->
      <div class="cat-filter-tabs">
        ${CATEGORIES.map(c => `
          <button class="cat-tab ${State.activeCategory === c.id ? "active" : ""}" 
                  onclick="setCategoryFilter('${c.id}')">
            <span class="material-symbols-outlined" style="font-size: 18px;">${c.icon}</span>
            <span>${c.name}</span>
          </button>
        `).join("")}
      </div>

      <!-- Search & Sort Controls -->
      <div class="flex justify-between items-center" style="margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; background: var(--surface); padding: 1rem 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--border-glass);">
        <div class="flex items-center gap-2" style="flex: 1; max-width: 360px;">
          <span class="material-symbols-outlined" style="color: var(--ink-tertiary);">search</span>
          <input type="text" id="storeSearchInput" class="form-control" style="padding: 0.5rem 0.8rem;" 
                 placeholder="Tìm theo tên sản phẩm..." value="${State.searchQuery}">
        </div>

        <div class="flex items-center gap-3">
          <span style="font-size: 0.85rem; font-weight: 600; color: var(--ink-secondary);">Sắp xếp:</span>
          <select id="storeSortSelect" class="form-control" style="width: auto; padding: 0.5rem 0.8rem;">
            <option value="default" ${State.sortOption === "default" ? "selected" : ""}>Phổ biến nhất</option>
            <option value="price-asc" ${State.sortOption === "price-asc" ? "selected" : ""}>Giá: Thấp đến Cao</option>
            <option value="price-desc" ${State.sortOption === "price-desc" ? "selected" : ""}>Giá: Cao đến Thấp</option>
            <option value="discount" ${State.sortOption === "discount" ? "selected" : ""}>Ưu đãi nhiều nhất</option>
          </select>
        </div>
      </div>

      <!-- Products Grid -->
      ${filtered.length > 0 ? `
        <div class="products-grid">
          ${filtered.map(p => renderProductCardHTML(p)).join("")}
        </div>
      ` : `
        <div class="text-center" style="padding: 4rem 1rem;">
          <span class="material-symbols-outlined" style="font-size: 48px; color: var(--ink-tertiary);">search_off</span>
          <h3 style="margin-top: 1rem;">Không tìm thấy sản phẩm phù hợp</h3>
          <p style="color: var(--ink-secondary); margin-bottom: 1.5rem;">Hãy thử tìm kiếm với từ khóa khác hoặc bỏ bộ lọc.</p>
          <button class="btn btn-outline" onclick="resetFilters()">Xem tất cả sản phẩm</button>
        </div>
      `}
    </div>
  `;
}

window.setCategoryFilter = function(catId) {
  State.activeCategory = catId;
  renderApp();
};

window.resetFilters = function() {
  State.activeCategory = "all";
  State.searchQuery = "";
  State.sortOption = "default";
  renderApp();
};

function attachStoreEvents() {
  const searchInput = document.getElementById("storeSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      State.searchQuery = e.target.value;
      renderApp();
    });
  }

  const sortSelect = document.getElementById("storeSortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      State.sortOption = e.target.value;
      renderApp();
    });
  }
}

// ----------------------------------------------------
// VIEW: PRODUCT DETAIL (PDP)
// ----------------------------------------------------
function renderProductPageHTML(productId) {
  const p = PRODUCTS.find(item => item.id === productId) || PRODUCTS[0];
  const price = getProductPrice(p);
  const reviews = State.reviews.filter(r => r.prodId === p.id);
  const selectedColor = p.colors && p.colors[0] ? p.colors[0].name : "Tiêu chuẩn";

  return `
    <div class="container" style="padding-top: 1.5rem; padding-bottom: 4rem;">
      <!-- Breadcrumb -->
      <div style="font-size: 0.85rem; color: var(--ink-tertiary); margin-bottom: 1.5rem;" class="flex items-center gap-2">
        <a href="#home" onclick="navigate('home')">Trang chủ</a> <span>/</span>
        <a href="#store" onclick="navigate('store')">Cửa hàng</a> <span>/</span>
        <span style="color: var(--ink-primary); font-weight: 600;">${p.name}</span>
      </div>

      <div class="pdp-grid">
        <!-- Gallery -->
        <div class="pdp-gallery">
          <div class="pdp-main-img-box">
            <img src="${p.cardImg}" alt="${p.name}" class="pdp-main-img" id="pdpMainImg">
          </div>
          <div class="pdp-thumbs">
            ${p.images.map((img, i) => `
              <div class="pdp-thumb ${i === 0 ? "active" : ""}" onclick="setPdpImage('${img}', this)">
                <img src="${img}" alt="${p.name}">
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Info & Actions -->
        <div>
          <span class="card-badge hot" style="display:inline-block; margin-bottom: 0.5rem;">${p.badge || "Chính hãng Magic"}</span>
          <h1 class="pdp-title">${p.name}</h1>
          <p class="pdp-tagline">${p.tagline}</p>

          <div class="flex items-center gap-3" style="margin-bottom: 1rem;">
            <div class="product-rating" style="margin: 0;">
              <span class="material-symbols-outlined star-icon" style="font-size: 18px;">star</span>
              <span style="font-size: 0.95rem; font-weight: 700;">${p.rating}</span>
            </div>
            <span style="color: var(--ink-tertiary);">|</span>
            <span style="font-size: 0.85rem; color: var(--ink-secondary);">${reviews.length || p.reviewCount} đánh giá từ khách mua</span>
            <span style="color: var(--ink-tertiary);">|</span>
            <span style="font-size: 0.85rem; color: var(--status-success); font-weight: 600;">Còn hàng sẵn</span>
          </div>

          <div class="pdp-pricing-box">
            <span class="pdp-price">${vnd(price)}</span>
            <span style="text-decoration: line-through; color: var(--ink-tertiary);">${vnd(p.listPrice)}</span>
            <span class="discount-badge">Tiết kiệm ${vnd(p.listPrice - price)}</span>
          </div>

          <!-- Color Swatches -->
          ${p.colors && p.colors.length > 0 ? `
            <div style="margin-bottom: 1.5rem;">
              <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">
                Màu sắc: <span id="pdpSelectedColorName" style="color: var(--primary);">${p.colors[0].name}</span>
              </div>
              <div class="flex gap-2">
                ${p.colors.map((c, i) => `
                  <button class="btn btn-outline btn-sm ${i === 0 ? "active" : ""}" 
                          id="colorBtn-${i}"
                          onclick="selectPdpColor('${c.name}', '${c.img}', ${i})"
                          style="display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.85rem;">
                    <span class="swatch-dot" style="background: ${c.hex}; width: 14px; height: 14px;"></span>
                    <span>${c.name}</span>
                  </button>
                `).join("")}
              </div>
            </div>
          ` : ""}

          <!-- Quantity & Purchase Buttons -->
          <div class="flex items-center gap-3" style="margin-bottom: 1.75rem;">
            <div class="qty-control" style="padding: 0.2rem;">
              <button class="qty-btn" onclick="changePdpQty(-1)">-</button>
              <span class="qty-val" id="pdpQtyVal">1</span>
              <button class="qty-btn" onclick="changePdpQty(1)">+</button>
            </div>

            <button class="btn btn-outline" style="flex: 1;" onclick="handlePdpAddCart('${p.id}')">
              <span class="material-symbols-outlined">add_shopping_cart</span> Thêm vào giỏ
            </button>
            <button class="btn btn-primary" style="flex: 1.2;" onclick="handlePdpBuyNow('${p.id}')">
              Mua ngay
            </button>
          </div>

          <!-- Highlights -->
          <div style="background: var(--surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem;">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem;">Đặc Điểm Nổi Bật</h4>
            <ul style="padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.875rem; color: var(--ink-secondary);">
              ${p.highlights.map(h => `<li>${h}</li>`).join("")}
            </ul>
          </div>

          <!-- Technical Specs Table -->
          <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.5rem;">Thông Số Kỹ Thuật Chi Tiết</h4>
          <table class="pdp-specs-table">
            <tbody>
              ${Object.entries(p.specs).map(([k, v]) => `
                <tr>
                  <td>${k}</td>
                  <td>${v}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Reviews Section -->
      <div class="reviews-section">
        <div class="flex justify-between items-center" style="margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h3 style="font-size: 1.5rem; font-weight: 800;">Đánh Giá Của Khách Hàng</h3>
            <p style="color: var(--ink-secondary); font-size: 0.9rem;">Khách đã mua và sử dụng sản phẩm thực tế tại hệ thống Nexus</p>
          </div>
          <button class="btn btn-outline" onclick="openReviewDialog('${p.id}')">
            <span class="material-symbols-outlined">rate_review</span> Viết đánh giá
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${reviews.length > 0 ? reviews.map(r => `
            <div class="review-item">
              <div class="review-meta">
                <div class="flex items-center gap-2">
                  <span class="review-author">${r.name}</span>
                  ${r.verified ? `<span class="verified-tag"><span class="material-symbols-outlined" style="font-size:14px;">verified</span> Đã mua tại Nexus</span>` : ""}
                  ${r.color ? `<span style="font-size: 0.75rem; color: var(--ink-tertiary);">• Phân loại: ${r.color}</span>` : ""}
                </div>
                <span style="font-size: 0.775rem; color: var(--ink-tertiary);">${r.date}</span>
              </div>
              <div style="color: #f59e0b; margin-bottom: 0.35rem;">
                ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}
              </div>
              <h5 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.25rem;">${r.title}</h5>
              <p style="font-size: 0.875rem; color: var(--ink-secondary); line-height: 1.5;">${r.content}</p>
            </div>
          `).join("") : `
            <p style="color: var(--ink-tertiary); padding: 1.5rem 0;">Chưa có đánh giá nào cho sản phẩm này. Hãy là người đầu tiên trải nghiệm và chia sẻ!</p>
          `}
        </div>
      </div>
    </div>
  `;
}

let pdpQty = 1;
let pdpSelectedColor = "";

window.setPdpImage = function(src, thumbEl) {
  const main = document.getElementById("pdpMainImg");
  if (main) main.src = src;
  document.querySelectorAll(".pdp-thumb").forEach(t => t.classList.remove("active"));
  thumbEl.classList.add("active");
};

window.selectPdpColor = function(name, img, index) {
  pdpSelectedColor = name;
  const nameEl = document.getElementById("pdpSelectedColorName");
  if (nameEl) nameEl.textContent = name;
  const main = document.getElementById("pdpMainImg");
  if (main) main.src = img;

  document.querySelectorAll("[id^='colorBtn-']").forEach(b => b.classList.remove("btn-primary"));
  const activeBtn = document.getElementById(`colorBtn-${index}`);
  if (activeBtn) activeBtn.classList.add("btn-primary");
};

window.changePdpQty = function(delta) {
  pdpQty = Math.max(1, pdpQty + delta);
  const qtyEl = document.getElementById("pdpQtyVal");
  if (qtyEl) qtyEl.textContent = pdpQty;
};

window.handlePdpAddCart = function(prodId) {
  addToCart(prodId, pdpSelectedColor || null, pdpQty, true);
};

window.handlePdpBuyNow = function(prodId) {
  addToCart(prodId, pdpSelectedColor || null, pdpQty, false);
  navigate("checkout");
};

function attachProductEvents() {
  pdpQty = 1;
  pdpSelectedColor = "";
}

// ----------------------------------------------------
// VIEW: COMPARE MATRIX
// ----------------------------------------------------
function renderCompareHTML() {
  const selectedProducts = PRODUCTS.filter(p => State.compareIds.includes(p.id));

  return `
    <div class="container" style="padding-top: 1.5rem; padding-bottom: 4rem;">
      <div class="section-head">
        <span class="section-tag">Đối Chiếu Trực Quan</span>
        <h1 class="section-title">Bảng So Sánh Thông Số Kỹ Thuật</h1>
        <p class="section-desc">So sánh trực tiếp chất liệu inox 316, áp lực nước, dung lượng pin và giá bán giữa các model Magic.</p>
      </div>

      <!-- Product Picker Chips -->
      <div style="background: var(--surface); padding: 1.25rem; border-radius: var(--radius-lg); margin-bottom: 2rem; border: 1px solid var(--border-glass);">
        <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.75rem;">Chọn các sản phẩm cần đối chiếu (tối đa 4 sản phẩm):</h4>
        <div class="flex gap-2" style="flex-wrap: wrap;">
          ${PRODUCTS.map(p => {
            const isChecked = State.compareIds.includes(p.id);
            return `
              <button class="btn btn-sm ${isChecked ? "btn-primary" : "btn-outline"}" 
                      onclick="toggleCompareProduct('${p.id}')">
                <span class="material-symbols-outlined" style="font-size: 16px;">${isChecked ? "check" : "add"}</span>
                ${p.shortName}
              </button>
            `;
          }).join("")}
        </div>
      </div>

      <!-- Compare Table -->
      <div class="compare-table-wrapper">
        <table class="compare-table">
          <thead>
            <tr>
              <th>Thông số</th>
              ${selectedProducts.map(p => `
                <th>
                  <img src="${p.cardImg}" alt="${p.shortName}" class="compare-img">
                  <div style="font-weight: 800; font-size: 1rem;">${p.shortName}</div>
                  <div style="color: var(--primary); font-weight: 800; margin-top: 0.25rem;">${vnd(getProductPrice(p))}</div>
                  <button class="btn btn-primary btn-sm" style="margin-top: 0.5rem;" onclick="addToCart('${p.id}')">Mua ngay</button>
                </th>
              `).join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Dòng sản phẩm</td>
              ${selectedProducts.map(p => `<td>${CATEGORIES.find(c => c.id === p.cat)?.name}</td>`).join("")}
            </tr>
            <tr>
              <td>Tính năng cốt lõi</td>
              ${selectedProducts.map(p => `<td>${p.tagline}</td>`).join("")}
            </tr>
            <tr>
              <td>Dung tích / Kích thước</td>
              ${selectedProducts.map(p => `<td>${p.ml ? `${p.ml}ml` : (p.specs['Kích thước & Trọng lượng'] || p.specs['Trọng lượng'] || 'Nhỏ gọn cầm tay')}</td>`).join("")}
            </tr>
            <tr>
              <td>Chất liệu</td>
              ${selectedProducts.map(p => `<td>${p.specs['Chất liệu'] || 'Nhựa ABS & linh kiện y sinh'}</td>`).join("")}
            </tr>
            <tr>
              <td>Thời lượng pin</td>
              ${selectedProducts.map(p => `<td>${p.specs['Dung lượng pin'] || p.specs['Thời lượng pin'] || 'Không dùng pin'}</td>`).join("")}
            </tr>
            <tr>
              <td>Chống nước</td>
              ${selectedProducts.map(p => `<td>${p.specs['Kháng nước'] || 'Rửa bình thường'}</td>`).join("")}
            </tr>
            <tr>
              <td>Bảo hành chính hãng</td>
              ${selectedProducts.map(p => `<td>${p.warranty}</td>`).join("")}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.toggleCompareProduct = function(prodId) {
  const idx = State.compareIds.indexOf(prodId);
  if (idx > -1) {
    if (State.compareIds.length <= 1) {
      showToast("Cần ít nhất 1 sản phẩm để hiển thị", "warning");
      return;
    }
    State.compareIds.splice(idx, 1);
  } else {
    if (State.compareIds.length >= 4) {
      showToast("Tối đa so sánh cùng lúc 4 sản phẩm", "warning");
      return;
    }
    State.compareIds.push(prodId);
  }
  renderApp();
};

function attachCompareEvents() {}

// ----------------------------------------------------
// VIEW: CART PAGE
// ----------------------------------------------------
function renderCartPageHTML() {
  const totals = getCartTotals();

  if (State.cart.length === 0) {
    return `
      <div class="container text-center" style="padding: 5rem 1rem;">
        <span class="material-symbols-outlined" style="font-size: 64px; color: var(--ink-tertiary);">shopping_bag</span>
        <h2 style="margin: 1rem 0 0.5rem;">Giỏ hàng của bạn đang trống</h2>
        <p style="color: var(--ink-secondary); margin-bottom: 2rem;">Khám phá các sản phẩm gia dụng Magic chính hãng ngay hôm nay.</p>
        <button class="btn btn-primary" onclick="navigate('store')">Khám phá sản phẩm</button>
      </div>
    `;
  }

  return `
    <div class="container" style="padding-top: 1.5rem; padding-bottom: 4rem;">
      <h1 class="section-title" style="margin-bottom: 2rem;">Giỏ Hàng (${totals.count} sản phẩm)</h1>

      <div class="checkout-grid">
        <!-- Cart Items List -->
        <div>
          <div style="background: var(--surface); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm);">
            ${State.cart.map((item, index) => {
              const p = PRODUCTS.find(prod => prod.id === item.id);
              if (!p) return "";
              const price = getProductPrice(p);
              return `
                <div class="cart-item">
                  <img src="${p.cardImg}" alt="${p.shortName}" class="cart-item-img">
                  <div class="cart-item-info">
                    <h4>${p.name}</h4>
                    <div class="cart-item-variant">Màu sắc: <strong>${item.color}</strong></div>
                    <div class="cart-item-price">${vnd(price)}</div>
                  </div>
                  <div class="flex items-center gap-3">
                    <div class="qty-control">
                      <button class="qty-btn" onclick="updateCartQty(${index}, -1)">-</button>
                      <span class="qty-val">${item.qty}</span>
                      <button class="qty-btn" onclick="updateCartQty(${index}, 1)">+</button>
                    </div>
                    <button class="btn btn-outline btn-sm" style="padding: 0.3rem 0.6rem; color: var(--primary);" 
                            onclick="removeCartItem(${index})" title="Xóa">
                      <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
                    </button>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <!-- Summary & Coupon -->
        <div>
          <div style="background: var(--surface); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm);">
            <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1.25rem;">Tóm Tắt Đơn Hàng</h3>

            <!-- Coupon Input -->
            <div class="coupon-box">
              <input type="text" id="cartCouponInput" class="coupon-input" placeholder="Nhập mã ưu đãi (VD: CAMP, NEXUS10)">
              <button class="btn btn-outline btn-sm" onclick="handleApplyCoupon()">Áp dụng</button>
            </div>

            ${State.appliedCoupon ? `
              <div class="flex justify-between items-center" style="background: var(--primary-light); padding: 0.5rem 0.85rem; border-radius: var(--radius-md); margin-bottom: 1rem; border: 1px solid var(--border-focus);">
                <span style="font-size: 0.85rem; font-weight: 600; color: var(--primary);">
                  Mã: ${State.appliedCoupon.code} (${State.appliedCoupon.label})
                </span>
                <button style="background:none; border:none; cursor:pointer; color:var(--primary);" onclick="removeCoupon()">✕</button>
              </div>
            ` : ""}

            <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.9rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 1rem;">
              <div class="flex justify-between">
                <span style="color: var(--ink-secondary);">Tạm tính:</span>
                <span style="font-weight: 600;">${vnd(totals.subtotal)}</span>
              </div>
              ${totals.discount > 0 ? `
                <div class="flex justify-between" style="color: var(--primary);">
                  <span>Giảm giá voucher:</span>
                  <span style="font-weight: 700;">-${vnd(totals.discount)}</span>
                </div>
              ` : ""}
              <div class="flex justify-between">
                <span style="color: var(--ink-secondary);">Phí vận chuyển:</span>
                <span style="font-weight: 600;">${totals.shipping === 0 ? "Miễn phí" : vnd(totals.shipping)}</span>
              </div>
              <div class="flex justify-between" style="color: var(--status-success); font-weight: 600;">
                <span>Tiết kiệm so với giá niêm yết:</span>
                <span>${vnd(totals.savings)}</span>
              </div>
            </div>

            <div class="flex justify-between items-baseline" style="margin-bottom: 1.5rem;">
              <span style="font-size: 1.05rem; font-weight: 700;">Tổng thanh toán:</span>
              <span style="font-size: 1.6rem; font-weight: 800; color: var(--primary);">${vnd(totals.total)}</span>
            </div>

            <button class="btn btn-primary" style="width: 100%;" onclick="navigate('checkout')">
              Tiến hành thanh toán <span class="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.handleApplyCoupon = function() {
  const input = document.getElementById("cartCouponInput");
  if (input && input.value) {
    applyCoupon(input.value);
  }
};

function attachCartEvents() {}

// ----------------------------------------------------
// VIEW: CHECKOUT & PAYMENT (VIETQR / COD)
// ----------------------------------------------------
let selectedPaymentMethod = "COD";

function renderCheckoutHTML() {
  const totals = getCartTotals();

  if (State.cart.length === 0) {
    navigate("cart");
    return "";
  }

  const orderCode = "NX-" + Math.random().toString(36).substring(2, 7).toUpperCase();
  const vietQrUrl = `https://img.vietqr.io/image/${CONFIG.BANK.BANK_ID}-${CONFIG.BANK.ACCOUNT_NO}-compact2.png?amount=${totals.total}&addInfo=${orderCode}&accountName=${encodeURIComponent(CONFIG.BANK.ACCOUNT_NAME)}`;

  return `
    <div class="container" style="padding-top: 1.5rem; padding-bottom: 4rem;">
      <h1 class="section-title" style="margin-bottom: 2rem;">Thông Tin Đặt Hàng</h1>

      <form id="checkoutForm" onsubmit="handlePlaceOrder(event, '${orderCode}')">
        <div class="checkout-grid">
          <!-- Information Form -->
          <div style="background: var(--surface); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); padding: 2rem; box-shadow: var(--shadow-sm);">
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1.25rem;">1. Thông Tin Nhận Hàng</h3>

            <div class="form-group">
              <label class="form-label" for="custName">Họ và tên người nhận *</label>
              <input type="text" id="custName" class="form-control" placeholder="Ví dụ: Nguyễn Văn A" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="custPhone">Số điện thoại liên hệ (10 số) *</label>
              <input type="tel" id="custPhone" class="form-control" placeholder="Ví dụ: 0912345678" pattern="0[0-9]{9}" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="custAddress">Địa chỉ giao hàng chi tiết *</label>
              <textarea id="custAddress" class="form-control" rows="3" placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố..." required></textarea>
            </div>

            <div class="form-group">
              <label class="form-label" for="custNotes">Ghi chú giao hàng (không bắt buộc)</label>
              <input type="text" id="custNotes" class="form-control" placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi đến...">
            </div>

            <h3 style="font-size: 1.25rem; font-weight: 700; margin: 2rem 0 1rem;">2. Phương Thức Thanh Toán</h3>

            <div class="payment-methods">
              <div class="payment-option ${selectedPaymentMethod === "COD" ? "active" : ""}" 
                   onclick="selectPayment('COD')">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined" style="color: var(--primary);">payments</span>
                  <strong>Thanh toán khi nhận (COD)</strong>
                </div>
                <p style="font-size: 0.8rem; color: var(--ink-secondary);">Kiểm tra hàng trước khi thanh toán tiền mặt cho nhân viên giao hàng.</p>
              </div>

              <div class="payment-option ${selectedPaymentMethod === "BANK" ? "active" : ""}" 
                   onclick="selectPayment('BANK')">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined" style="color: var(--primary);">qr_code_2</span>
                  <strong>Chuyển khoản VietQR</strong>
                </div>
                <p style="font-size: 0.8rem; color: var(--ink-secondary);">Tự động quét mã QR qua ứng dụng ngân hàng, xác nhận tức thì.</p>
              </div>
            </div>

            <!-- VietQR Box preview if chosen -->
            <div id="vietQrPreviewBox" style="${selectedPaymentMethod === "BANK" ? "display:block;" : "display:none;"} background: var(--bg-subtle); padding: 1.5rem; border-radius: var(--radius-md); text-align: center; border: 1px dashed var(--primary); margin-bottom: 1.5rem;">
              <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem;">Quét Mã QR Qua Ứng Dụng Ngân Hàng</h4>
              <p style="font-size: 0.85rem; color: var(--ink-secondary); margin-bottom: 1rem;">Mã đơn: <strong>${orderCode}</strong> • Số tiền: <strong>${vnd(totals.total)}</strong></p>
              <img src="${vietQrUrl}" alt="VietQR Nexus" style="max-width: 240px; margin: 0 auto; border-radius: var(--radius-md); box-shadow: var(--shadow-md);">
              <div style="font-size: 0.8rem; color: var(--ink-tertiary); margin-top: 0.75rem;">
                ${CONFIG.BANK.BANK_NAME} • STK: <strong>${CONFIG.BANK.ACCOUNT_NO}</strong> • Chủ TK: <strong>${CONFIG.BANK.ACCOUNT_NAME}</strong>
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">
              <span class="material-symbols-outlined">check_circle</span> Xác Nhận Đặt Hàng (${vnd(totals.total)})
            </button>
          </div>

          <!-- Order Items Summary Sidebar -->
          <div>
            <div style="background: var(--surface); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm);">
              <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem;">Đơn Hàng (${totals.count} sản phẩm)</h4>

              <div style="max-height: 320px; overflow-y: auto; margin-bottom: 1rem;">
                ${State.cart.map(item => {
                  const p = PRODUCTS.find(prod => prod.id === item.id);
                  if (!p) return "";
                  const price = getProductPrice(p);
                  return `
                    <div class="flex items-center gap-3" style="padding: 0.6rem 0; border-bottom: 1px solid var(--border-subtle);">
                      <img src="${p.cardImg}" alt="${p.shortName}" style="width: 50px; height: 50px; border-radius: var(--radius-sm); object-fit: cover;">
                      <div style="flex: 1;">
                        <div style="font-size: 0.875rem; font-weight: 600;">${p.shortName}</div>
                        <div style="font-size: 0.75rem; color: var(--ink-tertiary);">Màu: ${item.color} x ${item.qty}</div>
                      </div>
                      <div style="font-weight: 700; font-size: 0.875rem; color: var(--primary);">
                        ${vnd(price * item.qty)}
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.875rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
                <div class="flex justify-between">
                  <span style="color: var(--ink-secondary);">Tạm tính:</span>
                  <span>${vnd(totals.subtotal)}</span>
                </div>
                ${totals.discount > 0 ? `
                  <div class="flex justify-between" style="color: var(--primary);">
                    <span>Khuyến mãi:</span>
                    <span>-${vnd(totals.discount)}</span>
                  </div>
                ` : ""}
                <div class="flex justify-between">
                  <span style="color: var(--ink-secondary);">Vận chuyển:</span>
                  <span>${totals.shipping === 0 ? "Miễn phí" : vnd(totals.shipping)}</span>
                </div>
                <div class="flex justify-between items-baseline" style="border-top: 1px solid var(--border-subtle); padding-top: 0.75rem; font-weight: 700; font-size: 1.15rem;">
                  <span>Tổng cộng:</span>
                  <span style="color: var(--primary); font-size: 1.4rem;">${vnd(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  `;
}

window.selectPayment = function(method) {
  selectedPaymentMethod = method;
  renderApp();
};

window.handlePlaceOrder = function(e, orderCode) {
  e.preventDefault();
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const address = document.getElementById("custAddress").value.trim();
  const notes = document.getElementById("custNotes") ? document.getElementById("custNotes").value.trim() : "";

  const totals = getCartTotals();

  const order = {
    code: orderCode,
    customerName: name,
    phoneNumber: phone,
    shippingAddress: address,
    notes: notes,
    paymentMethod: selectedPaymentMethod,
    items: [...State.cart],
    totalAmount: totals.total,
    status: "pending",
    createdAt: new Date().toLocaleString("vi-VN")
  };

  State.orders.unshift(order);
  saveState("nexus_orders", State.orders);

  // Clear cart
  State.cart = [];
  State.appliedCoupon = null;
  localStorage.removeItem("nexus_cart");
  localStorage.removeItem("nexus_coupon");
  updateCartBadge();

  navigate("order", orderCode);
};

function attachCheckoutEvents() {}

// ----------------------------------------------------
// VIEW: ORDER CONFIRMATION / SUCCESS
// ----------------------------------------------------
function renderOrderSuccessHTML(orderCode) {
  const order = State.orders.find(o => o.code === orderCode) || State.orders[0];

  return `
    <div class="container text-center" style="padding: 4rem 1rem;">
      <div style="background: var(--surface); max-width: 620px; margin: 0 auto; padding: 2.5rem; border-radius: var(--radius-xl); border: 1px solid var(--border-glass); box-shadow: var(--shadow-lg);">
        <div style="width: 72px; height: 72px; background: rgba(16, 185, 129, 0.15); border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; color: var(--status-success);">
          <span class="material-symbols-outlined" style="font-size: 42px;">check_circle</span>
        </div>

        <h1 style="font-size: 1.75rem; font-weight: 800; margin-bottom: 0.5rem;">Đặt Hàng Thành Công!</h1>
        <p style="color: var(--ink-secondary); font-size: 0.95rem; margin-bottom: 1.5rem;">
          Cảm ơn bạn đã tin tưởng lựa chọn sản phẩm Magic chính hãng tại Nexus. Đơn hàng của bạn đã được tiếp nhận và nhân viên sẽ liên hệ xác nhận trong thời gian sớm nhất.
        </p>

        <div style="background: var(--bg-subtle); padding: 1.25rem; border-radius: var(--radius-md); text-align: left; margin-bottom: 2rem; font-size: 0.9rem;">
          <div class="flex justify-between" style="margin-bottom: 0.5rem;">
            <span style="color: var(--ink-secondary);">Mã đơn hàng:</span>
            <strong style="color: var(--primary); font-size: 1rem;">#${order ? order.code : orderCode}</strong>
          </div>
          <div class="flex justify-between" style="margin-bottom: 0.5rem;">
            <span style="color: var(--ink-secondary);">Người nhận:</span>
            <strong>${order ? order.customerName : ""} (${order ? order.phoneNumber : ""})</strong>
          </div>
          <div class="flex justify-between" style="margin-bottom: 0.5rem;">
            <span style="color: var(--ink-secondary);">Địa chỉ:</span>
            <span style="text-align: right; max-width: 60%;">${order ? order.shippingAddress : ""}</span>
          </div>
          <div class="flex justify-between" style="margin-bottom: 0.5rem;">
            <span style="color: var(--ink-secondary);">Phương thức:</span>
            <strong>${order && order.paymentMethod === "COD" ? "Thanh toán khi nhận (COD)" : "Chuyển khoản ngân hàng VietQR"}</strong>
          </div>
          <div class="flex justify-between" style="border-top: 1px solid var(--border-subtle); padding-top: 0.5rem; font-weight: 700; font-size: 1.05rem;">
            <span>Tổng thanh toán:</span>
            <span style="color: var(--primary);">${order ? vnd(order.totalAmount) : ""}</span>
          </div>
        </div>

        <div class="flex gap-3 justify-center" style="flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="copyOrderDetails('${order ? order.code : ""}')">
            <span class="material-symbols-outlined">content_copy</span> Sao chép đơn hàng
          </button>
          <a href="tel:${CONFIG.HOTLINE}" class="btn btn-outline">
            <span class="material-symbols-outlined">call</span> Gọi Hotline: ${CONFIG.HOTLINE_DISPLAY}
          </a>
          <button class="btn btn-outline" onclick="navigate('home')">
            Về trang chủ
          </button>
        </div>
      </div>
    </div>
  `;
}

window.copyOrderDetails = function(code) {
  const order = State.orders.find(o => o.code === code);
  if (!order) return;

  const text = `NEXUS STORE - ĐƠN HÀNG #${order.code}\nKhách hàng: ${order.customerName} (${order.phoneNumber})\nĐịa chỉ: ${order.shippingAddress}\nTổng tiền: ${vnd(order.totalAmount)}\nPhương thức: ${order.paymentMethod}\nHotline hỗ trợ: ${CONFIG.HOTLINE_DISPLAY}`;
  navigator.clipboard.writeText(text).then(() => {
    showToast("Đã sao chép nội dung đơn hàng vào bộ nhớ tạm");
  });
};

// ----------------------------------------------------
// VIEW: ACCOUNT & ORDER TRACKING
// ----------------------------------------------------
function renderAccountHTML() {
  return `
    <div class="container" style="padding-top: 1.5rem; padding-bottom: 4rem;">
      <h1 class="section-title" style="margin-bottom: 2rem;">Tài Khoản & Đơn Hàng</h1>

      <div class="checkout-grid">
        <!-- Order History List -->
        <div>
          <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem;">Đơn Hàng Của Tôi (${State.orders.length})</h3>

          ${State.orders.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${State.orders.map(order => `
                <div style="background: var(--surface); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); padding: 1.25rem; box-shadow: var(--shadow-sm);">
                  <div class="flex justify-between items-center" style="margin-bottom: 0.75rem;">
                    <div>
                      <strong style="color: var(--primary); font-size: 1rem;">#${order.code}</strong>
                      <span style="font-size: 0.8rem; color: var(--ink-tertiary); margin-left: 0.5rem;">${order.createdAt}</span>
                    </div>
                    <span class="status-badge ${order.status}">
                      ${getStatusLabel(order.status)}
                    </span>
                  </div>

                  <div style="font-size: 0.875rem; color: var(--ink-secondary); margin-bottom: 0.75rem;">
                    Người nhận: <strong>${order.customerName}</strong> • ${order.phoneNumber}
                  </div>

                  <div class="flex justify-between items-center" style="border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
                    <span style="font-size: 0.85rem; color: var(--ink-tertiary);">${order.items.length} món</span>
                    <strong style="color: var(--primary); font-size: 1.05rem;">${vnd(order.totalAmount)}</strong>
                  </div>
                </div>
              `).join("")}
            </div>
          ` : `
            <div style="background: var(--surface); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); padding: 3rem 1.5rem; text-align: center;">
              <p style="color: var(--ink-secondary);">Bạn chưa có đơn hàng nào.</p>
              <button class="btn btn-primary btn-sm" style="margin-top: 1rem;" onclick="navigate('store')">Khám phá cửa hàng</button>
            </div>
          `}
        </div>

        <!-- Wishlist & Profile Info -->
        <div>
          <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem;">Sản Phẩm Đã Lưu (${State.wishlist.length})</h3>

          <div style="background: var(--surface); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); padding: 1.25rem; box-shadow: var(--shadow-sm);">
            ${State.wishlist.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${State.wishlist.map(id => {
                  const p = PRODUCTS.find(prod => prod.id === id);
                  if (!p) return "";
                  return `
                    <div class="flex items-center gap-3" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle);">
                      <img src="${p.cardImg}" alt="${p.shortName}" style="width: 44px; height: 44px; border-radius: var(--radius-sm); object-fit: cover;">
                      <div style="flex: 1;">
                        <a href="#product-${p.id}" onclick="navigate('product', '${p.id}')" style="font-weight: 600; font-size: 0.875rem;">${p.name}</a>
                        <div style="color: var(--primary); font-weight: 700; font-size: 0.85rem;">${vnd(getProductPrice(p))}</div>
                      </div>
                      <button class="btn btn-primary btn-sm" onclick="addToCart('${p.id}')">Mua</button>
                    </div>
                  `;
                }).join("")}
              </div>
            ` : `
              <p style="color: var(--ink-secondary); font-size: 0.875rem; text-align: center; padding: 1.5rem 0;">Chưa có sản phẩm nào được lưu.</p>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}

function getStatusLabel(status) {
  const map = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    shipping: "Đang giao hàng",
    done: "Hoàn tất",
    canceled: "Đã hủy"
  };
  return map[status] || status;
}

function attachAccountEvents() {}

// ----------------------------------------------------
// RBAC PERMISSION HELPERS & AUDIT ENGINE
// ----------------------------------------------------
function hasPermission(taskName, requiredLevel = 'allow') {
  if (State.adminRole === 'super_admin') return true;
  const p = State.permissions.find(item => item.task === taskName);
  if (!p) return false;
  const level = p[State.adminRole] || 'deny';
  if (requiredLevel === 'view') {
    return level === 'allow' || level === 'view';
  }
  return level === 'allow';
}

function addAuditLog(action, status = 'success') {
  const roleName = ROLES[State.adminRole]?.name || State.adminRole;
  const newLog = {
    id: "log-" + Date.now(),
    time: new Date().toLocaleString("vi-VN", { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }),
    user: (State.user ? State.user.name : "Admin") + ` (${roleName})`,
    role: State.adminRole,
    action,
    ip: "118.69." + Math.floor(Math.random() * 180 + 20) + "." + Math.floor(Math.random() * 200 + 10),
    status
  };
  State.auditLogs.unshift(newLog);
  if (State.auditLogs.length > 60) State.auditLogs.pop();
  saveState("nexus_audit_logs", State.auditLogs);
}

// ----------------------------------------------------
// VIEW: ADMIN MANAGEMENT & RBAC CONSOLE
// ----------------------------------------------------
function renderAdminHTML() {
  const currentRole = State.adminRole || "super_admin";
  const roleData = ROLES[currentRole] || ROLES.super_admin;
  const currentTab = State.adminTab || "overview";

  const canViewFinancials = hasPermission("Xem báo cáo KPI, doanh số và lợi nhuận", "view");
  const canChangePriceMode = hasPermission("Thay đổi chế độ giá bán (Flash Sale Camp / Daily)", "allow");
  const canConfirmOrders = hasPermission("Gọi điện xác nhận đơn & chuyển trạng thái 'Đã xác nhận'", "allow");
  const canShipOrders = hasPermission("Đóng gói hàng, xuất kho & in mã vận đơn ĐVVC", "allow");
  const canManageRBAC = hasPermission("Tạo nhân sự mới, gán vai trò & phân quyền RBAC", "allow");

  const totalRevenue = State.orders.reduce((sum, o) => sum + (o.status !== "canceled" ? o.totalAmount : 0), 0);
  const pendingOrders = State.orders.filter(o => o.status === "pending").length;

  return `
    <div class="admin-shell">
      <!-- Topbar Header with Role Simulator -->
      <div class="admin-topbar">
        <div class="flex items-center gap-3">
          <div style="width: 40px; height: 40px; background: rgba(229, 37, 42, 0.12); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; color: var(--primary);">
            <span class="material-symbols-outlined" style="font-size: 24px;">admin_panel_settings</span>
          </div>
          <div>
            <div style="font-weight: 800; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span>NEXUS RBAC CONSOLE</span>
              <span class="role-badge-pill" style="background: ${roleData.bg}; color: ${roleData.color}; border: 1px solid ${roleData.color}40;">
                <span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">${roleData.icon}</span> ${roleData.name}
              </span>
            </div>
            <div style="font-size: 0.72rem; color: var(--ink-secondary);">Hệ thống Quản Trị & Phân Quyền Đa Tầng • Chuẩn An Ninh Doanh Nghiệp</div>
          </div>
        </div>

        <!-- Role Simulator Pills -->
        <div class="flex items-center gap-2" style="flex-wrap: wrap;">
          <div class="flex items-center gap-1" style="background: var(--bg-subtle); padding: 0.25rem 0.5rem; border-radius: var(--radius-full); border: 1px solid var(--border-subtle);">
            <span style="font-size: 0.7rem; font-weight: 700; color: var(--ink-tertiary); text-transform: uppercase; padding: 0 0.3rem;">
              Giả lập vai trò:
            </span>
            <button class="role-pill-btn ${currentRole === 'super_admin' ? 'active' : ''}" onclick="switchAdminRole('super_admin')">
              👑 Super Admin
            </button>
            <button class="role-pill-btn ${currentRole === 'telesale' ? 'active' : ''}" onclick="switchAdminRole('telesale')">
              📞 Telesale
            </button>
            <button class="role-pill-btn ${currentRole === 'warehouse' ? 'active' : ''}" onclick="switchAdminRole('warehouse')">
              📦 Kho Vận
            </button>
            <button class="role-pill-btn ${currentRole === 'support' ? 'active' : ''}" onclick="switchAdminRole('support')">
              🎧 CSKH
            </button>
          </div>

          <button class="btn btn-outline btn-sm" onclick="navigate('home')">
            <span class="material-symbols-outlined" style="font-size: 16px;">storefront</span> Cửa Hàng
          </button>
          <button class="btn btn-outline btn-sm" onclick="handleAdminLogout()" style="color: var(--primary); border-color: rgba(229, 37, 42, 0.3);">
            <span class="material-symbols-outlined" style="font-size: 16px;">logout</span> Thoát
          </button>
        </div>
      </div>

      <!-- Layout Body: Sidebar + Main Canvas -->
      <div class="admin-layout-body">
        <!-- Sidebar Navigation -->
        <aside class="admin-sidebar">
          <div>
            <div class="admin-nav-group-title">QUẢN TRỊ KINH DOANH</div>
            <div class="admin-nav-item ${currentTab === 'overview' ? 'active' : ''}" onclick="setAdminTab('overview')">
              <span class="material-symbols-outlined">dashboard</span>
              <span>Tổng Quan & KPI</span>
            </div>
            <div class="admin-nav-item ${currentTab === 'orders' ? 'active' : ''}" onclick="setAdminTab('orders')">
              <span class="material-symbols-outlined">shopping_cart_checkout</span>
              <span>Quản Lý Đơn Hàng</span>
              ${pendingOrders > 0 ? `<span style="margin-left:auto; background:#f59e0b; color:#fff; font-size:0.68rem; font-weight:700; padding:0.1rem 0.45rem; border-radius:9999px;">${pendingOrders}</span>` : ''}
            </div>
          </div>

          <div>
            <div class="admin-nav-group-title">HỆ THỐNG & PHÂN QUYỀN</div>
            <div class="admin-nav-item ${currentTab === 'staff' ? 'active' : ''}" onclick="setAdminTab('staff')">
              <span class="material-symbols-outlined">group</span>
              <span>Nhân Sự & Vai Trò</span>
              <span style="margin-left:auto; background:var(--surface); border:1px solid var(--border-subtle); color:var(--ink-secondary); font-size:0.68rem; font-weight:700; padding:0.1rem 0.45rem; border-radius:9999px;">${State.users.length}</span>
            </div>
            <div class="admin-nav-item ${currentTab === 'rbac' ? 'active' : ''}" onclick="setAdminTab('rbac')">
              <span class="material-symbols-outlined">security</span>
              <span>Ma Trận Phân Quyền RBAC</span>
            </div>
            <div class="admin-nav-item ${currentTab === 'audit' ? 'active' : ''}" onclick="setAdminTab('audit')">
              <span class="material-symbols-outlined">history_toggle_off</span>
              <span>Nhật Ký Kiểm Toán</span>
              <span style="margin-left:auto; background:rgba(16,185,129,0.15); color:#10b981; font-size:0.68rem; font-weight:700; padding:0.1rem 0.4rem; border-radius:9999px;">Live</span>
            </div>
          </div>

          <!-- Current Role Capability Footer -->
          <div style="margin-top: auto; padding: 1rem; background: var(--surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); box-shadow: var(--shadow-sm);">
            <div style="font-size: 0.7rem; font-weight: 800; color: var(--ink-tertiary); text-transform: uppercase; margin-bottom: 0.35rem;">
              VAI TRÒ ĐANG MÔ PHỎNG
            </div>
            <div style="font-size: 0.88rem; font-weight: 700; color: ${roleData.color}; display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.3rem;">
              <span class="material-symbols-outlined" style="font-size: 16px;">${roleData.icon}</span>
              <span>${roleData.name}</span>
            </div>
            <p style="font-size: 0.74rem; color: var(--ink-secondary); line-height: 1.4; margin: 0 0 0.5rem;">
              ${roleData.desc}
            </p>
            <div style="font-size: 0.68rem; color: #10b981; font-weight: 600; display: flex; align-items: center; gap: 0.3rem;">
              <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#10b981;"></span>
              Hệ thống RBAC áp dụng theo thời gian thực
            </div>
          </div>
        </aside>

        <!-- Main Workspace Area -->
        <main class="admin-main-canvas">
          ${renderAdminTabWorkspace(currentTab, { totalRevenue, pendingOrders, canViewFinancials, canChangePriceMode, canConfirmOrders, canShipOrders, canManageRBAC, currentRole })}
        </main>
      </div>
    </div>
  `;
}

function renderAdminTabWorkspace(tab, p) {
  switch (tab) {
    case "overview":
      return renderAdminOverviewTab(p);
    case "orders":
      return renderAdminOrdersTab(p);
    case "staff":
      return renderAdminStaffTab(p);
    case "rbac":
      return renderAdminRbacTab(p);
    case "audit":
      return renderAdminAuditTab(p);
    default:
      return renderAdminOverviewTab(p);
  }
}

// ---- TAB 1: OVERVIEW & KPI ----
function renderAdminOverviewTab(p) {
  const currentRole = p.currentRole;
  return `
    <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0 0 0.3rem;">Tổng Quan Hiệu Suất Cửa Hàng</h2>
        <p style="color: var(--ink-secondary); font-size: 0.85rem; margin: 0;">Theo dõi chỉ số bán hàng, vận đơn và kiểm soát an ninh phân quyền</p>
      </div>

      <!-- Price Mode Switcher with Permission Lock -->
      <div style="background: var(--surface); padding: 0.6rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-glass); display: flex; align-items: center; gap: 0.75rem;">
        <span style="font-size: 0.8rem; font-weight: 700; color: var(--ink-secondary);">Chế độ giá bán:</span>
        ${p.canChangePriceMode ? `
          <button class="btn btn-sm ${State.priceMode === 'daily' ? 'btn-primary' : 'btn-outline'}" onclick="setPriceMode('daily')">Giá Hằng Ngày</button>
          <button class="btn btn-sm ${State.priceMode === 'camp' ? 'btn-primary' : 'btn-outline'}" onclick="setPriceMode('camp')">Giá Flash Sale</button>
        ` : `
          <span style="font-size: 0.78rem; color: #f59e0b; background: rgba(245, 158, 11, 0.1); padding: 0.25rem 0.6rem; border-radius: var(--radius-full); font-weight: 600; display: inline-flex; align-items: center; gap: 0.3rem;">
            <span class="material-symbols-outlined" style="font-size: 14px;">lock</span> Đang dùng ${State.priceMode === 'daily' ? 'Giá hằng ngày' : 'Giá Flash Sale'} (Chỉ Super Admin mới đổi được)
          </span>
        `}
      </div>
    </div>

    <!-- Restrict Warning Banner if Not Super Admin -->
    ${currentRole !== 'super_admin' ? `
      <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: var(--radius-md); padding: 0.85rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
        <span class="material-symbols-outlined" style="color: #3b82f6; font-size: 22px;">verified_user</span>
        <div style="font-size: 0.85rem; color: var(--ink-primary);">
          Bạn đang mô phỏng góc nhìn của <strong>${ROLES[currentRole].name}</strong>. Các tính năng không được cấp phép trong Ma trận RBAC sẽ tự động ẩn hoặc bị khóa bảo vệ.
        </div>
      </div>
    ` : ''}

    <!-- KPI Stats Grid -->
    <div class="admin-stats-grid" style="margin-bottom: 2rem;">
      <div class="stat-card">
        <span style="font-size: 0.8rem; color: var(--ink-secondary); font-weight: 600; display: flex; align-items: center; justify-content: space-between;">
          Tổng Doanh Thu
          ${!p.canViewFinancials ? `<span class="material-symbols-outlined" style="font-size: 16px; color:#f59e0b;">lock</span>` : ''}
        </span>
        <div class="stat-num">
          ${p.canViewFinancials ? vnd(p.totalRevenue) : `<span style="font-size: 1.1rem; color: var(--ink-tertiary);">•••••••• (Bảo mật)</span>`}
        </div>
        <div style="font-size: 0.72rem; color: ${p.canViewFinancials ? '#10b981' : '#f59e0b'};">
          ${p.canViewFinancials ? '● Cập nhật từ các đơn thực tế' : 'Cần quyền Xem Tài Chính'}
        </div>
      </div>

      <div class="stat-card">
        <span style="font-size: 0.8rem; color: var(--ink-secondary); font-weight: 600;">Tổng Đơn Hàng</span>
        <div class="stat-num">${State.orders.length}</div>
        <div style="font-size: 0.72rem; color: var(--ink-secondary);">Toàn bộ các kênh online</div>
      </div>

      <div class="stat-card">
        <span style="font-size: 0.8rem; color: var(--ink-secondary); font-weight: 600;">Đơn Chờ Xác Nhận</span>
        <div class="stat-num" style="color: #f59e0b;">${p.pendingOrders}</div>
        <div style="font-size: 0.72rem; color: #f59e0b;">Ưu tiên chốt cuộc gọi Telesale</div>
      </div>

      <div class="stat-card">
        <span style="font-size: 0.8rem; color: var(--ink-secondary); font-weight: 600;">Nhân Sự Hệ Thống</span>
        <div class="stat-num" style="color: #059669;">${State.users.length}</div>
        <div style="font-size: 0.72rem; color: #059669;">4 vai trò phân quyền hoạt động</div>
      </div>
    </div>

    <!-- 4 Role Overview Cards -->
    <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1rem;">Cấu Trúc 4 Cấp Độ Vai Trò Trong Hệ Thống</h3>
    <div class="role-cards-grid" style="margin-bottom: 2.5rem;">
      ${Object.values(ROLES).filter(r => r.id !== 'customer').map(role => `
        <div class="role-card" style="border-top: 3px solid ${role.color};">
          <div class="role-icon-box" style="background: ${role.bg}; color: ${role.color};">
            <span class="material-symbols-outlined">${role.icon}</span>
          </div>
          <div class="flex justify-between items-center" style="margin-bottom: 0.4rem;">
            <strong style="font-size: 0.95rem;">${role.name}</strong>
            <span class="role-badge-pill" style="background: ${role.bg}; color: ${role.color};">${role.badge}</span>
          </div>
          <p style="font-size: 0.78rem; color: var(--ink-secondary); line-height: 1.4; margin-bottom: 1rem; min-height: 40px;">
            ${role.desc}
          </p>
          <button class="btn btn-outline btn-sm" style="width: 100%; font-size: 0.75rem;" onclick="switchAdminRole('${role.id}')">
            Chuyển góc nhìn vai trò
          </button>
        </div>
      `).join('')}
    </div>

    <!-- Quick Recent Orders Snippet -->
    <div style="background: var(--surface); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm);">
      <div class="flex justify-between items-center" style="margin-bottom: 1rem;">
        <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0;">Đơn Hàng Gần Đây Cần Xử Lý</h3>
        <button class="btn btn-outline btn-sm" onclick="setAdminTab('orders')">Xem tất cả ${State.orders.length} đơn</button>
      </div>

      <table class="admin-table">
        <thead>
          <tr>
            <th>Mã Đơn</th>
            <th>Khách Hàng</th>
            <th>Số Điện Thoại</th>
            <th>Tổng Tiền</th>
            <th>Trạng Thái</th>
            <th>Thao Tác Theo Vai Trò</th>
          </tr>
        </thead>
        <tbody>
          ${State.orders.slice(0, 4).map(order => `
            <tr>
              <td><strong>#${order.code}</strong></td>
              <td>${order.customerName}</td>
              <td>${order.phoneNumber}</td>
              <td style="font-weight: 700; color: var(--primary);">${p.canViewFinancials ? vnd(order.totalAmount) : '••••••'}</td>
              <td><span class="status-badge ${order.status}">${getStatusLabel(order.status)}</span></td>
              <td>
                ${renderOrderActionButtons(order, p)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ---- TAB 2: ORDER MANAGEMENT ----
function renderAdminOrdersTab(p) {
  return `
    <div class="flex justify-between items-center" style="margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0 0 0.3rem;">Quản Lý Đơn Hàng & Vận Đơn</h2>
        <p style="color: var(--ink-secondary); font-size: 0.85rem; margin: 0;">Quy trình chốt đơn Telesale ➜ Đóng gói xuất kho ➜ Giao hàng hoàn tất</p>
      </div>
      <div style="font-size: 0.8rem; color: var(--ink-secondary);">
        Đang có <strong>${State.orders.length}</strong> đơn trong hệ thống
      </div>
    </div>

    <div style="background: var(--surface); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm); overflow-x: auto;">
      ${State.orders.length > 0 ? `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Mã Đơn</th>
              <th>Thời Gian</th>
              <th>Khách Hàng</th>
              <th>Số Điện Thoại</th>
              <th>Tổng Tiền</th>
              <th>Phương Thức</th>
              <th>Trạng Thái</th>
              <th>Cập Nhật Theo Quyền RBAC</th>
            </tr>
          </thead>
          <tbody>
            ${State.orders.map(order => `
              <tr>
                <td><strong>#${order.code}</strong></td>
                <td style="font-size: 0.8rem; color: var(--ink-tertiary);">${order.createdAt || 'Hôm nay'}</td>
                <td><strong>${order.customerName}</strong></td>
                <td>${order.phoneNumber}</td>
                <td style="font-weight: 700; color: var(--primary);">
                  ${p.canViewFinancials ? vnd(order.totalAmount) : '••••••'}
                </td>
                <td style="font-size: 0.8rem;">${order.paymentMethod}</td>
                <td><span class="status-badge ${order.status}">${getStatusLabel(order.status)}</span></td>
                <td>
                  ${renderOrderActionButtons(order, p)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : `
        <p style="text-align: center; color: var(--ink-tertiary); padding: 3rem 0;">Chưa có đơn hàng nào.</p>
      `}
    </div>
  `;
}

function renderOrderActionButtons(order, p) {
  // If super_admin: full select dropdown
  if (State.adminRole === 'super_admin') {
    return `
      <select class="staff-role-select" onchange="updateOrderStatus('${order.code}', this.value)">
        <option value="pending" ${order.status === "pending" ? "selected" : ""}>Chờ xác nhận</option>
        <option value="confirmed" ${order.status === "confirmed" ? "selected" : ""}>Đã xác nhận</option>
        <option value="shipping" ${order.status === "shipping" ? "selected" : ""}>Đang giao hàng</option>
        <option value="done" ${order.status === "done" ? "selected" : ""}>Hoàn tất</option>
        <option value="canceled" ${order.status === "canceled" ? "selected" : ""}>Đã hủy</option>
      </select>
    `;
  }

  // Telesale actions: confirm pending order
  if (State.adminRole === 'telesale') {
    if (order.status === 'pending') {
      return `
        <button class="btn btn-primary btn-sm" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="updateOrderStatus('${order.code}', 'confirmed')">
          <span class="material-symbols-outlined" style="font-size: 14px;">call</span> Gọi chốt đơn
        </button>
      `;
    }
    return `<span style="font-size: 0.75rem; color: var(--ink-tertiary);"><span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle;">done</span> Đã chốt</span>`;
  }

  // Warehouse actions: pack and ship confirmed order
  if (State.adminRole === 'warehouse') {
    if (order.status === 'confirmed') {
      return `
        <button class="btn btn-primary btn-sm" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; background: #059669; border-color: #059669;" onclick="updateOrderStatus('${order.code}', 'shipping')">
          <span class="material-symbols-outlined" style="font-size: 14px;">inventory_2</span> Xuất kho & Giao
        </button>
      `;
    } else if (order.status === 'shipping') {
      return `
        <button class="btn btn-outline btn-sm" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="updateOrderStatus('${order.code}', 'done')">
          <span class="material-symbols-outlined" style="font-size: 14px;">verified</span> Đã giao xong
        </button>
      `;
    }
    return `<span style="font-size: 0.75rem; color: var(--ink-tertiary);">Chỉ xem</span>`;
  }

  // Support / CSKH:
  return `<span style="font-size: 0.75rem; color: var(--ink-tertiary);">CSKH theo dõi</span>`;
}

// ---- TAB 3: STAFF & ROLE MANAGEMENT ----
function renderAdminStaffTab(p) {
  return `
    <div class="flex justify-between items-center" style="margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0 0 0.3rem;">Quản Lý Nhân Sự & Phân Vai Trò (RBAC)</h2>
        <p style="color: var(--ink-secondary); font-size: 0.85rem; margin: 0;">Chỉ định quyền hạn từng nhân viên theo mô hình phân quyền ma trận</p>
      </div>

      ${p.canManageRBAC ? `
        <button class="btn btn-primary btn-sm" onclick="openAddStaffModal()">
          <span class="material-symbols-outlined" style="font-size: 16px;">person_add</span> Thêm Nhân Sự Mới
        </button>
      ` : `
        <span style="font-size: 0.78rem; color: var(--ink-tertiary); background: var(--bg-subtle); padding: 0.3rem 0.7rem; border-radius: var(--radius-full);">
          🔒 Cần quyền Super Admin để thêm nhân viên
        </span>
      `}
    </div>

    <div style="background: var(--surface); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm); overflow-x: auto;">
      ${State.users.length > 0 ? `
        <table class="staff-table">
          <thead>
            <tr>
              <th>Nhân Sự</th>
              <th>Email</th>
              <th>Số Điện Thoại</th>
              <th>Vai Trò Phân Quyền</th>
              <th>Trạng Thái</th>
              <th>Ngày Tham Gia</th>
              <th>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            ${State.users.map(staff => {
              const role = ROLES[staff.role] || ROLES.telesale;
              return `
                <tr>
                  <td>
                    <div class="flex items-center gap-3">
                      <img src="${staff.avatar}" class="staff-avatar" alt="${staff.name}">
                      <div>
                        <strong style="font-size: 0.9rem; display: block;">${staff.name}</strong>
                        <span style="font-size: 0.72rem; color: var(--ink-tertiary);">ID: ${staff.id}</span>
                      </div>
                    </div>
                  </td>
                  <td style="font-size: 0.85rem;">${staff.email}</td>
                  <td style="font-size: 0.85rem;">${staff.phone}</td>
                  <td>
                    ${p.canManageRBAC ? `
                      <select class="staff-role-select" onchange="updateStaffRole('${staff.id}', this.value)" style="border-left: 3px solid ${role.color};">
                        <option value="super_admin" ${staff.role === 'super_admin' ? 'selected' : ''}>👑 Super Admin</option>
                        <option value="telesale" ${staff.role === 'telesale' ? 'selected' : ''}>📞 Telesale</option>
                        <option value="warehouse" ${staff.role === 'warehouse' ? 'selected' : ''}>📦 Thủ Kho</option>
                        <option value="support" ${staff.role === 'support' ? 'selected' : ''}>🎧 CSKH</option>
                        <option value="customer" ${staff.role === 'customer' ? 'selected' : ''}>👤 Khách hàng</option>
                      </select>
                    ` : `
                      <span class="role-badge-pill" style="background: ${role.bg}; color: ${role.color};">
                        ${role.name}
                      </span>
                    `}
                  </td>
                  <td>
                    <span class="role-badge-pill" style="background: ${staff.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}; color: ${staff.status === 'active' ? '#10b981' : '#ef4444'};">
                      ${staff.status === 'active' ? '● Hoạt động' : '✕ Tạm khóa'}
                    </span>
                  </td>
                  <td style="font-size: 0.8rem; color: var(--ink-tertiary);">${staff.createdAt || '01/10/2026'}</td>
                  <td>
                    ${p.canManageRBAC ? `
                      <div class="flex items-center gap-1">
                        <button class="btn btn-outline btn-sm" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="toggleStaffStatus('${staff.id}')" title="${staff.status === 'active' ? 'Tạm khóa' : 'Mở khóa'}">
                          ${staff.status === 'active' ? 'Khóa' : 'Mở'}
                        </button>
                        <button class="btn btn-outline btn-sm" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="deleteStaff('${staff.id}')" title="Xóa nhân sự">
                          <span class="material-symbols-outlined" style="font-size: 14px;">delete</span>
                        </button>
                      </div>
                    ` : `
                      <span style="font-size: 0.75rem; color: var(--ink-tertiary);">-</span>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : `
        <div style="text-align: center; padding: 3.5rem 1.5rem; color: var(--ink-secondary);">
          <div style="width: 58px; height: 58px; background: rgba(229, 37, 42, 0.08); border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; color: var(--primary); margin-bottom: 1rem;">
            <span class="material-symbols-outlined" style="font-size: 30px;">person_add</span>
          </div>
          <h4 style="font-size: 1.15rem; font-weight: 700; margin: 0 0 0.5rem; color: var(--ink-primary);">Danh sách nhân sự chưa có thành viên</h4>
          <p style="font-size: 0.85rem; max-width: 460px; margin: 0 auto 1.5rem; line-height: 1.5;">
            Hệ thống đang để trống danh sách để bạn tự thiết lập nhân viên theo nhu cầu thực tế. Hãy bấm nút bên dưới để tạo nhân sự và phân bổ vai trò RBAC đầu tiên!
          </p>
          <button class="btn btn-primary btn-sm" onclick="openAddStaffModal()">
            <span class="material-symbols-outlined" style="font-size: 16px;">person_add</span> Thêm Nhân Sự Mới
          </button>
        </div>
      `}
    </div>
  `;
}

// ---- TAB 4: RBAC PERMISSION MATRIX ----
function renderAdminRbacTab(p) {
  return `
    <div class="flex justify-between items-center" style="margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0 0 0.3rem;">Ma Trận Phân Quyền Vai Trò (RBAC 2.0)</h2>
        <p style="color: var(--ink-secondary); font-size: 0.85rem; margin: 0;">
          💡 Bấm trực tiếp vào từng ô để chuyển đổi: 
          <span class="perm-badge perm-allow" style="width:20px; height:20px; font-size:11px;">✓</span> Cho phép &nbsp;➜&nbsp;
          <span class="perm-badge perm-view" style="width:20px; height:20px; font-size:11px;">👁</span> Chỉ xem &nbsp;➜&nbsp;
          <span class="perm-badge perm-deny" style="width:20px; height:20px; font-size:11px;">✕</span> Chặn
        </p>
      </div>

      ${p.canManageRBAC ? `
        <button class="btn btn-outline btn-sm" onclick="resetRbacMatrix()">
          <span class="material-symbols-outlined" style="font-size: 16px;">restart_alt</span> Khôi Phục Mặc Định
        </button>
      ` : ''}
    </div>

    <div style="background: var(--surface); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm); overflow-x: auto;">
      <table class="matrix-table">
        <thead>
          <tr>
            <th style="width: 25%;">Danh Mục</th>
            <th style="width: 35%;">Tác Vụ & Quyền Hạn Hệ Thống</th>
            <th style="width: 10%;">👑 Super Admin</th>
            <th style="width: 10%;">📞 Telesale</th>
            <th style="width: 10%;">📦 Kho Vận</th>
            <th style="width: 10%;">🎧 CSKH & AI</th>
          </tr>
        </thead>
        <tbody>
          ${State.permissions.map((item, idx) => `
            <tr>
              <td>
                <span class="role-badge-pill" style="background: var(--bg-subtle); color: var(--ink-primary); font-size: 0.72rem;">
                  ${item.category}
                </span>
              </td>
              <td>
                <strong style="font-size: 0.85rem;">${item.task}</strong>
              </td>
              <td style="text-align: center;">
                <span class="perm-badge perm-allow" title="Super Admin toàn quyền">✓</span>
              </td>
              <td style="text-align: center;">
                ${renderPermCell(item.telesale, idx, 'telesale', p.canManageRBAC)}
              </td>
              <td style="text-align: center;">
                ${renderPermCell(item.warehouse, idx, 'warehouse', p.canManageRBAC)}
              </td>
              <td style="text-align: center;">
                ${renderPermCell(item.support, idx, 'support', p.canManageRBAC)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderPermCell(perm, catIdx, roleKey, canEdit) {
  const iconMap = {
    allow: "✓",
    view: "👁",
    deny: "✕"
  };
  const titleMap = {
    allow: "Cho phép thao tác (Bấm để đổi sang Chỉ xem)",
    view: "Chỉ xem thông tin (Bấm để đổi sang Chặn)",
    deny: "Bị chặn truy cập (Bấm để đổi sang Cho phép)"
  };
  return `
    <span class="perm-badge perm-${perm} ${canEdit ? 'clickable' : ''}" 
          title="${titleMap[perm] || perm}"
          ${canEdit ? `onclick="cycleMatrixPerm(${catIdx}, '${roleKey}')"` : ''}>
      ${iconMap[perm] || "✕"}
    </span>
  `;
}

// ---- TAB 5: AUDIT LOGS & SECURITY ----
function renderAdminAuditTab(p) {
  return `
    <div class="flex justify-between items-center" style="margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0 0 0.3rem;">Nhật Ký Kiểm Toán An Ninh (Audit Trail)</h2>
        <p style="color: var(--ink-secondary); font-size: 0.85rem; margin: 0;">Ghi nhận mọi thao tác phân quyền, duyệt đơn, thay đổi cấu hình theo thời gian thực</p>
      </div>

      <div class="flex items-center gap-2">
        <span class="audit-log-badge success">● Mã hóa TLS 1.3</span>
        <span class="audit-log-badge info">Zero-Trust RBAC</span>
      </div>
    </div>

    <div style="background: var(--surface); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm); overflow-x: auto;">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Thời Gian</th>
            <th>Nhân Sự Thực Hiện</th>
            <th>Hành Vi / Sự Kiện Hệ Thống</th>
            <th>Địa Chỉ IP</th>
            <th>Trạng Thái</th>
          </tr>
        </thead>
        <tbody>
          ${State.auditLogs.map(log => `
            <tr>
              <td style="font-size: 0.8rem; color: var(--ink-secondary); white-space: nowrap;">${log.time}</td>
              <td><strong>${log.user}</strong></td>
              <td>${log.action}</td>
              <td><code style="font-size: 0.78rem; background: var(--bg-subtle); padding: 0.2rem 0.4rem; border-radius: 4px;">${log.ip}</code></td>
              <td>
                <span class="audit-log-badge ${log.status}">
                  ${log.status === 'success' ? '✓ Thành công' : log.status === 'info' ? 'ℹ Ghi nhận' : '⚠ Cảnh báo'}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ----------------------------------------------------
// RBAC INTERACTION CONTROLLERS (GLOBAL SCOPE)
// ----------------------------------------------------
window.switchAdminRole = function(newRole) {
  State.adminRole = newRole;
  localStorage.setItem("nexus_admin_role", newRole);
  const roleInfo = ROLES[newRole] || { name: newRole };
  showToast(`Đã chuyển sang vai trò: ${roleInfo.name}`, 'shield');
  addAuditLog(`Chuyển giả lập vai trò sang ${roleInfo.name}`);
  renderApp();
};

window.setAdminTab = function(tabName) {
  State.adminTab = tabName;
  renderApp();
};

window.setPriceMode = function(mode) {
  if (!hasPermission("Thay đổi chế độ giá bán (Flash Sale Camp / Daily)")) {
    showToast("⚠️ Bạn không có quyền đổi chế độ giá bán!", "lock");
    return;
  }
  State.priceMode = mode;
  localStorage.setItem("nexus_price_mode", mode);
  showToast(`Đã chuyển sang: ${mode === "daily" ? "Giá hằng ngày" : "Giá Flash Sale"}`);
  addAuditLog(`Chuyển chế độ giá bán sang ${mode === "daily" ? "Giá hằng ngày" : "Flash Sale Camp"}`);
  renderApp();
};

window.updateOrderStatus = function(orderCode, newStatus) {
  const order = State.orders.find(o => o.code === orderCode);
  if (order) {
    const oldStatus = order.status;
    order.status = newStatus;
    saveState("nexus_orders", State.orders);
    showToast(`Đã cập nhật đơn #${orderCode} sang "${getStatusLabel(newStatus)}"`);
    addAuditLog(`Cập nhật đơn hàng #${orderCode} từ "${getStatusLabel(oldStatus)}" sang "${getStatusLabel(newStatus)}"`);
    renderApp();
  }
};

window.updateStaffRole = function(staffId, newRole) {
  if (!hasPermission("Tạo nhân sự mới, gán vai trò & phân quyền RBAC")) {
    showToast("⚠️ Bạn không có quyền phân bổ vai trò!", "lock");
    return;
  }
  const staff = State.users.find(u => u.id === staffId);
  if (staff) {
    const oldRole = staff.role;
    staff.role = newRole;
    saveState("nexus_staff_users", State.users);
    const roleName = ROLES[newRole]?.name || newRole;
    showToast(`Đã đổi vai trò của ${staff.name} sang "${roleName}"`, "manage_accounts");
    addAuditLog(`Đổi vai trò của nhân sự ${staff.name} từ ${oldRole} thành ${newRole}`);
    renderApp();
  }
};

window.toggleStaffStatus = function(staffId) {
  if (!hasPermission("Tạo nhân sự mới, gán vai trò & phân quyền RBAC")) {
    showToast("⚠️ Bạn không có quyền khóa tài khoản nhân sự!", "lock");
    return;
  }
  const staff = State.users.find(u => u.id === staffId);
  if (staff) {
    if (staff.role === 'super_admin' && staff.id === 'usr-1') {
      showToast("⚠️ Không thể khóa tài khoản Tổng Quản Trị hệ thống!", "error");
      return;
    }
    staff.status = staff.status === 'active' ? 'blocked' : 'active';
    saveState("nexus_staff_users", State.users);
    showToast(`Đã ${staff.status === 'active' ? 'mở khóa' : 'tạm khóa'} tài khoản ${staff.name}`);
    addAuditLog(`${staff.status === 'active' ? 'Mở khóa' : 'Tạm khóa'} tài khoản nhân viên ${staff.name}`);
    renderApp();
  }
};

window.deleteStaff = function(staffId) {
  if (!hasPermission("Tạo nhân sự mới, gán vai trò & phân quyền RBAC")) {
    showToast("⚠️ Bạn không có quyền xóa nhân sự!", "lock");
    return;
  }
  const staff = State.users.find(u => u.id === staffId);
  if (!staff) return;
  if (!confirm(`Bạn có chắc muốn xóa nhân sự "${staff.name}" (${staff.email}) khỏi hệ thống?`)) return;
  
  State.users = State.users.filter(u => u.id !== staffId);
  saveState("nexus_staff_users", State.users);
  showToast(`Đã xóa nhân sự: ${staff.name}`, "delete");
  addAuditLog(`Xóa nhân sự ${staff.name} (${staff.email}) khỏi hệ thống`);
  renderApp();
};

window.cycleMatrixPerm = function(categoryIndex, roleKey) {
  if (!hasPermission("Tạo nhân sự mới, gán vai trò & phân quyền RBAC")) {
    showToast("⚠️ Chỉ Super Admin mới có quyền điều chỉnh ma trận RBAC!", "lock");
    return;
  }
  if (roleKey === 'super_admin') {
    showToast("ℹ️ Super Admin luôn luôn giữ toàn quyền (allow)", "info");
    return;
  }
  const item = State.permissions[categoryIndex];
  if (!item) return;

  const current = item[roleKey] || 'deny';
  const cycle = {
    'allow': 'view',
    'view': 'deny',
    'deny': 'allow'
  };
  const next = cycle[current] || 'allow';
  item[roleKey] = next;
  saveState("nexus_permissions", State.permissions);
  addAuditLog(`Thay đổi quyền tác vụ "${item.task}" cho vai trò ${roleKey} sang [${next.toUpperCase()}]`);
  renderApp();
};

window.resetRbacMatrix = function() {
  if (!hasPermission("Tạo nhân sự mới, gán vai trò & phân quyền RBAC")) {
    showToast("⚠️ Bạn không có quyền khôi phục ma trận RBAC!", "lock");
    return;
  }
  State.permissions = JSON.parse(JSON.stringify(PERMISSION_MATRIX));
  saveState("nexus_permissions", State.permissions);
  showToast("Đã khôi phục ma trận phân quyền RBAC về mặc định!", "restart_alt");
  addAuditLog("Khôi phục ma trận phân quyền RBAC về mặc định");
  renderApp();
};

window.openAddStaffModal = function() {
  if (!hasPermission("Tạo nhân sự mới, gán vai trò & phân quyền RBAC")) {
    showToast("⚠️ Bạn cần quyền Super Admin để thêm nhân sự!", "lock");
    return;
  }
  const overlay = document.getElementById("addStaffModalOverlay");
  if (overlay) {
    overlay.style.display = "flex";
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      overlay.classList.add("active");
    });
    document.body.style.overflow = "hidden";
  }
};

window.closeAddStaffModal = function() {
  const overlay = document.getElementById("addStaffModalOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.style.opacity = "0";
    setTimeout(() => { overlay.style.display = "none"; }, 300);
    document.body.style.overflow = "";
    document.getElementById("addStaffForm")?.reset();
  }
};

window.handleAddStaffOverlayClick = function(e) {
  if (e.target === document.getElementById("addStaffModalOverlay")) {
    closeAddStaffModal();
  }
};

window.handleCreateStaff = function(e) {
  e.preventDefault();
  const name = document.getElementById("staffFullName")?.value.trim();
  const email = document.getElementById("staffEmail")?.value.trim();
  const phone = document.getElementById("staffPhone")?.value.trim();
  const password = document.getElementById("staffPassword")?.value;
  const role = document.getElementById("staffRoleSelect")?.value || "telesale";

  if (!name || !email || !password) {
    showToast("Vui lòng nhập đầy đủ thông tin bắt buộc!", "error");
    return;
  }

  if (State.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    showToast("Email này đã được sử dụng cho nhân sự khác!", "error");
    return;
  }

  const newStaff = {
    id: "usr-" + Date.now().toString().slice(-4),
    name,
    email,
    phone: phone || "090" + Math.floor(Math.random() * 8999999 + 1000000),
    password,
    role,
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: new Date().toLocaleDateString("vi-VN")
  };

  State.users.unshift(newStaff);
  saveState("nexus_staff_users", State.users);
  closeAddStaffModal();
  showToast(`Đã tạo nhân sự mới: ${name} (${ROLES[role]?.name || role})!`, "person_add");
  addAuditLog(`Thêm nhân sự mới ${name} (${email}) với vai trò ${ROLES[role]?.name || role}`);
  renderApp();
};

window.handleAdminLogout = function() {
  State.adminLoggedIn = false;
  localStorage.removeItem("nexus_admin_logged_in");
  showToast("Đã đăng xuất khỏi cổng Quản trị viên");
  addAuditLog("Đăng xuất khỏi phiên quản trị");
  navigate("home");
};

function attachAdminEvents() {}

// ----------------------------------------------------
// VIEW: SUPPORT & FAQS
// ----------------------------------------------------
function renderSupportHTML() {
  return `
    <div class="container" style="padding-top: 1.5rem; padding-bottom: 4rem; max-width: 860px;">
      <div class="section-head">
        <span class="section-tag">Trung Tâm Hỗ Trợ 24/7</span>
        <h1 class="section-title">Câu Hỏi Thường Gặp & Chính Sách</h1>
        <p class="section-desc">Mọi thông tin về chính sách bảo hành 1 đổi 1, giao hàng và cam kết chính hãng Magic.</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 3rem;">
        ${FAQS.map((faq, i) => `
          <div class="glass-card" style="padding: 1.5rem; cursor: pointer;" onclick="toggleFaq(${i})">
            <div class="flex justify-between items-center">
              <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--ink-primary);">${faq.q}</h3>
              <span class="material-symbols-outlined" id="faqIcon-${i}">expand_more</span>
            </div>
            <div id="faqAns-${i}" style="display: none; margin-top: 0.75rem; color: var(--ink-secondary); font-size: 0.925rem; line-height: 1.6; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
              ${faq.a}
            </div>
          </div>
        `).join("")}
      </div>

      <!-- Contact Banner -->
      <div style="background: linear-gradient(135deg, var(--surface), var(--bg-subtle)); border: 1px solid var(--border-glass); border-radius: var(--radius-xl); padding: 2.5rem; text-align: center; box-shadow: var(--shadow-md);">
        <h3 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem;">Cần Tư Vấn Trực Tiếp?</h3>
        <p style="color: var(--ink-secondary); margin-bottom: 1.5rem;">Đội ngũ chuyên viên Nexus luôn sẵn sàng giải đáp và xử lý đơn hàng nhanh chóng.</p>
        <div class="flex gap-3 justify-center" style="flex-wrap: wrap;">
          <a href="tel:${CONFIG.HOTLINE}" class="btn btn-primary">
            <span class="material-symbols-outlined">call</span> Gọi Hotline: ${CONFIG.HOTLINE_DISPLAY}
          </a>
          <button class="btn btn-outline" onclick="openChatAdvisor()">
            <span class="material-symbols-outlined">chat</span> Tư vấn với Nexus
          </button>
        </div>
      </div>
    </div>
  `;
}

window.toggleFaq = function(index) {
  const ans = document.getElementById(`faqAns-${index}`);
  const icon = document.getElementById(`faqIcon-${index}`);
  if (ans && icon) {
    const isHidden = ans.style.display === "none";
    ans.style.display = isHidden ? "block" : "none";
    icon.textContent = isHidden ? "expand_less" : "expand_more";
  }
};

function attachSupportEvents() {}

// ----------------------------------------------------
// CART FLYOUT DRAWER LOGIC
// ----------------------------------------------------
function openCartFlyout() {
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("cartDrawerOverlay");
  if (drawer && overlay) {
    drawer.classList.add("open");
    overlay.classList.add("active");
    renderCartFlyoutContent();
  }
}

function closeCartFlyout() {
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("cartDrawerOverlay");
  if (drawer && overlay) {
    drawer.classList.remove("open");
    overlay.classList.remove("active");
  }
}

function renderCartFlyoutContent() {
  const body = document.getElementById("cartDrawerBody");
  const foot = document.getElementById("cartDrawerFoot");
  if (!body || !foot) return;

  const totals = getCartTotals();

  if (State.cart.length === 0) {
    body.innerHTML = `
      <div class="text-center" style="padding: 3rem 1rem;">
        <span class="material-symbols-outlined" style="font-size: 48px; color: var(--ink-tertiary);">shopping_bag</span>
        <p style="color: var(--ink-secondary); margin-top: 1rem;">Giỏ hàng của bạn đang trống</p>
      </div>
    `;
    foot.innerHTML = `
      <button class="btn btn-primary" style="width: 100%;" onclick="closeCartFlyout(); navigate('store');">
        Mua sắm ngay
      </button>
    `;
    return;
  }

  body.innerHTML = State.cart.map((item, index) => {
    const p = PRODUCTS.find(prod => prod.id === item.id);
    if (!p) return "";
    const price = getProductPrice(p);
    return `
      <div class="cart-item">
        <img src="${p.cardImg}" alt="${p.shortName}" class="cart-item-img">
        <div class="cart-item-info">
          <h4>${p.shortName}</h4>
          <div class="cart-item-variant">${item.color}</div>
          <div class="cart-item-price">${vnd(price)}</div>
        </div>
        <div class="flex items-center gap-2">
          <div class="qty-control">
            <button class="qty-btn" onclick="updateCartQty(${index}, -1)">-</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" onclick="updateCartQty(${index}, 1)">+</button>
          </div>
          <button style="border:none; background:none; cursor:pointer; color:var(--ink-tertiary);" onclick="removeCartItem(${index})">
            <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
          </button>
        </div>
      </div>
    `;
  }).join("");

  foot.innerHTML = `
    <div class="flex justify-between items-baseline" style="margin-bottom: 1rem;">
      <span style="font-weight: 600; color: var(--ink-secondary);">Tổng cộng:</span>
      <span style="font-size: 1.4rem; font-weight: 800; color: var(--primary);">${vnd(totals.total)}</span>
    </div>
    <div class="flex gap-2">
      <button class="btn btn-outline" style="flex: 1;" onclick="closeCartFlyout(); navigate('cart');">
        Xem giỏ hàng
      </button>
      <button class="btn btn-primary" style="flex: 1.2;" onclick="closeCartFlyout(); navigate('checkout');">
        Thanh toán
      </button>
    </div>
  `;
}

// ----------------------------------------------------
// NEXUS AI SHOPPING ADVISOR CHAT ENGINE
// ----------------------------------------------------
function toggleChatAdvisor() {
  State.chatOpen = !State.chatOpen;
  const modal = document.getElementById("chatModal");
  if (modal) {
    if (State.chatOpen) {
      modal.classList.add("open");
      renderChatMessages();
      const input = document.getElementById("chatMsgInput");
      if (input) input.focus();
    } else {
      modal.classList.remove("open");
    }
  }
}

function openChatAdvisor() {
  State.chatOpen = true;
  const modal = document.getElementById("chatModal");
  if (modal) {
    modal.classList.add("open");
    renderChatMessages();
    const input = document.getElementById("chatMsgInput");
    if (input) input.focus();
  }
}

function renderChatMessages() {
  const container = document.getElementById("chatMessagesContainer");
  if (!container) return;

  container.innerHTML = State.chatMessages.map(msg => {
    let cardsHTML = "";
    if (msg.productIds && msg.productIds.length > 0) {
      cardsHTML = msg.productIds.map(pid => {
        const p = PRODUCTS.find(prod => prod.id === pid);
        if (!p) return "";
        return `
          <div class="chat-product-card">
            <img src="${p.cardImg}" alt="${p.shortName}">
            <div style="flex: 1; min-width: 0;">
              <strong style="font-size: 0.85rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</strong>
              <div style="font-weight: 700; color: var(--primary); font-size: 0.8rem;">${vnd(getProductPrice(p))}</div>
            </div>
            <div class="flex gap-1">
              <button class="btn btn-outline btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" 
                      onclick="navigate('product', '${p.id}'); toggleChatAdvisor();">Xem</button>
              <button class="btn btn-primary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" 
                      onclick="addToCart('${p.id}');">Mua</button>
            </div>
          </div>
        `;
      }).join("");
    }

    return `
      <div class="chat-bubble ${msg.role}">
        <div>${msg.text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</div>
        ${cardsHTML}
      </div>
    `;
  }).join("");

  container.scrollTop = container.scrollHeight;
}

function sendChatMessage(text) {
  if (!text.trim()) return;

  State.chatMessages.push({ role: "user", text: text.trim() });
  renderChatMessages();

  // Smart AI Response Logic
  setTimeout(() => {
    const reply = generateAiReply(text.trim());
    State.chatMessages.push(reply);
    renderChatMessages();
  }, 600);
}

function generateAiReply(userPrompt) {
  const q = userPrompt.toLowerCase();

  if (q.includes("bình") || q.includes("giữ nhiệt") || q.includes("uống nước") || q.includes("nóng") || q.includes("lạnh")) {
    if (q.includes("to") || q.includes("lớn") || q.includes("1.2") || q.includes("tập gym")) {
      return {
        role: "assistant",
        text: "Dạ nếu bạn cần dung tích cực lớn cho cả ngày làm việc hoặc đi tập thể thao, mẫu **Bình Magic MC1200 (1.200ml)** có quai xách và kèm ống hút tiện lợi là sự lựa chọn hoàn hảo nhất! Lòng bình đúc inox 316 giữ nhiệt tới 24 tiếng.",
        productIds: ["mc1200"]
      };
    }
    if (q.includes("rẻ") || q.includes("tiết kiệm") || q.includes("570")) {
      return {
        role: "assistant",
        text: "Mẫu **Magic MC570 (570ml)** hiện đang có giá ưu đãi tốt nhất chỉ 309.000đ với 4 màu pastel cực xinh và lòng inox 316 y tế an toàn tuyệt đối.",
        productIds: ["mc570"]
      };
    }
    return {
      role: "assistant",
      text: "Nexus có trọn bộ bình giữ nhiệt Inox 316 cao cấp từ 480ml đến 1.200ml: MC500 nhỏ gọn, MC570 giá tốt nhất, MC650 có ống hút, MC870 nắp bật và MC1200 đại dung tích. Bạn ưng ý dung tích nào nhất ạ?",
      productIds: ["mc570", "mc1200", "mc650"]
    };
  }

  if (q.includes("tăm nước") || q.includes("răng") || q.includes("b02")) {
    return {
      role: "assistant",
      text: "Tăm nước **Magic B-02PRO** đang là sản phẩm bán chạy số 1 tại Nexus với giá chỉ 369.000đ (giá niêm yết 990.000đ). Máy có áp lực 120 PSI, 1.400 nhịp/phút, tặng kèm 4 đầu tăm chuyên dụng, pin 20 ngày và gấp gọn bỏ túi cực tiện!",
      productIds: ["b02pro"]
    };
  }

  if (q.includes("bàn chải") || q.includes("b26") || q.includes("đánh răng")) {
    return {
      role: "assistant",
      text: "Bàn chải điện **Magic B-26** dùng công nghệ sóng âm Sonic rung 40.000 lần/phút, có 5 chế độ chải răng và tính năng dừng 30 giây nhắc chuyển góc hàm. Có 3 màu Tím, Trắng, Xanh rất xinh xắn.",
      productIds: ["b26"]
    };
  }

  if (q.includes("quạt") || q.includes("làm mát") || q.includes("mát") || q.includes("a014") || q.includes("a028")) {
    return {
      role: "assistant",
      text: "Nexus có 2 dòng quạt Magic siêu hot: Quạt cầm tay **A-014** có phiến bán dẫn Peltier làm mát buốt sau 3-5 giây, và Quạt để bàn xoay 360° **A-028** pin 3.600mAh mát cả khi cúp điện.",
      productIds: ["a014", "a028"]
    };
  }

  if (q.includes("bảo hành") || q.includes("đổi trả") || q.includes("ship") || q.includes("giao hàng")) {
    return {
      role: "assistant",
      text: "100% sản phẩm tại Nexus được bảo hành chính hãng **12 tháng và 1 đổi 1 trong 30 ngày** nếu có lỗi nhà sản xuất. Miễn phí vận chuyển cho đơn hàng từ 500.000đ toàn quốc. Giao nhanh 24h ở HCM & Hà Nội ạ!"
    };
  }

  return {
    role: "assistant",
    text: "Trợ lý Nexus luôn sẵn sàng tư vấn chi tiết thông số, so sánh hoặc áp mã ưu đãi giảm giá tốt nhất cho bạn. Bạn có thể tham khảo 2 dòng sản phẩm nổi bật nhất hôm nay nhé:",
    productIds: ["b02pro", "mc1200"]
  };
}

// ----------------------------------------------------
// WRITE REVIEW MODAL DIALOG
// ----------------------------------------------------
let reviewProdId = "b02pro";
let reviewSelectedRating = 5;

function openReviewDialog(prodId) {
  reviewProdId = prodId;
  const p = PRODUCTS.find(item => item.id === prodId);
  const titleEl = document.getElementById("reviewModalProdTitle");
  if (titleEl && p) titleEl.textContent = `Sản phẩm: ${p.name}`;

  const overlay = document.getElementById("reviewModalOverlay");
  if (overlay) overlay.classList.add("active");
}

function closeReviewDialog() {
  const overlay = document.getElementById("reviewModalOverlay");
  if (overlay) overlay.classList.remove("active");
}

window.setReviewRating = function(star) {
  reviewSelectedRating = star;
  for (let i = 1; i <= 5; i++) {
    const s = document.getElementById(`starBtn-${i}`);
    if (s) {
      s.style.color = i <= star ? "#f59e0b" : "var(--ink-tertiary)";
    }
  }
};

window.handleReviewSubmit = function(e) {
  e.preventDefault();
  const name = document.getElementById("reviewAuthorName").value.trim();
  const title = document.getElementById("reviewTitle").value.trim();
  const content = document.getElementById("reviewContent").value.trim();

  if (!name || !content) return;

  const newReview = {
    id: "rv-" + Date.now(),
    prodId: reviewProdId,
    name: name,
    rating: reviewSelectedRating,
    date: new Date().toLocaleDateString("vi-VN"),
    color: "Chính hãng",
    title: title || "Đánh giá chất lượng sản phẩm",
    content: content,
    verified: true
  };

  State.reviews.unshift(newReview);
  saveState("nexus_reviews", State.reviews);
  closeReviewDialog();
  showToast("Cảm ơn bạn đã gửi đánh giá!", "thumb_up");
  renderApp();
};

// ----------------------------------------------------
// SEARCH FLYOUT MODAL
// ----------------------------------------------------
function openSearchFlyout() {
  const overlay = document.getElementById("searchModalOverlay");
  if (overlay) {
    overlay.classList.add("active");
    const input = document.getElementById("globalSearchInput");
    if (input) {
      input.value = "";
      input.focus();
      renderSearchSuggestions("");
    }
  }
}

function closeSearchFlyout() {
  const overlay = document.getElementById("searchModalOverlay");
  if (overlay) overlay.classList.remove("active");
}

function renderSearchSuggestions(query) {
  const container = document.getElementById("searchSuggestionsContainer");
  if (!container) return;

  const q = query.trim().toLowerCase();
  const results = q ? PRODUCTS.filter(p => p.name.toLowerCase().includes(q) || p.shortName.toLowerCase().includes(q)) : PRODUCTS.slice(0, 4);

  container.innerHTML = `
    <div style="font-size: 0.8rem; font-weight: 700; color: var(--ink-tertiary); text-transform: uppercase; margin-bottom: 0.75rem;">
      ${q ? `Kết quả tìm kiếm (${results.length})` : "Gợi ý nổi bật"}
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      ${results.map(p => `
        <div class="flex items-center gap-3" style="padding: 0.6rem; border-radius: var(--radius-md); cursor: pointer; transition: background 0.2s;" 
             onclick="navigate('product', '${p.id}'); closeSearchFlyout();"
             onmouseover="this.style.background='var(--surface-dim)'" onmouseout="this.style.background='transparent'">
          <img src="${p.cardImg}" alt="${p.shortName}" style="width: 44px; height: 44px; border-radius: var(--radius-sm); object-fit: cover;">
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 0.9rem;">${p.name}</div>
            <div style="font-size: 0.775rem; color: var(--ink-secondary);">${p.tagline}</div>
          </div>
          <div style="font-weight: 800; color: var(--primary); font-size: 0.9rem;">
            ${vnd(getProductPrice(p))}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Set theme attribute
  document.documentElement.setAttribute("data-theme", State.theme);
  updateThemeIcon();

  // Initialize countdown
  startCountdown();

  // Update Cart badge
  updateCartBadge();

  // Attach Router
  initRouter();

  // Chat Form Submit
  const chatForm = document.getElementById("chatMsgForm");
  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("chatMsgInput");
      if (input && input.value) {
        sendChatMessage(input.value);
        input.value = "";
      }
    });
  }

  // Global Search Input
  const globalSearchInput = document.getElementById("globalSearchInput");
  if (globalSearchInput) {
    globalSearchInput.addEventListener("input", (e) => {
      renderSearchSuggestions(e.target.value);
    });
  }
});

// =======================================================================
// AUTH SYSTEM — Đăng nhập / Đăng ký / CAPTCHA / Admin Login
// =======================================================================

// ---- CAPTCHA Engine ----
const CaptchaStore = { login: '', register: '', admin: '' };

function generateCaptchaText(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function drawCaptcha(canvasId, type) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const text = generateCaptchaText(6);
  CaptchaStore[type] = text;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(1, '#16213e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Noise dots
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`;
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Noise lines
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.1 + 0.04})`;
    ctx.lineWidth = Math.random() * 1.5 + 0.5;
    ctx.beginPath();
    ctx.moveTo(Math.random() * W, Math.random() * H);
    ctx.bezierCurveTo(
      Math.random() * W, Math.random() * H,
      Math.random() * W, Math.random() * H,
      Math.random() * W, Math.random() * H
    );
    ctx.stroke();
  }

  // Draw characters with varied style
  const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#e5252a', '#f8f9fa'];
  const fonts = ['italic bold', 'bold', 'italic', 'bold'];
  for (let i = 0; i < text.length; i++) {
    ctx.save();
    ctx.font = `${fonts[i % fonts.length]} ${Math.floor(Math.random() * 6 + 22)}px "Courier New", monospace`;
    ctx.fillStyle = colors[i % colors.length];
    ctx.shadowColor = colors[i % colors.length];
    ctx.shadowBlur = 6;
    const x = 10 + i * 18;
    const y = H / 2 + Math.random() * 10 - 5;
    ctx.translate(x, y);
    ctx.rotate((Math.random() - 0.5) * 0.5);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }
}

window.refreshCaptcha = function(type) {
  const ids = {
    login: 'loginCaptchaCanvas',
    register: 'registerCaptchaCanvas',
    admin: 'adminCaptchaCanvas'
  };
  const inputIds = {
    login: 'loginCaptchaInput',
    register: 'registerCaptchaInput',
    admin: 'adminCaptchaInput'
  };
  drawCaptcha(ids[type], type);
  const inp = document.getElementById(inputIds[type]);
  if (inp) { inp.value = ''; }
  const errEl = document.getElementById(`${type}CaptchaError`);
  if (errEl) errEl.style.display = 'none';
};

function verifyCaptcha(type, inputId, errorId) {
  const input = document.getElementById(inputId);
  const errEl = document.getElementById(errorId);
  if (!input) return false;
  const entered = input.value.trim().toUpperCase();
  if (entered !== CaptchaStore[type]) {
    if (errEl) errEl.style.display = 'block';
    refreshCaptcha(type);
    input.focus();
    return false;
  }
  if (errEl) errEl.style.display = 'none';
  return true;
}

// ---- Open / Close Auth Modal ----
window.openAuthModal = function(tab = 'login') {
  const overlay = document.getElementById('authOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    overlay.classList.add('active');
  });
  switchAuthTab(tab);
  // Draw CAPTCHAs
  setTimeout(() => {
    drawCaptcha('loginCaptchaCanvas', 'login');
    drawCaptcha('registerCaptchaCanvas', 'register');
  }, 50);
  document.body.style.overflow = 'hidden';
};

window.closeAuthModal = function() {
  const overlay = document.getElementById('authOverlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.style.opacity = '0';
  setTimeout(() => { overlay.style.display = 'none'; }, 300);
  document.body.style.overflow = '';
  // Clear error states
  document.getElementById('loginErrorMsg')?.classList.remove('show');
  document.getElementById('registerErrorMsg')?.classList.remove('show');
};

window.handleAuthOverlayClick = function(e) {
  if (e.target === document.getElementById('authOverlay')) {
    closeAuthModal();
  }
};

window.switchAuthTab = function(tab) {
  const loginBtn = document.getElementById('tabLoginBtn');
  const regBtn = document.getElementById('tabRegisterBtn');
  const loginPanel = document.getElementById('panelLogin');
  const regPanel = document.getElementById('panelRegister');
  if (!loginBtn) return;
  if (tab === 'login') {
    loginBtn.classList.add('active');
    regBtn.classList.remove('active');
    loginPanel.classList.add('active');
    regPanel.classList.remove('active');
  } else {
    regBtn.classList.add('active');
    loginBtn.classList.remove('active');
    regPanel.classList.add('active');
    loginPanel.classList.remove('active');
  }
};

// ---- Password Toggle ----
window.togglePwVisibility = function(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const icon = btn.querySelector('.material-symbols-outlined');
  if (inp.type === 'password') {
    inp.type = 'text';
    if (icon) icon.textContent = 'visibility_off';
  } else {
    inp.type = 'password';
    if (icon) icon.textContent = 'visibility';
  }
};

window.toggleAdminPwVisibility = function(btn) {
  const inp = document.getElementById('adminPassword');
  if (!inp) return;
  const icon = btn.querySelector('.material-symbols-outlined');
  if (inp.type === 'password') {
    inp.type = 'text';
    if (icon) icon.textContent = 'visibility_off';
  } else {
    inp.type = 'password';
    if (icon) icon.textContent = 'visibility';
  }
};

// ---- Forgot Password ----
window.showForgotPw = function(e) {
  e.preventDefault();
  showToast('📧 Vui lòng liên hệ hotline 0787 712 566 để được hỗ trợ đặt lại mật khẩu.', 'info');
};

// ---- Login Handler ----
window.handleLogin = function(e) {
  e.preventDefault();
  const emailEl = document.getElementById('loginEmail');
  const pwEl = document.getElementById('loginPassword');
  const errMsg = document.getElementById('loginErrorMsg');
  const errTxt = document.getElementById('loginErrorText');

  const email = emailEl?.value.trim();
  const pw = pwEl?.value;

  // Basic validation
  if (!email || !pw) {
    errTxt.textContent = 'Vui lòng nhập đầy đủ email và mật khẩu.';
    errMsg.classList.add('show');
    return;
  }

  // CAPTCHA check
  if (!verifyCaptcha('login', 'loginCaptchaInput', 'loginCaptchaError')) return;

  // Look up account in localStorage users store
  const users = JSON.parse(localStorage.getItem('nexus_users') || '[]');
  const found = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === pw);
  if (!found) {
    errTxt.textContent = 'Email hoặc mật khẩu không đúng.';
    errMsg.classList.add('show');
    document.getElementById('loginErrorMsg').classList.add('shake');
    setTimeout(() => document.getElementById('loginErrorMsg')?.classList.remove('shake'), 500);
    refreshCaptcha('login');
    return;
  }

  // Success
  errMsg.classList.remove('show');
  State.user = { name: found.name, email: found.email, phone: found.phone, role: 'customer' };
  saveState('nexus_user', State.user);
  closeAuthModal();
  updateNavUserState();
  showToast(`👋 Chào mừng trở lại, ${found.name}!`, 'check_circle');
  navigate('account');
};

// ---- Register Handler ----
window.handleRegister = function(e) {
  e.preventDefault();
  const name = document.getElementById('regName')?.value.trim();
  const email = document.getElementById('regEmail')?.value.trim();
  const phone = document.getElementById('regPhone')?.value.trim();
  const pw = document.getElementById('regPassword')?.value;
  const pwConfirm = document.getElementById('regPasswordConfirm')?.value;
  const terms = document.getElementById('regTerms')?.checked;
  const errMsg = document.getElementById('registerErrorMsg');
  const errTxt = document.getElementById('registerErrorText');

  // Validation
  if (!name || !email || !phone || !pw) {
    errTxt.textContent = 'Vui lòng điền đầy đủ tất cả thông tin.';
    errMsg.classList.add('show'); return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errTxt.textContent = 'Email không đúng định dạng.';
    errMsg.classList.add('show'); return;
  }
  if (!/^0\d{9}$/.test(phone)) {
    errTxt.textContent = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.';
    errMsg.classList.add('show'); return;
  }
  if (pw.length < 6) {
    errTxt.textContent = 'Mật khẩu phải có ít nhất 6 ký tự.';
    errMsg.classList.add('show'); return;
  }
  if (pw !== pwConfirm) {
    errTxt.textContent = 'Mật khẩu xác nhận không khớp.';
    errMsg.classList.add('show'); return;
  }
  if (!terms) {
    errTxt.textContent = 'Bạn cần đồng ý với điều khoản sử dụng.';
    errMsg.classList.add('show'); return;
  }

  // CAPTCHA check
  if (!verifyCaptcha('register', 'registerCaptchaInput', 'registerCaptchaError')) return;

  // Check duplicate email
  const users = JSON.parse(localStorage.getItem('nexus_users') || '[]');
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    errTxt.textContent = 'Email này đã được dùng để đăng ký. Hãy đăng nhập.';
    errMsg.classList.add('show'); return;
  }

  // Save new user
  const newUser = { name, email, phone, password: pw, role: 'customer', createdAt: new Date().toLocaleDateString('vi-VN') };
  users.push(newUser);
  localStorage.setItem('nexus_users', JSON.stringify(users));

  // Auto login
  errMsg.classList.remove('show');
  State.user = { name, email, phone, role: 'customer' };
  saveState('nexus_user', State.user);
  closeAuthModal();
  updateNavUserState();
  showToast(`🎉 Tạo tài khoản thành công! Chào ${name}!`, 'celebration');
  navigate('account');
};

// ---- Nav Account Handler ----
window.handleNavAccountClick = function() {
  if (State.user) {
    navigate('account');
  } else {
    openAuthModal('login');
  }
};

// ---- Update Nav User State ----
function updateNavUserState() {
  const btn = document.getElementById('navAccountBtn');
  if (!btn) return;
  if (State.user) {
    const initial = State.user.name ? State.user.name[0].toUpperCase() : '?';
    btn.innerHTML = `
      <span class="gnav-user-chip" title="${State.user.name}">
        <span class="gnav-user-avatar">${initial}</span>
        <span style="max-width:80px; overflow:hidden; text-overflow:ellipsis;">${State.user.name.split(' ').slice(-1)[0]}</span>
      </span>
    `;
    btn.title = `${State.user.name} — Nhấn để xem tài khoản`;
  } else {
    btn.innerHTML = `
      <span class="material-symbols-outlined" id="navAccountIcon">person</span>
    `;
    btn.title = 'Đăng nhập / Đăng ký';
  }
}

// ---- Logout ----
window.logoutUser = function() {
  State.user = null;
  localStorage.removeItem('nexus_user');
  updateNavUserState();
  showToast('Đã đăng xuất thành công.', 'logout');
  navigate('home');
};

// ====================================================================
// ADMIN AUTH MODAL & CREDENTIALS
// ====================================================================
// Nơi cấu hình tài khoản Quản trị viên tối cao (Super Admin)
const ADMIN_CREDENTIALS = {
  email: 'admin@nexus.vn',
  username: 'admin',
  password: 'admin123'
};

window.openAdminAuthModal = function() {
  // If already admin logged in, go directly to admin panel
  if (State.adminLoggedIn) {
    navigate('admin');
    return;
  }
  const overlay = document.getElementById('adminAuthOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    overlay.classList.add('active');
  });
  setTimeout(() => drawCaptcha('adminCaptchaCanvas', 'admin'), 50);
  document.body.style.overflow = 'hidden';
};

window.closeAdminAuthModal = function() {
  const overlay = document.getElementById('adminAuthOverlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.style.opacity = '0';
  setTimeout(() => { overlay.style.display = 'none'; }, 300);
  document.body.style.overflow = '';
  document.getElementById('adminErrorMsg')?.classList.remove('show');
};

window.handleAdminOverlayClick = function(e) {
  if (e.target === document.getElementById('adminAuthOverlay')) {
    closeAdminAuthModal();
  }
};

window.handleAdminLogin = function(e) {
  e.preventDefault();
  const inputAccount = document.getElementById('adminUsername')?.value.trim();
  const pw = document.getElementById('adminPassword')?.value;
  const errMsg = document.getElementById('adminErrorMsg');
  const errTxt = document.getElementById('adminErrorText');

  if (!inputAccount || !pw) {
    errTxt.textContent = 'Vui lòng nhập đầy đủ email/tên đăng nhập và mật khẩu.';
    errMsg.classList.add('show'); return;
  }

  // CAPTCHA check
  if (!verifyCaptcha('admin', 'adminCaptchaInput', 'adminCaptchaError')) return;

  // 1. Kiểm tra tài khoản Tổng Quản Trị tối cao (Master Super Admin)
  const isMasterAdmin = (
    inputAccount === ADMIN_CREDENTIALS.username || 
    inputAccount.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase()
  ) && pw === ADMIN_CREDENTIALS.password;

  // 2. Hoặc kiểm tra trong danh sách nhân sự State.users (nếu được cấp quyền quản trị)
  const matchedStaff = State.users.find(u => 
    (u.email.toLowerCase() === inputAccount.toLowerCase() || u.name.toLowerCase() === inputAccount.toLowerCase()) &&
    u.password === pw &&
    u.status === 'active' &&
    ['super_admin', 'telesale', 'warehouse', 'support'].includes(u.role)
  );

  if (!isMasterAdmin && !matchedStaff) {
    errTxt.textContent = 'Email hoặc mật khẩu quản trị không đúng. Truy cập bị từ chối.';
    errMsg.classList.add('show');
    errMsg.classList.add('shake');
    setTimeout(() => errMsg?.classList.remove('shake'), 500);
    refreshCaptcha('admin');
    return;
  }

  // Success
  State.adminLoggedIn = true;
  localStorage.setItem('nexus_admin_logged_in', 'true');

  if (matchedStaff) {
    State.adminRole = matchedStaff.role;
    localStorage.setItem('nexus_admin_role', matchedStaff.role);
    const roleTitle = ROLES[matchedStaff.role]?.name || matchedStaff.role;
    addAuditLog(`Đăng nhập thành công vào cổng Quản trị viên (${matchedStaff.name} - ${roleTitle})`);
  } else {
    State.adminRole = 'super_admin';
    localStorage.setItem('nexus_admin_role', 'super_admin');
    addAuditLog('Đăng nhập thành công vào cổng Quản trị viên (Super Admin)');
  }

  errMsg.classList.remove('show');
  closeAdminAuthModal();
  showToast('🔐 Đăng nhập quản trị thành công!', 'admin_panel_settings');
  navigate('admin');
};

// ---- Init auth nav state on page load ----
document.addEventListener('DOMContentLoaded', () => {
  updateNavUserState();
});
// Also init immediately if DOM already ready
if (document.readyState !== 'loading') {
  updateNavUserState();
}


