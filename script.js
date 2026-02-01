// API configuration
const API_BASE = "http://localhost:5000/api"; // Change this to your backend URL

// Helper function to get auth token
function getAuthToken() {
  return localStorage.getItem("authToken");
}

// Helper function to make authenticated requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = getAuthToken();

  const defaultOptions = {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };

  const response = await fetch(url, { ...defaultOptions, ...options });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  return response.json();
}

// Cart management using API
async function getCart() {
  try {
    return await getCartAPI();
  } catch (e) {
    console.error("Failed to get cart from API:", e);
    return [];
  }
}

async function saveCart(cart) {
  try {
    localStorage.setItem("cart", JSON.stringify(cart));
  } catch (e) {
    console.error("Failed to save cart to localStorage:", e);
  }
  await updateCartCount();
}

async function updateCartCount() {
  const cart = await getCart();
  const count = cart.reduce((s, i) => s + (i.quantity || 0), 0);
  const el = document.getElementById("cartCount");
  if (el) el.innerText = count;
}

async function addToCart(product) {
  try {
    await addToCartAPI({ productId: product.id, name: product.name, price: product.price, img: product.img, quantity: 1 });
    await updateCartCount();
    // Visual feedback
    const cartBtn = document.querySelector(".cart-btn");
    if (cartBtn) {
      cartBtn.classList.add("flash");
      setTimeout(() => cartBtn.classList.remove("flash"), 600);
    }
  } catch (e) {
    console.error("Failed to add to cart via API:", e);
    // Fallback to localStorage if not authenticated
    const cart = await getCart();
    const existing = cart.find((i) => i.productId == product.id);
    if (existing) {
      existing.quantity = (existing.quantity || 0) + 1;
    } else {
      cart.push({ ...product, productId: product.id, quantity: 1 });
    }
    await saveCart(cart);
    // Visual feedback
    const cartBtn = document.querySelector(".cart-btn");
    if (cartBtn) {
      cartBtn.classList.add("flash");
      setTimeout(() => cartBtn.classList.remove("flash"), 600);
    }
  }
}

async function getWishlistAPI() {
  return apiRequest("/wishlist");
}

async function addToWishlistAPI(product) {
  return apiRequest("/wishlist/add", {
    method: "POST",
    body: JSON.stringify(product),
  });
}

async function removeFromWishlistAPI(id) {
  return apiRequest(`/wishlist/${id}`, {
    method: "DELETE",
  });
}

async function getCartAPI() {
  return apiRequest("/cart");
}

async function addToCartAPI(product) {
  return apiRequest("/cart/add", {
    method: "POST",
    body: JSON.stringify(product),
  });
}

async function updateCartQuantityAPI(id, quantity) {
  return apiRequest(`/cart/update/${id}`, {
    method: "PUT",
    body: JSON.stringify({ quantity }),
  });
}

async function removeFromCartAPI(id) {
  return apiRequest(`/cart/${id}`, {
    method: "DELETE",
  });
}

async function clearCartAPI() {
  return apiRequest("/cart", {
    method: "DELETE",
  });
}

async function renderWishlistPage() {
  const container = document.getElementById("wishlistItems");
  const empty = document.getElementById("emptyWishlist");

  if (!container) return;

  const wishlist = await getWishlistAPI();

  if (wishlist.length === 0) {
    empty.style.display = "block";
    container.innerHTML = "";
    return;
  }

  empty.style.display = "none";
  container.innerHTML = "";

  wishlist.forEach((item) => {
    const div = document.createElement("div");
    div.className = "product card";

    div.innerHTML = `
      <div class="media">
        <img src="${item.img}">
        <span class="price-badge">₹${item.price}</span>
      </div>
      <h3>${item.name}</h3>

      <div class="card-cta">
        <button class="btn btn-primary move-to-cart">Move to Cart</button>
        <button class="btn btn-danger remove-wish">Remove</button>
      </div>
    `;

    div.querySelector(".remove-wish").onclick = async () => {
      await removeFromWishlistAPI(item.productId);
      renderWishlistPage();
    };

    div.querySelector(".move-to-cart").onclick = async () => {
      await addToCart(item);
      await removeFromWishlistAPI(item.productId);
      renderWishlistPage();
    };

    container.appendChild(div);
  });
}

// Discount helpers: apply random discounts > 40% to products and persist them in localStorage
const DISCOUNT_KEY = "productDiscounts";

function getSavedDiscounts() {
  try {
    return JSON.parse(localStorage.getItem(DISCOUNT_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

function saveDiscounts(map) {
  try {
    localStorage.setItem(DISCOUNT_KEY, JSON.stringify(map));
  } catch (e) {
    // ignore
  }
}

function randomDiscountPercent() {
  // 41% - 70% inclusive
  return Math.floor(Math.random() * (70 - 41 + 1)) + 41;
}

function applyDiscounts() {
  const saved = getSavedDiscounts();
  let changed = false;
  document.querySelectorAll(".product").forEach((p) => {
    const id = p.dataset.id;
    const originalFromDom =
      parseFloat(p.dataset.price) ||
      parseFloat(
        (p.querySelector(".price-badge")?.innerText || "").replace(
          /[^0-9.]/g,
          "",
        ),
      ) ||
      0;
    if (!originalFromDom) return;

    let percent, discounted, original;

    if (id && saved[id]) {
      percent = saved[id].percent;
      discounted = saved[id].discounted;
      original = saved[id].original || originalFromDom;
    } else {
      percent = randomDiscountPercent();
      discounted =
        Math.round(originalFromDom * (1 - percent / 100) * 100) / 100;
      original = originalFromDom;
      if (id) {
        saved[id] = { percent, discounted, original };
        changed = true;
      }
    }

    // Apply to DOM
    p.dataset.discount = percent;
    p.dataset.discounted = discounted;
    p.dataset.price = discounted; // ensure Add-to-Cart picks up discounted price

    const priceBadge = p.querySelector(".price-badge");
    if (priceBadge) {
      priceBadge.innerHTML = `₹${discounted.toFixed(
        2,
      )} <span class="old-price">₹${original.toFixed(2)}</span>`;
      let tag = p.querySelector(".discount-tag");
      if (!tag) {
        tag = document.createElement("span");
        tag.className = "discount-tag";
        const media = p.querySelector(".media") || p;
        media.appendChild(tag);
      }
      tag.innerText = `-${percent}%`;
    }

    p.dataset.discountApplied = "1";
  });

  if (changed) saveDiscounts(saved);
}

async function clearCart() {
  try {
    await clearCartAPI();
  } catch (e) {
    console.error("Failed to clear cart:", e);
  }
  await updateCartCount();
  // Re-render if on cart page to show empty message and reset totals
  if (
    window.location.pathname.endsWith("cart.html") ||
    window.location.href.includes("cart.html")
  ) {
    await renderCartPage();
  }
}

async function changeQuantityById(id, delta) {
  const cart = await getCart();
  const item = cart.find((i) => i.productId == id);
  if (!item) return;
  const newQuantity = Math.max(1, (item.quantity || 0) + delta);
  try {
    await updateCartQuantityAPI(id, newQuantity);
    // Re-render cart UI if we're on the cart page so the qty updates immediately
    if (
      window.location.pathname.endsWith("cart.html") ||
      window.location.href.includes("cart.html")
    ) {
      await renderCartPage();
    } else {
      // If not on cart page, try to update the quantity element if present
      const qtyEl = document.getElementById(`qty-${id}`);
      if (qtyEl) qtyEl.innerText = newQuantity;
    }
  } catch (e) {
    console.error("Failed to update quantity:", e);
  }
}

// Backwards-compatible wrapper (if any code calls by index)
async function changeQuantity(indexOrId, delta) {
  if (typeof indexOrId === "number") {
    const cart = await getCart();
    if (!cart[indexOrId]) return;
    await changeQuantityById(cart[indexOrId].id, delta);
  } else {
    await changeQuantityById(indexOrId, delta);
  }
}

async function removeItemById(id) {
  try {
    await removeFromCartAPI(id);
    // Update UI if on cart page
    if (
      window.location.pathname.endsWith("cart.html") ||
      window.location.href.includes("cart.html")
    ) {
      await renderCartPage();
    }
  } catch (e) {
    console.error("Failed to remove item:", e);
  }
}

// Backwards compatible wrapper
async function removeItem(index) {
  const cart = await getCart();
  if (typeof index === "number" && cart[index])
    await removeItemById(cart[index].id);
}

async function updateCartTotal() {
  const cart = await getCart();
  const subtotal = cart.reduce(
    (s, i) => s + (i.price || 0) * (i.quantity || 0),
    0,
  );
  const shipping = subtotal >= 200 ? 0 : 50;
  const tax = subtotal * 0.05;
  const discount = await getAppliedDiscount();
  const total = subtotal + shipping + tax - discount;

  const subtotalEl = document.getElementById("cartSubtotal");
  if (subtotalEl) subtotalEl.innerText = `₹${subtotal.toFixed(2)}`;
  const shippingEl = document.getElementById("cartShipping");
  if (shippingEl) shippingEl.innerText = `₹${shipping.toFixed(2)}`;
  const taxEl = document.getElementById("cartTax");
  if (taxEl) taxEl.innerText = `₹${tax.toFixed(2)}`;
  const discountEl = document.getElementById("cartDiscount");
  if (discountEl) discountEl.innerText = `₹${discount.toFixed(2)}`;
  const totalEl = document.getElementById("cartTotal");
  if (totalEl) totalEl.innerText = `₹${total.toFixed(2)}`;
  await updateCartCount();
}

async function updateOrderTotal() {
  const cart = await getCart();
  const subtotal = cart.reduce(
    (s, i) => s + (i.price || 0) * (i.quantity || 0),
    0,
  );
  const shipping = subtotal >= 200 ? 0 : 50;
  const tax = subtotal * 0.05;
  const discount = await getAppliedDiscount();
  const total = subtotal + shipping + tax - discount;

  const subtotalEl = document.getElementById("orderSubtotal");
  if (subtotalEl) subtotalEl.innerText = `₹${subtotal.toFixed(2)}`;
  const shippingEl = document.getElementById("orderShipping");
  if (shippingEl) shippingEl.innerText = `₹${shipping.toFixed(2)}`;
  const taxEl = document.getElementById("orderTax");
  if (taxEl) taxEl.innerText = `₹${tax.toFixed(2)}`;
  const discountEl = document.getElementById("orderDiscount");
  if (discountEl) discountEl.innerText = `₹${discount.toFixed(2)}`;
  const totalEl = document.getElementById("orderTotal");
  if (totalEl) totalEl.innerText = `₹${total.toFixed(2)}`;
}

async function getAppliedDiscount() {
  const code = localStorage.getItem("appliedDiscountCode");
  if (code === "SAVE10") {
    const cart = await getCart();
    const subtotal = cart.reduce(
      (s, i) => s + (i.price || 0) * (i.quantity || 0),
      0,
    );
    return subtotal * 0.1;
  }
  return 0;
}

async function applyDiscountCode() {
  const codeInput = document.getElementById("discountCode");
  if (!codeInput) return;
  const code = codeInput.value.trim().toUpperCase();
  if (code === "SAVE10") {
    localStorage.setItem("appliedDiscountCode", code);
    showNotification("Success", "Discount applied!");
  } else {
    showNotification("Error", "Invalid discount code.", "error");
    localStorage.removeItem("appliedDiscountCode");
  }
  await renderCartPage();
}

async function renderCartPage() {
  const container = document.getElementById("cartItems");
  if (!container) return;
  const cart = await getCart();
  container.innerHTML = "";
  if (cart.length === 0) {
    container.innerHTML = "<p>Your cart is empty.</p>";
    const subtotalEl = document.getElementById("cartSubtotal");
    if (subtotalEl) subtotalEl.innerText = "₹0.00";
    const shippingEl = document.getElementById("cartShipping");
    if (shippingEl) shippingEl.innerText = "₹0.00";
    const taxEl = document.getElementById("cartTax");
    if (taxEl) taxEl.innerText = "₹0.00";
    const discountEl = document.getElementById("cartDiscount");
    if (discountEl) discountEl.innerText = "₹0.00";
    const totalEl = document.getElementById("cartTotal");
    if (totalEl) totalEl.innerText = "₹0.00";
    return;
  }

  cart.forEach((item, idx) => {
    const itemEl = document.createElement("div");
    itemEl.className = "cart-item";
    itemEl.innerHTML = `
      <img src="${item.img}" alt="">
      <div class="info">
        <h4>${item.name}</h4>
        <p>₹${item.price.toFixed(2)}</p>
      </div>
      <div class="actions">
        <div class="qty">
          <button class="qty-btn" aria-label="Decrease">−</button>
          <span id="qty-${item.productId}" class="qty-num">${item.quantity}</span>
          <button class="qty-btn" aria-label="Increase">+</button>
        </div>
        <button class="remove-btn" aria-label="Remove item">Remove</button>
      </div>
    `;
    // Attach event listeners
    const decreaseBtn = itemEl.querySelector('.qty-btn[aria-label="Decrease"]');
    const increaseBtn = itemEl.querySelector('.qty-btn[aria-label="Increase"]');
    const removeBtn = itemEl.querySelector(".remove-btn");
    decreaseBtn.addEventListener("click", () =>
      changeQuantityById(item.productId, -1),
    );
    increaseBtn.addEventListener("click", () => changeQuantityById(item.productId, 1));
    removeBtn.addEventListener("click", () => removeItemById(item.productId));
    container.appendChild(itemEl);
  });
  await updateCartTotal();
}

async function renderOrderPage() {
  const container = document.getElementById("orderItems");
  if (!container) return;
  const cart = await getCart();
  container.innerHTML = "";
  if (cart.length === 0) {
    container.innerHTML = "<p>No items in your order.</p>";
    return;
  }

  cart.forEach((item) => {
    const itemEl = document.createElement("div");
    itemEl.className = "order-item";
    itemEl.innerHTML = `
      <img src="${item.img}" alt="">
      <div class="info">
        <h4>${item.name}</h4>
        <p>₹${item.price.toFixed(2)} x ${item.quantity}</p>
      </div>
    `;
    container.appendChild(itemEl);
  });
  await updateOrderTotal();
}

// User authentication functions using localStorage
async function registerUser(userData) {
  try {
    const res = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });

    return res;
  } catch (err) {
    console.error("Registration failed:", err);
    throw err;
  }
}

async function loginUser(credentials) {
  try {
    const res = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    // save JWT token
    localStorage.setItem("authToken", res.token);
    localStorage.setItem("currentUser", JSON.stringify(res.user));

    return res;
  } catch (err) {
    console.error("Login failed:", err);
    throw err;
  }
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("currentUser"));
  } catch (e) {
    return null;
  }
}

function logout() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("currentUser");
  updateAuthUI();
}

async function updateAuthUI() {
  const currentUser = getCurrentUser();
  const navActions = document.querySelector(".nav-actions");

  if (currentUser) {
    navActions.innerHTML = `
      <div class="user-account">
        <button class="user-dropdown-btn" onclick="toggleUserDropdown()" aria-haspopup="true" aria-expanded="false">
          <svg class="user-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="user-name">Hello, ${currentUser.name}</span>
          <svg class="dropdown-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="user-dropdown" id="userDropdown" role="menu">
          <a href="#" role="menuitem" class="dropdown-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Your Account
          </a>
          <a href="order.html" role="menuitem" class="dropdown-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Your Orders
          </a>
          <a href="wishlist.html" role="menuitem" class="dropdown-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4.318 6.318C3.90009 6.73587 3.56863 7.23191 3.34254 7.77705C3.11645 8.32219 3 8.90343 3 9.49087C3 10.0783 3.11645 10.6595 3.34254 11.2047C3.56863 11.7498 3.90009 12.2459 4.318 12.6638L12 20.3458L19.682 12.6638C20.0999 12.2459 20.4314 11.7498 20.6575 11.2047C20.8836 10.6595 21 10.0783 21 9.49087C21 8.90343 20.8836 8.32219 20.6575 7.77705C20.4314 7.23191 20.0999 6.73587 19.682 6.318C19.2641 5.90009 18.7681 5.56863 18.223 5.34254C17.6778 5.11645 17.0966 5 16.5091 5C15.9217 5 15.3405 5.11645 14.7953 5.34254C14.2502 5.56863 13.7541 5.90009 13.3362 6.318L12 7.65482L10.6638 6.318C10.2459 5.90009 9.74985 5.56863 9.2047 5.34254C8.65955 5.11645 8.07828 5 7.49087 5C6.90343 5 6.32219 5.11645 5.77705 5.34254C5.23191 5.56863 4.73587 5.90009 4.318 6.318Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Your Wishlist
          </a>
          <a href="#" role="menuitem" class="dropdown-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Customer Service
          </a>
          <div class="dropdown-divider"></div>
          <a href="#" onclick="logout()" role="menuitem" class="dropdown-item logout-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M17 7L7 17M17 17H7V7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Logout
          </a>
        </div>
      </div>
      <button class="btn btn-ghost cart-btn" onclick="window.location='cart.html'">
        🛒 <span class="sr-only">Cart</span> <span id="cartCount">0</span>
      </button>
    `;
  } else {
    navActions.innerHTML = `
      <button class="btn btn-ghost" onclick="openLoginModal()">Login</button>
      <button class="btn btn-primary" onclick="openRegisterModal()">Register</button>
      <button class="btn btn-ghost cart-btn" onclick="window.location='cart.html'">
        🛒 <span class="sr-only">Cart</span> <span id="cartCount">0</span>
      </button>
    `;
  }
  await updateCartCount();
}

// Modal functions
function openLoginModal() {
  document.getElementById("loginModal").classList.add("show");
}

function closeLoginModal() {
  document.getElementById("loginModal").classList.remove("show");
}

function openRegisterModal() {
  document.getElementById("registerModal").classList.add("show");
}

function closeRegisterModal() {
  document.getElementById("registerModal").classList.remove("show");
}

function switchToRegister() {
  closeLoginModal();
  openRegisterModal();
}

function switchToLogin() {
  closeRegisterModal();
  openLoginModal();
}

function toggleUserDropdown() {
  const dropdown = document.getElementById("userDropdown");
  if (dropdown) {
    dropdown.classList.toggle("show");
  }
}

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("userDropdown");
  const btn = document.querySelector(".user-dropdown-btn");
  if (
    dropdown &&
    btn &&
    !btn.contains(e.target) &&
    !dropdown.contains(e.target)
  ) {
    dropdown.classList.remove("show");
  }
});

// Notification functions
function showNotification(title, message, type = "success") {
  const popup = document.getElementById("notificationPopup");

  // 🚨 If popup doesn't exist on this page, fallback
  if (!popup) {
    alert(message);
    return;
  }

  const titleEl = document.getElementById("notificationTitle");
  const messageEl = document.getElementById("notificationMessage");
  const iconEl = popup.querySelector(".notification-icon svg");
  const contentEl = popup.querySelector(".notification-content");

  titleEl.textContent = title;
  messageEl.textContent = message;

  if (type === "error") {
    iconEl.innerHTML =
      '<path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    contentEl.style.borderLeftColor = "var(--danger)";
    iconEl.style.color = "var(--danger)";
  } else {
    iconEl.innerHTML =
      '<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    contentEl.style.borderLeftColor = "var(--primary)";
    iconEl.style.color = "var(--primary)";
  }

  popup.classList.add("show");

  setTimeout(() => {
    closeNotification();
  }, 5000);
}

function closeNotification() {
  const popup = document.getElementById("notificationPopup");
  popup.classList.remove("show");
}

// Form handlers
async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    showNotification("Error", "Please fill in all fields.", "error");
    return;
  }

  try {
    const response = await loginUser({ email, password });
    showNotification("Success!", "Login successful! Welcome back.");
    closeLoginModal();
    updateAuthUI();
  } catch (e) {
    showNotification("Login Failed", e.message, "error");
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const phone = document.getElementById("registerPhone").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById(
    "registerConfirmPassword",
  ).value;

  if (!name || !email || !password || !confirmPassword) {
    showNotification("Error", "Please fill in all required fields.", "error");
    return;
  }

  if (password !== confirmPassword) {
    showNotification("Error", "Passwords do not match.", "error");
    return;
  }

  try {
    const response = await registerUser({ name, email, phone, password });
    showNotification("Success!", "Registration successful! Please login.");
    closeRegisterModal();
    openLoginModal();
  } catch (e) {
    showNotification("Registration Failed", e.message, "error");
  }
}

// Attach add-to-cart handlers and initialize count
document.addEventListener("DOMContentLoaded", () => {
  if (location.href.includes("wishlist.html")) {
    renderWishlistPage();
  }

  // Initialize authentication UI
  updateAuthUI();

  // Add form event listeners
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", handleRegister);
  }

  // Apply random discounts to product cards (percent > 40%)
  applyDiscounts();

  document.querySelectorAll(".add-to-cart").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      console.log("Add to cart button clicked");
      const button = e.currentTarget;
      const productEl = button.closest(".product");
      console.log("Product element:", productEl);
      const id = button.dataset.id || productEl.dataset.id;
      console.log("ID:", id);
      const name =
        productEl.dataset.name ||
        productEl.querySelector("h3").innerText.trim();
      console.log("Name:", name);
      const price =
        parseFloat(productEl.dataset.price) ||
        parseFloat(
          (productEl.querySelector(".price-badge")?.innerText || "").replace(
            /[^0-9.]/g,
            "",
          ),
        ) ||
        0;
      console.log("Price:", price);
      const img = productEl.querySelector("img")?.src || "";
      console.log("Img:", img);
      await addToCart({ id, name, price, img });
      console.log("Add to cart completed");
    });
  });

  document.querySelectorAll(".wishlist-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const productEl = btn.closest(".product");

      const product = {
        productId: productEl.dataset.id,
        name: productEl.dataset.name,
        price: parseFloat(productEl.dataset.price),
        img: productEl.querySelector("img").src,
      };

      try {
        const res = await addToWishlistAPI(product);
        console.log("Wishlist added:", res);
        showNotification("Success", `${product.name} added to wishlist ❤️`);
      } catch (err) {
        console.error("Wishlist API error:", err);
        showNotification("Error", "Failed to add to wishlist", "error");
      }
    });
  });

  // If we're on the cart page, render it
  if (
    window.location.pathname.endsWith("cart.html") ||
    window.location.href.includes("cart.html")
  ) {
    renderCartPage();
    const clearBtn = document.getElementById("clearCartBtn");
    if (clearBtn)
      clearBtn.addEventListener("click", async () => {
        if (confirm("Clear cart?")) {
          await clearCart();
        }
      });
    const checkoutBtn = document.getElementById("checkoutBtn");


    const applyDiscountBtn = document.getElementById("applyDiscountBtn");
    if (applyDiscountBtn)
      applyDiscountBtn.addEventListener("click", async () => {
        await applyDiscountCode();
      });
  }

  // If we're on the order page, render it
  if (
    window.location.pathname.endsWith("order.html") ||
    window.location.href.includes("order.html")
  ) {
    renderOrderPage();
  }

  updateCartCount();

  // Search expand, clear, and product filtering with suggestions
  const searchInput = document.getElementById("searchInput");
  const searchWrapEl = document.querySelector(".search-wrap");
  const searchForm = document.querySelector(".search-form");
  const clearBtn = document.querySelector(".search-clear");
  const suggestionsEl = document.getElementById("searchSuggestions");

  if (searchInput && searchWrapEl && searchForm) {
    let allProductNames = [];
    let currentSuggestions = [];
    let selectedSuggestionIndex = -1;

    // Collect all product names
    document.querySelectorAll(".product").forEach((p) => {
      const name = (
        p.dataset.name ||
        p.querySelector("h3")?.innerText ||
        ""
      ).trim();
      if (name && !allProductNames.includes(name)) {
        allProductNames.push(name);
      }
    });

    const filterProducts = (q) => {
      const term = (q || "").trim().toLowerCase();
      document.querySelectorAll(".product").forEach((p) => {
        const name = (
          p.dataset.name ||
          p.querySelector("h3")?.innerText ||
          ""
        ).toLowerCase();
        p.style.display = term ? (name.includes(term) ? "" : "none") : "";
      });
    };

    const showSuggestions = (query) => {
      if (!suggestionsEl) return;
      const term = query.trim().toLowerCase();
      if (!term) {
        suggestionsEl.classList.remove("show");
        return;
      }

      currentSuggestions = allProductNames
        .filter((name) => name.toLowerCase().includes(term))
        .slice(0, 5); // Limit to 5 suggestions

      if (currentSuggestions.length === 0) {
        suggestionsEl.classList.remove("show");
        return;
      }

      suggestionsEl.innerHTML = currentSuggestions
        .map(
          (name, index) =>
            `<div class="search-suggestion-item" data-index="${index}">${name}</div>`,
        )
        .join("");

      suggestionsEl.classList.add("show");
      selectedSuggestionIndex = -1;
    };

    const hideSuggestions = () => {
      if (suggestionsEl) suggestionsEl.classList.remove("show");
      selectedSuggestionIndex = -1;
    };

    const selectSuggestion = (index) => {
      if (currentSuggestions[index]) {
        searchInput.value = currentSuggestions[index];
        hideSuggestions();
        searchInput.focus();
      }
    };

    // Handle form submit
    window.handleSearchSubmit = (event) => {
      event.preventDefault();
      const query = searchInput.value.trim();
      if (query) {
        filterProducts(query);
        hideSuggestions();
        searchWrapEl.classList.remove("expanded");
      }
    };

    searchInput.addEventListener("focus", () =>
      searchWrapEl.classList.add("expanded"),
    );

    searchInput.addEventListener("blur", () => {
      // Delay hiding to allow click on suggestions
      setTimeout(() => {
        if (!searchInput.value) searchWrapEl.classList.remove("expanded");
        hideSuggestions();
      }, 150);
    });

    searchInput.addEventListener("input", (e) => {
      const val = e.target.value;
      if (val) {
        searchForm.classList.add("has-value");
        if (clearBtn) clearBtn.hidden = false;
        showSuggestions(val);
        filterProducts(val);
      } else {
        searchForm.classList.remove("has-value");
        if (clearBtn) clearBtn.hidden = true;
        hideSuggestions();
        filterProducts("");
      }
    });

    // Handle suggestion clicks
    if (suggestionsEl) {
      suggestionsEl.addEventListener("click", (e) => {
        const item = e.target.closest(".search-suggestion-item");
        if (item) {
          const index = parseInt(item.dataset.index);
          selectSuggestion(index);
        }
      });
    }

    // Handle keyboard navigation
    searchInput.addEventListener("keydown", (e) => {
      if (!suggestionsEl.classList.contains("show")) return;

      const items = suggestionsEl.querySelectorAll(".search-suggestion-item");

      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedSuggestionIndex = Math.min(
          selectedSuggestionIndex + 1,
          items.length - 1,
        );
        updateSuggestionSelection(items);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
        updateSuggestionSelection(items);
      } else if (e.key === "Enter" && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        selectSuggestion(selectedSuggestionIndex);
      } else if (e.key === "Escape") {
        hideSuggestions();
      }
    });

    const updateSuggestionSelection = (items) => {
      items.forEach((item, index) => {
        item.classList.toggle("active", index === selectedSuggestionIndex);
      });
    };

    if (clearBtn)
      clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        searchInput.focus();
        searchForm.classList.remove("has-value");
        clearBtn.hidden = true;
        hideSuggestions();
        filterProducts("");
      });
  }

  // Slideshow functionality
  let currentSlide = 0;
  const slides = document.querySelectorAll(".slide");
  const dots = document.querySelectorAll(".dot");

  function showSlide(index) {
    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === index);
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });
  }

  function nextSlide() {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide(currentSlide);
  }

  function goToSlide(index) {
    currentSlide = index;
    showSlide(currentSlide);
  }

  // Initialize slideshow
  if (slides.length > 0) {
    showSlide(0);
    setInterval(nextSlide, 3000); // Auto-play every 3 seconds

    // Add click handlers to dots
    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => goToSlide(index));
    });
  }

  // Shop page filtering and sorting
  const categoryFilter = document.getElementById("categoryFilter");
  const sortOptions = document.getElementById("sortOptions");
  const productsContainer = document.querySelector(".products");

  if (categoryFilter && sortOptions && productsContainer) {
    function filterAndSortProducts() {
      const selectedCategory = categoryFilter.value;
      const selectedSort = sortOptions.value;
      const searchTerm = (document.getElementById("searchInput")?.value || "")
        .trim()
        .toLowerCase();
      const products = Array.from(productsContainer.children);

      // Filter products
      const filteredProducts = products.filter((product) => {
        const name = (
          product.dataset.name ||
          product.querySelector("h3")?.innerText ||
          ""
        ).toLowerCase();
        const category = product.dataset.category;
        const matchesSearch = !searchTerm || name.includes(searchTerm);
        const matchesCategory =
          selectedCategory === "all" || category === selectedCategory;
        return matchesSearch && matchesCategory;
      });

      // Sort products
      filteredProducts.sort((a, b) => {
        switch (selectedSort) {
          case "price-low":
            return parseFloat(a.dataset.price) - parseFloat(b.dataset.price);
          case "price-high":
            return parseFloat(b.dataset.price) - parseFloat(a.dataset.price);
          case "name-asc":
            return a.dataset.name.localeCompare(b.dataset.name);
          case "name-desc":
            return b.dataset.name.localeCompare(a.dataset.name);
          default:
            return 0; // Default order
        }
      });

      // Set display
      products.forEach((p) => (p.style.display = "none"));
      filteredProducts.forEach((p) => (p.style.display = ""));

      // Reorder products in DOM
      filteredProducts.forEach((product) => {
        productsContainer.appendChild(product);
      });
    }

    categoryFilter.addEventListener("change", filterAndSortProducts);
    sortOptions.addEventListener("change", filterAndSortProducts);
  }
});
