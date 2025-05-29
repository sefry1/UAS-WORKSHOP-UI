// Global Variables
let cart = []
let products = []
let users = []
let transactions = []
let currentUser = null

// Authentication System
const AuthSystem = {
  login(email, password) {
    const users = getUsers()
    const user = users.find((u) => u.email === email)

    if (!user) {
      return { success: false, message: "Email tidak ditemukan!" }
    }

    // In real app, you would hash and compare passwords
    if (user.password !== password) {
      return { success: false, message: "Password salah!" }
    }

    if (user.status !== "active") {
      return { success: false, message: "Akun Anda tidak aktif!" }
    }

    // Set current user
    currentUser = user
    saveCurrentUser()

    // Send welcome email
    EmailSystem.sendWelcomeEmail(user)

    return { success: true, user: user }
  },

  register(userData) {
    const users = getUsers()

    // Check if email already exists
    if (users.find((u) => u.email === userData.email)) {
      return { success: false, message: "Email sudah terdaftar!" }
    }

    // Create new user
    const newUser = {
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      phone: userData.phone,
      password: userData.password, // In real app, hash this
      address: userData.address,
      role: "customer",
      status: "active",
      newsletter: userData.newsletter,
    }

    const createdUser = addUser(newUser)

    // Send registration email
    EmailSystem.sendRegistrationEmail(createdUser)

    return { success: true, user: createdUser }
  },

  logout() {
    currentUser = null
    localStorage.removeItem("currentUser")
    showNotification("Logout berhasil!", "success")
    window.location.href = "index.html"
  },

  getCurrentUser() {
    return currentUser
  },

  forgotPassword(email) {
    const users = getUsers()
    const user = users.find((u) => u.email === email)

    if (user) {
      // In real app, generate reset token and send email
      EmailSystem.sendPasswordResetEmail(user)
      return { success: true, message: "Link reset password telah dikirim!" }
    }

    return { success: false, message: "Email tidak ditemukan!" }
  },

  updateProfile(userData) {
    if (!currentUser) return { success: false, message: "Anda harus login terlebih dahulu!" }

    const updatedUser = updateUser(currentUser.id, userData)
    if (updatedUser) {
      currentUser = updatedUser
      saveCurrentUser()
      return { success: true, user: updatedUser }
    }

    return { success: false, message: "Gagal memperbarui profil!" }
  },
}

// Wishlist System
const WishlistSystem = {
  getWishlist() {
    const wishlist = localStorage.getItem("wishlist")
    return wishlist ? JSON.parse(wishlist) : []
  },

  saveWishlist(wishlist) {
    localStorage.setItem("wishlist", JSON.stringify(wishlist))
  },

  addToWishlist(productId) {
    const wishlist = this.getWishlist()
    const product = getProduct(productId)

    if (!product) {
      showNotification("Produk tidak ditemukan!", "error")
      return false
    }

    if (wishlist.find((item) => item.id === productId)) {
      showNotification("Produk sudah ada di wishlist!", "info")
      return false
    }

    const wishlistItem = {
      ...product,
      addedDate: new Date().toISOString(),
    }

    wishlist.push(wishlistItem)
    this.saveWishlist(wishlist)
    showNotification("Produk ditambahkan ke wishlist!", "success")
    this.updateWishlistCount()
    return true
  },

  removeFromWishlist(productId) {
    let wishlist = this.getWishlist()
    wishlist = wishlist.filter((item) => item.id !== productId)
    this.saveWishlist(wishlist)
    this.updateWishlistCount()
    return true
  },

  clearWishlist() {
    this.saveWishlist([])
    this.updateWishlistCount()
  },

  getWishlistItems() {
    const wishlist = this.getWishlist()
    const products = getProducts()

    // Update wishlist items with current product data
    return wishlist
      .map((wishlistItem) => {
        const currentProduct = products.find((p) => p.id === wishlistItem.id)
        return currentProduct ? { ...currentProduct, addedDate: wishlistItem.addedDate } : wishlistItem
      })
      .filter((item) => item) // Remove null items
  },

  getWishlistCount() {
    return this.getWishlist().length
  },

  updateWishlistCount() {
    const wishlistCountElements = document.querySelectorAll("#wishlist-count, .wishlist-count")
    const totalItems = this.getWishlistCount()

    wishlistCountElements.forEach((element) => {
      element.textContent = totalItems
      element.style.display = totalItems > 0 ? "inline" : "none"
    })
  },

  isInWishlist(productId) {
    const wishlist = this.getWishlist()
    return wishlist.some((item) => item.id === productId)
  },
}

// Review System
const ReviewSystem = {
  getReviews(productId) {
    const reviews = localStorage.getItem("reviews")
    const allReviews = reviews ? JSON.parse(reviews) : []
    return allReviews.filter((review) => review.productId === productId)
  },

  getAllReviews() {
    const reviews = localStorage.getItem("reviews")
    return reviews ? JSON.parse(reviews) : []
  },

  saveReviews(reviews) {
    localStorage.setItem("reviews", JSON.stringify(reviews))
  },

  addReview(productId, reviewData) {
    if (!currentUser) {
      showNotification("Anda harus login untuk memberikan review!", "error")
      return false
    }

    const reviews = this.getAllReviews()

    // Check if user already reviewed this product
    const existingReview = reviews.find((r) => r.productId === productId && r.userId === currentUser.id)
    if (existingReview) {
      showNotification("Anda sudah memberikan review untuk produk ini!", "error")
      return false
    }

    const newReview = {
      id: Date.now(),
      productId: productId,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`,
      rating: reviewData.rating,
      comment: reviewData.comment,
      date: new Date().toISOString(),
      helpful: 0,
    }

    reviews.push(newReview)
    this.saveReviews(reviews)

    // Update product rating
    this.updateProductRating(productId)

    showNotification("Review berhasil ditambahkan!", "success")
    return true
  },

  updateProductRating(productId) {
    const reviews = this.getReviews(productId)
    const product = getProduct(productId)

    if (reviews.length === 0 || !product) return

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0)
    const averageRating = totalRating / reviews.length

    updateProduct(productId, {
      rating: Math.round(averageRating * 10) / 10,
      reviews: reviews.length,
    })
  },

  markHelpful(reviewId) {
    const reviews = this.getAllReviews()
    const review = reviews.find((r) => r.id === reviewId)

    if (review) {
      review.helpful = (review.helpful || 0) + 1
      this.saveReviews(reviews)
      return true
    }

    return false
  },
}

// Payment System
const PaymentSystem = {
  processPayment(paymentData) {
    return new Promise((resolve) => {
      // Simulate payment processing
      setTimeout(() => {
        const success = Math.random() > 0.1 // 90% success rate

        if (success) {
          const transactionId = "PAY_" + Date.now()
          resolve({
            success: true,
            transactionId: transactionId,
            message: "Pembayaran berhasil diproses!",
          })
        } else {
          resolve({
            success: false,
            message: "Pembayaran gagal. Silakan coba lagi.",
          })
        }
      }, 2000)
    })
  },

  async processCheckout(checkoutData) {
    try {
      // Validate cart
      if (cart.length === 0) {
        throw new Error("Keranjang kosong!")
      }

      // Calculate totals
      const subtotal = getCartTotal()
      const shippingCost = subtotal > 500000 ? 0 : 15000
      const total = subtotal + shippingCost

      // Process payment
      const paymentResult = await this.processPayment({
        amount: total,
        method: checkoutData.paymentMethod,
      })

      if (!paymentResult.success) {
        throw new Error(paymentResult.message)
      }

      // Create transaction
      const transaction = {
        items: [...cart],
        total: total,
        status: "processing",
        paymentId: paymentResult.transactionId,
        shipping: checkoutData.shipping,
      }

      const newTransaction = addTransaction(transaction)

      // Send confirmation email
      if (currentUser) {
        EmailSystem.sendOrderConfirmation(currentUser, newTransaction)
      }

      // Clear cart
      clearCart()

      return {
        success: true,
        transaction: newTransaction,
        message: "Pesanan berhasil dibuat!",
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      }
    }
  },
}

// Email System (Mock implementation)
const EmailSystem = {
  sendEmail(to, subject, content) {
    // In real app, this would integrate with email service
    console.log(`Email sent to ${to}:`)
    console.log(`Subject: ${subject}`)
    console.log(`Content: ${content}`)

    // Store email in localStorage for demo
    const emails = JSON.parse(localStorage.getItem("emails") || "[]")
    emails.push({
      to: to,
      subject: subject,
      content: content,
      date: new Date().toISOString(),
      read: false,
    })
    localStorage.setItem("emails", JSON.stringify(emails))
  },

  sendWelcomeEmail(user) {
    const subject = "Selamat Datang di FashionStore!"
    const content = `
            Halo ${user.firstName},
            
            Selamat datang di FashionStore! Kami senang Anda bergabung dengan komunitas fashion kami.
            
            Nikmati pengalaman berbelanja yang menyenangkan dengan koleksi fashion terbaru dan berkualitas.
            
            Salam hangat,
            Tim FashionStore
        `

    this.sendEmail(user.email, subject, content)
  },

  sendRegistrationEmail(user) {
    const subject = "Registrasi Berhasil - FashionStore"
    const content = `
            Halo ${user.firstName},
            
            Terima kasih telah mendaftar di FashionStore!
            
            Akun Anda telah berhasil dibuat dengan detail:
            - Email: ${user.email}
            - Nama: ${user.firstName} ${user.lastName}
            
            Selamat berbelanja!
            
            Tim FashionStore
        `

    this.sendEmail(user.email, subject, content)
  },

  sendPasswordResetEmail(user) {
    const subject = "Reset Password - FashionStore"
    const content = `
            Halo ${user.firstName},
            
            Kami menerima permintaan untuk reset password akun Anda.
            
            Klik link berikut untuk reset password:
            [Link Reset Password - Demo]
            
            Jika Anda tidak meminta reset password, abaikan email ini.
            
            Tim FashionStore
        `

    this.sendEmail(user.email, subject, content)
  },

  sendOrderConfirmation(user, transaction) {
    const subject = `Konfirmasi Pesanan #${transaction.id} - FashionStore`
    const content = `
            Halo ${user.firstName},
            
            Terima kasih atas pesanan Anda!
            
            Detail Pesanan:
            - ID Pesanan: #${transaction.id}
            - Total: Rp ${transaction.total.toLocaleString()}
            - Status: ${transaction.status}
            
            Pesanan Anda sedang diproses dan akan segera dikirim.
            
            Tim FashionStore
        `

    this.sendEmail(user.email, subject, content)
  },

  sendShippingNotification(user, transaction) {
    const subject = `Pesanan #${transaction.id} Dikirim - FashionStore`
    const content = `
            Halo ${user.firstName},
            
            Pesanan Anda telah dikirim!
            
            Detail Pengiriman:
            - ID Pesanan: #${transaction.id}
            - Nomor Resi: RESI${transaction.id}
            - Estimasi Tiba: 2-3 hari kerja
            
            Terima kasih telah berbelanja di FashionStore!
            
            Tim FashionStore
        `

    this.sendEmail(user.email, subject, content)
  },
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  initializeApp()
})

function initializeApp() {
  loadDataFromStorage()
  setupEventListeners()
  updateCartCount()
  WishlistSystem.updateWishlistCount()
  updateAuthMenu()

  // Initialize page-specific functionality
  const currentPage = getCurrentPage()
  switch (currentPage) {
    case "index":
      initializeHomePage()
      break
    case "catalog":
      initializeCatalogPage()
      break
    case "cart":
      initializeCartPage()
      break
    case "checkout":
      initializeCheckoutPage()
      break
    case "history":
      initializeHistoryPage()
      break
    case "articles":
      initializeArticlesPage()
      break
    case "wishlist":
      initializeWishlistPage()
      break
  }
}

function getCurrentPage() {
  const path = window.location.pathname
  const page = path.substring(path.lastIndexOf("/") + 1)
  return page.replace(".html", "") || "index"
}

// Data Management
function loadDataFromStorage() {
  // Load cart
  const savedCart = localStorage.getItem("cart")
  if (savedCart) {
    cart = JSON.parse(savedCart)
  }

  // Load products
  const savedProducts = localStorage.getItem("products")
  if (savedProducts) {
    products = JSON.parse(savedProducts)
  } else {
    products = getDefaultProducts()
    saveProducts()
  }

  // Load users
  const savedUsers = localStorage.getItem("users")
  if (savedUsers) {
    users = JSON.parse(savedUsers)
  } else {
    users = getDefaultUsers()
    saveUsers()
  }

  // Load transactions
  const savedTransactions = localStorage.getItem("transactions")
  if (savedTransactions) {
    transactions = JSON.parse(savedTransactions)
  } else {
    transactions = getDefaultTransactions()
    saveTransactions()
  }

  // Load current user
  const savedUser = localStorage.getItem("currentUser")
  if (savedUser) {
    currentUser = JSON.parse(savedUser)
  }
}

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart))
}

function saveProducts() {
  localStorage.setItem("products", JSON.stringify(products))
}

function saveUsers() {
  localStorage.setItem("users", JSON.stringify(users))
}

function saveTransactions() {
  localStorage.setItem("transactions", JSON.stringify(transactions))
}

function saveCurrentUser() {
  localStorage.setItem("currentUser", JSON.stringify(currentUser))
}

// Default Data
function getDefaultProducts() {
  return [
    {
      id: 1,
      name: "Kaos Polos Premium",
      category: "kaos",
      price: 89000,
      originalPrice: 120000,
      discount: 26,
      image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=800&fit=crop&crop=center&q=80",
      description: "Kaos polos premium dengan bahan cotton combed 30s yang nyaman dan berkualitas tinggi.",
      stock: 50,
      rating: 4.5,
      reviews: 128,
      sizes: ["S", "M", "L", "XL"],
      colors: ["Hitam", "Putih", "Abu-abu", "Merah"],
      featured: true,
    },
    {
      id: 2,
      name: "Kemeja Formal Slim Fit",
      category: "kemeja",
      price: 199000,
      originalPrice: 250000,
      discount: 20,
      image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&h=800&fit=crop&crop=center&q=80",
      description: "Kemeja formal dengan potongan slim fit yang elegan untuk acara formal maupun kasual.",
      stock: 30,
      rating: 4.7,
      reviews: 89,
      sizes: ["S", "M", "L", "XL", "XXL"],
      colors: ["Putih", "Biru", "Hitam"],
      featured: true,
    },
    {
      id: 3,
      name: "Celana Jeans Skinny",
      category: "celana",
      price: 299000,
      originalPrice: 350000,
      discount: 15,
      image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&h=800&fit=crop&crop=center&q=80",
      description: "Celana jeans skinny dengan bahan denim berkualitas tinggi dan desain modern.",
      stock: 25,
      rating: 4.3,
      reviews: 156,
      sizes: ["28", "29", "30", "31", "32", "33", "34"],
      colors: ["Dark Blue", "Light Blue", "Black"],
      featured: false,
    },
    {
      id: 4,
      name: "Jaket Hoodie Casual",
      category: "jaket",
      price: 179000,
      originalPrice: 220000,
      discount: 19,
      image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&h=800&fit=crop&crop=center&q=80",
      description: "Jaket hoodie casual dengan bahan fleece yang hangat dan nyaman untuk cuaca dingin.",
      stock: 40,
      rating: 4.6,
      reviews: 203,
      sizes: ["S", "M", "L", "XL", "XXL"],
      colors: ["Hitam", "Abu-abu", "Navy", "Maroon"],
      featured: true,
    },
    {
      id: 5,
      name: "Dress Casual Wanita",
      category: "dress",
      price: 159000,
      originalPrice: 200000,
      discount: 21,
      image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&h=800&fit=crop&crop=center&q=80",
      description: "Dress casual dengan desain feminin yang cocok untuk berbagai acara santai.",
      stock: 35,
      rating: 4.4,
      reviews: 92,
      sizes: ["S", "M", "L", "XL"],
      colors: ["Hitam", "Navy", "Merah", "Pink"],
      featured: false,
    },
    {
      id: 6,
      name: "Tas Ransel Laptop",
      category: "aksesoris",
      price: 249000,
      originalPrice: 300000,
      discount: 17,
      image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=800&fit=crop&crop=center&q=80",
      description: "Tas ransel dengan kompartemen khusus laptop hingga 15 inci dan desain yang stylish.",
      stock: 20,
      rating: 4.8,
      reviews: 67,
      sizes: ["One Size"],
      colors: ["Hitam", "Abu-abu", "Navy"],
      featured: true,
    },
    {
      id: 7,
      name: "Sepatu Sneakers Casual",
      category: "sepatu",
      price: 399000,
      originalPrice: 450000,
      discount: 11,
      image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&h=800&fit=crop&crop=center&q=80",
      description: "Sepatu sneakers casual dengan sol yang empuk dan desain yang trendy.",
      stock: 45,
      rating: 4.5,
      reviews: 234,
      sizes: ["39", "40", "41", "42", "43", "44"],
      colors: ["Putih", "Hitam", "Abu-abu"],
      featured: false,
    },
    {
      id: 8,
      name: "Topi Baseball Cap",
      category: "aksesoris",
      price: 79000,
      originalPrice: 100000,
      discount: 21,
      image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&h=800&fit=crop&crop=center&q=80",
      description: "Topi baseball cap dengan bahan berkualitas dan desain klasik yang timeless.",
      stock: 60,
      rating: 4.2,
      reviews: 145,
      sizes: ["One Size"],
      colors: ["Hitam", "Navy", "Putih", "Merah"],
      featured: false,
    },
  ]
}

function getDefaultUsers() {
  return [
    {
      id: 1,
      firstName: "Admin",
      lastName: "System",
      email: "admin@fashionstore.com",
      phone: "+62123456789",
      role: "admin",
      status: "active",
      registeredDate: "2024-01-01",
      address: "Jakarta, Indonesia",
    },
    {
      id: 2,
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@email.com",
      phone: "+62123456790",
      role: "customer",
      status: "active",
      registeredDate: "2024-01-15",
      address: "Bandung, Indonesia",
    },
    {
      id: 3,
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@email.com",
      phone: "+62123456791",
      role: "customer",
      status: "active",
      registeredDate: "2024-01-20",
      address: "Surabaya, Indonesia",
    },
  ]
}

function getDefaultTransactions() {
  return [
    {
      id: 1001,
      items: [
        {
          id: 1,
          name: "Kaos Polos Premium",
          price: 89000,
          quantity: 2,
          size: "M",
          color: "Hitam",
          image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=500&fit=crop",
        },
      ],
      total: 178000,
      status: "completed",
      date: "2024-01-15",
      shipping: {
        method: "Regular",
        cost: 0,
        address: {
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@email.com",
          phone: "+62123456790",
          address: "Jl. Sudirman No. 123",
          city: "Jakarta",
          postalCode: "12345",
        },
      },
    },
    {
      id: 1002,
      items: [
        {
          id: 2,
          name: "Kemeja Formal Slim Fit",
          price: 199000,
          quantity: 1,
          size: "L",
          color: "Putih",
          image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&h=500&fit=crop",
        },
      ],
      total: 199000,
      status: "processing",
      date: "2024-01-20",
      shipping: {
        method: "Express",
        cost: 15000,
        address: {
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@email.com",
          phone: "+62123456791",
          address: "Jl. Gatot Subroto No. 456",
          city: "Bandung",
          postalCode: "40123",
        },
      },
    },
  ]
}

// Event Listeners
function setupEventListeners() {
  // Mobile menu toggle
  const hamburger = document.querySelector(".hamburger")
  const navMenu = document.querySelector(".nav-menu")

  if (hamburger && navMenu) {
    hamburger.addEventListener("click", () => {
      hamburger.classList.toggle("active")
      navMenu.classList.toggle("active")
    })

    // Close menu when clicking on links
    const navLinks = document.querySelectorAll(".nav-menu a")
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        hamburger.classList.remove("active")
        navMenu.classList.remove("active")
      })
    })
  }

  // Close modals when clicking outside
  window.addEventListener("click", (event) => {
    const modals = document.querySelectorAll(".modal")
    modals.forEach((modal) => {
      if (event.target === modal) {
        modal.style.display = "none"
      }
    })
  })

  // Form validation
  const forms = document.querySelectorAll("form")
  forms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!form.checkValidity()) {
        event.preventDefault()
        event.stopPropagation()
      }
      form.classList.add("was-validated")
    })
  })
}

// Cart Functions
function addToCart(productId, size = "M", color = "Default", quantity = 1) {
  const product = products.find((p) => p.id === productId)
  if (!product) {
    alert("Produk tidak ditemukan!")
    return
  }

  if (product.stock < quantity) {
    alert("Stok tidak mencukupi!")
    return
  }

  const existingItem = cart.find((item) => item.id === productId && item.size === size && item.color === color)

  if (existingItem) {
    existingItem.quantity += quantity
  } else {
    cart.push({
      id: productId,
      name: product.name,
      price: product.price,
      image: product.image,
      size: size,
      color: color,
      quantity: quantity,
    })
  }

  saveCart()
  updateCartCount()
  showNotification("Produk berhasil ditambahkan ke keranjang!", "success")
}

function removeFromCart(productId, size, color) {
  cart = cart.filter((item) => !(item.id === productId && item.size === size && item.color === color))
  saveCart()
  updateCartCount()

  // Refresh cart page if we're on it
  if (getCurrentPage() === "cart") {
    displayCartItems()
  }
}

function updateCartQuantity(productId, size, color, newQuantity) {
  const item = cart.find((item) => item.id === productId && item.size === size && item.color === color)

  if (item) {
    if (newQuantity <= 0) {
      removeFromCart(productId, size, color)
    } else {
      item.quantity = newQuantity
      saveCart()
      updateCartCount()

      // Refresh cart page if we're on it
      if (getCurrentPage() === "cart") {
        displayCartItems()
      }
    }
  }
}

function clearCart() {
  cart = []
  saveCart()
  updateCartCount()

  if (getCurrentPage() === "cart") {
    displayCartItems()
  }
}

function updateCartCount() {
  const cartCountElements = document.querySelectorAll("#cart-count, .cart-count")
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)

  cartCountElements.forEach((element) => {
    element.textContent = totalItems
    element.style.display = totalItems > 0 ? "inline" : "none"
  })
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
}

// Product Functions
function getProducts() {
  return products
}

function getProduct(id) {
  return products.find((p) => p.id === id)
}

function addProduct(productData) {
  const newId = Math.max(...products.map((p) => p.id), 0) + 1
  const newProduct = {
    id: newId,
    ...productData,
    rating: 0,
    reviews: 0,
  }
  products.push(newProduct)
  saveProducts()
  return newProduct
}

function updateProduct(id, productData) {
  const index = products.findIndex((p) => p.id === id)
  if (index !== -1) {
    products[index] = { ...products[index], ...productData }
    saveProducts()
    return products[index]
  }
  return null
}

function removeProduct(id) {
  products = products.filter((p) => p.id !== id)
  saveProducts()
}

// User Functions
function getUsers() {
  return users
}

function getUser(id) {
  return users.find((u) => u.id === id)
}

function addUser(userData) {
  const newId = Math.max(...users.map((u) => u.id), 0) + 1
  const newUser = {
    id: newId,
    ...userData,
    registeredDate: new Date().toISOString().split("T")[0],
  }
  users.push(newUser)
  saveUsers()
  return newUser
}

function updateUser(id, userData) {
  const index = users.findIndex((u) => u.id === id)
  if (index !== -1) {
    users[index] = { ...users[index], ...userData }
    saveUsers()
    return users[index]
  }
  return null
}

function removeUser(id) {
  users = users.filter((u) => u.id !== id)
  saveUsers()
}

// Transaction Functions
function getTransactions() {
  return transactions
}

function getTransaction(id) {
  return transactions.find((t) => t.id === id)
}

function addTransaction(transactionData) {
  const newId = Math.max(...transactions.map((t) => t.id), 0) + 1
  const newTransaction = {
    id: newId,
    ...transactionData,
    date: new Date().toISOString().split("T")[0],
  }
  transactions.push(newTransaction)
  saveTransactions()
  return newTransaction
}

function updateTransaction(id, transactionData) {
  const index = transactions.findIndex((t) => t.id === id)
  if (index !== -1) {
    transactions[index] = { ...transactions[index], ...transactionData }
    saveTransactions()
    return transactions[index]
  }
  return null
}

function removeTransaction(id) {
  transactions = transactions.filter((t) => t.id !== id)
  saveTransactions()
}

// Page Initialization Functions
function initializeHomePage() {
  displayFeaturedProducts()
}

function initializeCatalogPage() {
  displayProducts()
  setupFilters()
}

function initializeCartPage() {
  displayCartItems()
}

function initializeCheckoutPage() {
  displayCheckoutSummary()
  setupCheckoutForm()
}

function initializeHistoryPage() {
  displayTransactionHistory()
}

function initializeArticlesPage() {
  displayArticles()
}

function initializeWishlistPage() {
  // This will be handled by wishlist.html's own script
}

// Product Display Functions
function displayFeaturedProducts() {
  const container = document.getElementById("featured-products")
  if (!container) return

  const featuredProducts = products.filter((p) => p.featured).slice(0, 4)

  container.innerHTML = featuredProducts.map((product) => createProductCard(product)).join("")
}

function displayProducts(productsToShow = products) {
  const container = document.getElementById("products-container")
  if (!container) return

  if (productsToShow.length === 0) {
    container.innerHTML = `
            <div class="text-center p-4">
                <h3>Tidak ada produk ditemukan</h3>
                <p>Coba ubah filter pencarian Anda</p>
            </div>
        `
    return
  }

  container.innerHTML = productsToShow.map((product) => createProductCard(product)).join("")
}

// Update createProductCard function to include wishlist button
function createProductCard(product) {
  const discountPrice = product.originalPrice ? product.originalPrice : null
  const hasDiscount = product.discount > 0
  const isInWishlist = WishlistSystem.isInWishlist(product.id)

  return `
        <div class="product-card">
            ${hasDiscount ? `<div class="discount-badge">-${product.discount}%</div>` : ""}
            <button class="wishlist-btn ${isInWishlist ? "active" : ""}" onclick="toggleWishlist(${product.id})" title="${isInWishlist ? "Hapus dari wishlist" : "Tambah ke wishlist"}">
                <i class="fas fa-heart"></i>
            </button>
            <img src="${product.image}" alt="${product.name}" class="product-image">
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-category">${product.category}</p>
                <div class="product-price">
                    <span class="current-price">Rp ${product.price.toLocaleString()}</span>
                    ${discountPrice ? `<span class="original-price">Rp ${discountPrice.toLocaleString()}</span>` : ""}
                </div>
                <div class="product-rating">
                    <div class="stars">
                        ${generateStars(product.rating)}
                    </div>
                    <span class="rating-text">(${product.reviews} reviews)</span>
                </div>
                <div class="product-actions">
                    <button class="btn-add-cart" onclick="addToCart(${product.id})">
                        <i class="fas fa-cart-plus"></i> Tambah ke Keranjang
                    </button>
                    <button class="btn-quick-view" onclick="quickView(${product.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        </div>
    `
}

// Add wishlist toggle function
function toggleWishlist(productId) {
  if (WishlistSystem.isInWishlist(productId)) {
    WishlistSystem.removeFromWishlist(productId)
  } else {
    WishlistSystem.addToWishlist(productId)
  }

  // Update wishlist button appearance
  const wishlistBtns = document.querySelectorAll(`.wishlist-btn`)
  wishlistBtns.forEach((btn) => {
    if (btn.onclick.toString().includes(productId)) {
      btn.classList.toggle("active")
      const icon = btn.querySelector("i")
      btn.title = btn.classList.contains("active") ? "Hapus dari wishlist" : "Tambah ke wishlist"
    }
  })
}

// Add review functions
function showReviewModal(productId) {
  if (!currentUser) {
    showNotification("Anda harus login untuk memberikan review!", "error")
    return
  }

  const product = getProduct(productId)
  if (!product) return

  const modal = document.createElement("div")
  modal.className = "modal"
  modal.style.display = "block"

  modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Review Produk: ${product.name}</h3>
                <button class="close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="review-form">
                    <div class="form-group">
                        <label>Rating:</label>
                        <div class="rating-input">
                            ${[1, 2, 3, 4, 5]
                              .map(
                                (star) => `
                                <i class="far fa-star rating-star" data-rating="${star}" onclick="setRating(${star})"></i>
                            `,
                              )
                              .join("")}
                        </div>
                        <input type="hidden" id="review-rating" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="review-comment">Komentar:</label>
                        <textarea id="review-comment" class="form-control" rows="4" placeholder="Bagikan pengalaman Anda dengan produk ini..." required></textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="this.closest('.modal').remove()">Batal</button>
                <button type="button" class="btn btn-primary" onclick="submitReview(${productId})">Kirim Review</button>
            </div>
        </div>
    `

  document.body.appendChild(modal)
}

function setRating(rating) {
  document.getElementById("review-rating").value = rating
  const stars = document.querySelectorAll(".rating-star")

  stars.forEach((star, index) => {
    if (index < rating) {
      star.className = "fas fa-star rating-star"
      star.style.color = "#f39c12"
    } else {
      star.className = "far fa-star rating-star"
      star.style.color = "#ddd"
    }
  })
}

function submitReview(productId) {
  const rating = Number.parseInt(document.getElementById("review-rating").value)
  const comment = document.getElementById("review-comment").value

  if (!rating) {
    showNotification("Silakan berikan rating!", "error")
    return
  }

  if (!comment.trim()) {
    showNotification("Silakan tulis komentar!", "error")
    return
  }

  const success = ReviewSystem.addReview(productId, { rating, comment })

  if (success) {
    document.querySelector(".modal").remove()
    // Refresh product display if on catalog page
    if (getCurrentPage() === "catalog") {
      displayProducts()
    }
  }
}

function displayProductReviews(productId) {
  const reviews = ReviewSystem.getReviews(productId)

  if (reviews.length === 0) {
    return `
            <div class="no-reviews">
                <p>Belum ada review untuk produk ini.</p>
                <button class="btn btn-primary" onclick="showReviewModal(${productId})">
                    Jadilah yang pertama memberikan review!
                </button>
            </div>
        `
  }

  return `
        <div class="reviews-section">
            <div class="reviews-header">
                <h4>Review Pelanggan (${reviews.length})</h4>
                <button class="btn btn-outline" onclick="showReviewModal(${productId})">
                    Tulis Review
                </button>
            </div>
            <div class="reviews-list">
                ${reviews
                  .map(
                    (review) => `
                    <div class="review-item">
                        <div class="review-header">
                            <div class="reviewer-info">
                                <strong>${review.userName}</strong>
                                <div class="review-rating">
                                    ${generateStars(review.rating)}
                                </div>
                            </div>
                            <div class="review-date">
                                ${formatDate(review.date)}
                            </div>
                        </div>
                        <div class="review-comment">
                            ${review.comment}
                        </div>
                        <div class="review-actions">
                            <button class="btn-helpful" onclick="markReviewHelpful(${review.id})">
                                <i class="fas fa-thumbs-up"></i> Membantu (${review.helpful || 0})
                            </button>
                        </div>
                    </div>
                `,
                  )
                  .join("")}
            </div>
        </div>
    `
}

function markReviewHelpful(reviewId) {
  if (ReviewSystem.markHelpful(reviewId)) {
    showNotification("Terima kasih atas feedback Anda!", "success")
    // Refresh reviews display
    const productId = getCurrentProductId() // You'd need to implement this
    if (productId) {
      // Refresh the reviews section
    }
  }
}

function generateStars(rating) {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 !== 0
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

  let stars = ""

  for (let i = 0; i < fullStars; i++) {
    stars += '<i class="fas fa-star"></i>'
  }

  if (hasHalfStar) {
    stars += '<i class="fas fa-star-half-alt"></i>'
  }

  for (let i = 0; i < emptyStars; i++) {
    stars += '<i class="far fa-star"></i>'
  }

  return stars
}

// Filter Functions
function setupFilters() {
  const categoryFilter = document.getElementById("category-filter")
  const priceMinFilter = document.getElementById("price-min")
  const priceMaxFilter = document.getElementById("price-max")
  const sortFilter = document.getElementById("sort-filter")
  const searchFilter = document.getElementById("search-filter")

  if (categoryFilter) categoryFilter.addEventListener("change", applyFilters)
  if (priceMinFilter) priceMinFilter.addEventListener("input", applyFilters)
  if (priceMaxFilter) priceMaxFilter.addEventListener("input", applyFilters)
  if (sortFilter) sortFilter.addEventListener("change", applyFilters)
  if (searchFilter) searchFilter.addEventListener("input", applyFilters)
}

function applyFilters() {
  let filteredProducts = [...products]

  // Category filter
  const category = document.getElementById("category-filter")?.value
  if (category) {
    filteredProducts = filteredProducts.filter((p) => p.category === category)
  }

  // Price filter
  const priceMin = Number.parseInt(document.getElementById("price-min")?.value) || 0
  const priceMax = Number.parseInt(document.getElementById("price-max")?.value) || Number.POSITIVE_INFINITY
  filteredProducts = filteredProducts.filter((p) => p.price >= priceMin && p.price <= priceMax)

  // Search filter
  const searchTerm = document.getElementById("search-filter")?.value.toLowerCase()
  if (searchTerm) {
    filteredProducts = filteredProducts.filter(
      (p) => p.name.toLowerCase().includes(searchTerm) || p.category.toLowerCase().includes(searchTerm),
    )
  }

  // Sort
  const sortBy = document.getElementById("sort-filter")?.value
  switch (sortBy) {
    case "price-low":
      filteredProducts.sort((a, b) => a.price - b.price)
      break
    case "price-high":
      filteredProducts.sort((a, b) => b.price - a.price)
      break
    case "name":
      filteredProducts.sort((a, b) => a.name.localeCompare(b.name))
      break
    case "rating":
      filteredProducts.sort((a, b) => b.rating - a.rating)
      break
    default:
      // Keep original order
      break
  }

  displayProducts(filteredProducts)
}

// Cart Display Functions
function displayCartItems() {
  const container = document.getElementById("cart-items")
  const summaryContainer = document.getElementById("cart-summary")

  if (!container) return

  if (cart.length === 0) {
    container.innerHTML = `
            <div class="text-center p-4">
                <i class="fas fa-shopping-cart" style="font-size: 4rem; color: #ccc; margin-bottom: 1rem;"></i>
                <h3>Keranjang Anda Kosong</h3>
                <p>Mulai berbelanja sekarang!</p>
                <a href="catalog.html" class="btn btn-primary">Lihat Produk</a>
            </div>
        `
    if (summaryContainer) summaryContainer.style.display = "none"
    return
  }

  container.innerHTML = cart.map((item) => createCartItemHTML(item)).join("")

  if (summaryContainer) {
    summaryContainer.style.display = "block"
    updateCartSummary()
  }
}

function createCartItemHTML(item) {
  return `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.name}" class="cart-item-image">
            <div class="cart-item-info">
                <h3 class="cart-item-name">${item.name}</h3>
                <p class="cart-item-details">Ukuran: ${item.size} | Warna: ${item.color}</p>
                <p class="cart-item-price">Rp ${item.price.toLocaleString()}</p>
            </div>
            <div class="quantity-controls">
                <button class="quantity-btn" onclick="updateCartQuantity(${item.id}, '${item.size}', '${item.color}', ${item.quantity - 1})">
                    <i class="fas fa-minus"></i>
                </button>
                <span class="quantity-display">${item.quantity}</span>
                <button class="quantity-btn" onclick="updateCartQuantity(${item.id}, '${item.size}', '${item.color}', ${item.quantity + 1})">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <button class="remove-item" onclick="removeFromCart(${item.id}, '${item.size}', '${item.color}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `
}

function updateCartSummary() {
  const subtotal = getCartTotal()
  const shipping = subtotal > 500000 ? 0 : 15000 // Free shipping over 500k
  const total = subtotal + shipping

  const summaryHTML = `
        <div class="summary-row">
            <span>Subtotal:</span>
            <span>Rp ${subtotal.toLocaleString()}</span>
        </div>
        <div class="summary-row">
            <span>Ongkos Kirim:</span>
            <span>${shipping === 0 ? "Gratis" : "Rp " + shipping.toLocaleString()}</span>
        </div>
        <div class="summary-row">
            <span>Total:</span>
            <span>Rp ${total.toLocaleString()}</span>
        </div>
        <a href="checkout.html" class="btn btn-primary w-100">Checkout</a>
    `

  document.getElementById("cart-summary").innerHTML = summaryHTML
}

// Checkout Functions
function displayCheckoutSummary() {
  const container = document.getElementById("checkout-summary")
  if (!container || cart.length === 0) return

  const subtotal = getCartTotal()
  const shipping = subtotal > 500000 ? 0 : 15000
  const total = subtotal + shipping

  const itemsHTML = cart
    .map(
      (item) => `
        <div class="checkout-item">
            <img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">
            <div style="flex: 1; margin-left: 1rem;">
                <h5>${item.name}</h5>
                <p>Ukuran: ${item.size} | Warna: ${item.color}</p>
                <p>Qty: ${item.quantity} x Rp ${item.price.toLocaleString()}</p>
            </div>
            <div>
                <strong>Rp ${(item.price * item.quantity).toLocaleString()}</strong>
            </div>
        </div>
    `,
    )
    .join("")

  container.innerHTML = `
        <h3>Ringkasan Pesanan</h3>
        <div class="checkout-items">
            ${itemsHTML}
        </div>
        <div class="checkout-totals">
            <div class="summary-row">
                <span>Subtotal:</span>
                <span>Rp ${subtotal.toLocaleString()}</span>
            </div>
            <div class="summary-row">
                <span>Ongkos Kirim:</span>
                <span>${shipping === 0 ? "Gratis" : "Rp " + shipping.toLocaleString()}</span>
            </div>
            <div class="summary-row" style="font-weight: bold; font-size: 1.2rem;">
                <span>Total:</span>
                <span>Rp ${total.toLocaleString()}</span>
            </div>
        </div>
    `
}

function setupCheckoutForm() {
  const form = document.getElementById("checkout-form")
  if (!form) return

  form.addEventListener("submit", (event) => {
    event.preventDefault()
    processCheckout()
  })

  // Setup payment method selection
  const paymentMethods = document.querySelectorAll(".payment-method")
  paymentMethods.forEach((method) => {
    method.addEventListener("click", function () {
      paymentMethods.forEach((m) => m.classList.remove("selected"))
      this.classList.add("selected")
    })
  })
}

// Update the processCheckout function to use PaymentSystem
async function processCheckout() {
  if (cart.length === 0) {
    alert("Keranjang Anda kosong!")
    return
  }

  // Show loading
  const submitBtn = document.querySelector('button[type="submit"]')
  const originalText = submitBtn.innerHTML
  submitBtn.innerHTML = '<i class="loading"></i> Memproses...'
  submitBtn.disabled = true

  try {
    // Get form data
    const formData = new FormData(document.getElementById("checkout-form"))
    const checkoutData = {
      shipping: {
        address: {
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          address: formData.get("address"),
          city: formData.get("city"),
          postalCode: formData.get("postalCode"),
        },
        method: formData.get("shipping") || "Regular",
      },
      paymentMethod: formData.get("payment") || "transfer",
    }

    // Process checkout
    const result = await PaymentSystem.processCheckout(checkoutData)

    if (result.success) {
      alert(`${result.message}\nID Transaksi: #${result.transaction.id}`)
      window.location.href = "history.html"
    } else {
      alert(result.message)
    }
  } catch (error) {
    alert("Terjadi kesalahan: " + error.message)
  } finally {
    // Reset button
    submitBtn.innerHTML = originalText
    submitBtn.disabled = false
  }
}

// Transaction History Functions
function displayTransactionHistory() {
  const container = document.getElementById("transaction-history")
  if (!container) return

  if (transactions.length === 0) {
    container.innerHTML = `
            <div class="text-center p-4">
                <i class="fas fa-receipt" style="font-size: 4rem; color: #ccc; margin-bottom: 1rem;"></i>
                <h3>Belum Ada Transaksi</h3>
                <p>Mulai berbelanja untuk melihat riwayat transaksi Anda</p>
                <a href="catalog.html" class="btn btn-primary">Mulai Belanja</a>
            </div>
        `
    return
  }

  container.innerHTML = transactions.map((transaction) => createTransactionCard(transaction)).join("")
}

function createTransactionCard(transaction) {
  const statusClass = `status-${transaction.status}`
  const statusText = getTransactionStatusText(transaction.status)

  return `
        <div class="transaction-card">
            <div class="transaction-header">
                <div>
                    <h3>Pesanan #${transaction.id}</h3>
                    <p>Tanggal: ${formatDate(transaction.date)}</p>
                </div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="transaction-items">
                ${transaction.items
                  .map(
                    (item) => `
                    <div class="transaction-item">
                        <img src="${item.image}" alt="${item.name}">
                        <div>
                            <h5>${item.name}</h5>
                            <p>Ukuran: ${item.size} | Warna: ${item.color}</p>
                            <p>Qty: ${item.quantity} x Rp ${item.price.toLocaleString()}</p>
                        </div>
                    </div>
                `,
                  )
                  .join("")}
            </div>
            <div class="transaction-footer">
                <div class="transaction-total">
                    <strong>Total: Rp ${transaction.total.toLocaleString()}</strong>
                </div>
                <div class="transaction-actions">
                    <button class="btn btn-outline" onclick="viewTransactionDetail(${transaction.id})">
                        Detail
                    </button>
                    ${
                      transaction.status === "pending"
                        ? `
                        <button class="btn btn-danger" onclick="cancelTransaction(${transaction.id})">
                            Batalkan
                        </button>
                    `
                        : ""
                    }
                </div>
            </div>
        </div>
    `
}

function getTransactionStatusText(status) {
  const statusMap = {
    pending: "Menunggu Pembayaran",
    processing: "Diproses",
    completed: "Selesai",
    cancelled: "Dibatalkan",
  }
  return statusMap[status] || status
}

function viewTransactionDetail(transactionId) {
  const transaction = getTransaction(transactionId)
  if (!transaction) return

  // Create and show transaction detail modal
  const modal = document.createElement("div")
  modal.className = "modal"
  modal.style.display = "block"

  modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Detail Pesanan #${transaction.id}</h3>
                <button class="close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="transaction-detail">
                    <h4>Informasi Pesanan</h4>
                    <p><strong>Status:</strong> ${getTransactionStatusText(transaction.status)}</p>
                    <p><strong>Tanggal:</strong> ${formatDate(transaction.date)}</p>
                    <p><strong>Total:</strong> Rp ${transaction.total.toLocaleString()}</p>
                    
                    <h4>Alamat Pengiriman</h4>
                    <p>${transaction.shipping.address.firstName} ${transaction.shipping.address.lastName}</p>
                    <p>${transaction.shipping.address.address}</p>
                    <p>${transaction.shipping.address.city}, ${transaction.shipping.address.postalCode}</p>
                    <p>Email: ${transaction.shipping.address.email}</p>
                    <p>Telepon: ${transaction.shipping.address.phone}</p>
                    
                    <h4>Item yang Dipesan</h4>
                    ${transaction.items
                      .map(
                        (item) => `
                        <div class="order-item">
                            <img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 5px;">
                            <div style="margin-left: 1rem;">
                                <h5>${item.name}</h5>
                                <p>Ukuran: ${item.size} | Warna: ${item.color}</p>
                                <p>Qty: ${item.quantity} x Rp ${item.price.toLocaleString()}</p>
                            </div>
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            </div>
        </div>
    `

  document.body.appendChild(modal)
}

function cancelTransaction(transactionId) {
  if (confirm("Apakah Anda yakin ingin membatalkan pesanan ini?")) {
    updateTransaction(transactionId, { status: "cancelled" })
    displayTransactionHistory()
    showNotification("Pesanan berhasil dibatalkan", "success")
  }
}

// Article Functions
function displayArticles() {
  // This would be implemented based on the articles page requirements
  // Similar to product display but for articles
}

// Quick View Function
function quickView(productId) {
  const product = getProduct(productId)
  if (!product) return

  const modal = document.createElement("div")
  modal.className = "modal"
  modal.style.display = "block"

  modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${product.name}</h3>
                <button class="close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <div>
                        <img src="${product.image}" alt="${product.name}" style="width: 100%; border-radius: 10px;">
                    </div>
                    <div>
                        <p class="product-category">${product.category.toUpperCase()}</p>
                        <h2>${product.name}</h2>
                        <div class="product-rating">
                            ${generateStars(product.rating)}
                            <span>(${product.reviews} reviews)</span>
                        </div>
                        <div class="product-price">
                            <span class="current-price">Rp ${product.price.toLocaleString()}</span>
                            ${product.originalPrice ? `<span class="original-price">Rp ${product.originalPrice.toLocaleString()}</span>` : ""}
                        </div>
                        <p>${product.description}</p>
                        
                        <div class="form-group">
                            <label>Ukuran:</label>
                            <select id="quick-view-size" class="form-control">
                                ${product.sizes.map((size) => `<option value="${size}">${size}</option>`).join("")}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Warna:</label>
                            <select id="quick-view-color" class="form-control">
                                ${product.colors.map((color) => `<option value="${color}">${color}</option>`).join("")}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Jumlah:</label>
                            <input type="number" id="quick-view-quantity" class="form-control" value="1" min="1" max="${product.stock}">
                        </div>
                        
                        <button class="btn btn-primary w-100" onclick="addToCartFromQuickView(${product.id})">
                            Tambah ke Keranjang
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `

  document.body.appendChild(modal)
}

function addToCartFromQuickView(productId) {
  const size = document.getElementById("quick-view-size").value
  const color = document.getElementById("quick-view-color").value
  const quantity = Number.parseInt(document.getElementById("quick-view-quantity").value)

  addToCart(productId, size, color, quantity)

  // Close modal
  document.querySelector(".modal").remove()
}

// Utility Functions
function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
  }).format(amount)
}

function showNotification(message, type = "info") {
  // Create notification element
  const notification = document.createElement("div")
  notification.className = `notification notification-${type}`
  notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === "success" ? "#27ae60" : type === "error" ? "#e74c3c" : "#3498db"};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 5px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 3000;
        animation: slideInRight 0.3s ease;
    `
  notification.textContent = message

  document.body.appendChild(notification)

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.3s ease"
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 300)
  }, 3000)
}

function updateAuthMenu() {
  const authMenus = document.querySelectorAll("#auth-menu")

  authMenus.forEach((authMenu) => {
    if (currentUser) {
      authMenu.innerHTML = `
                <div class="user-menu" style="display: flex; align-items: center; gap: 1rem;">
                    <span>Halo, ${currentUser.firstName}!</span>
                    <a href="#" onclick="AuthSystem.logout()">Logout</a>
                </div>
            `
    } else {
      authMenu.innerHTML = `<a href="login.html">Login</a>`
    }
  })
}

// Add CSS for notifications
const notificationStyles = document.createElement("style")
notificationStyles.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`
document.head.appendChild(notificationStyles)

// URL Parameter Helper
function getUrlParameter(name) {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get(name)
}

// Search Function
function searchProducts(query) {
  const searchTerm = query.toLowerCase()
  return products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm) ||
      product.category.toLowerCase().includes(searchTerm) ||
      product.description.toLowerCase().includes(searchTerm),
  )
}

// Wishlist Functions (for future implementation)
function addToWishlist(productId) {
  const wishlist = JSON.parse(localStorage.getItem("wishlist")) || []
  if (!wishlist.includes(productId)) {
    wishlist.push(productId)
    localStorage.setItem("wishlist", JSON.stringify(wishlist))
    showNotification("Produk ditambahkan ke wishlist!", "success")
  } else {
    showNotification("Produk sudah ada di wishlist!", "info")
  }
}

function removeFromWishlist(productId) {
  let wishlist = JSON.parse(localStorage.getItem("wishlist")) || []
  wishlist = wishlist.filter((id) => id !== productId)
  localStorage.setItem("wishlist", JSON.stringify(wishlist))
  showNotification("Produk dihapus dari wishlist!", "success")
}

// Review Functions (for future implementation)
function addReview(productId, rating, comment) {
  const product = getProduct(productId)
  if (!product) return

  // Update product rating (simplified calculation)
  const newReviewCount = product.reviews + 1
  const newRating = (product.rating * product.reviews + rating) / newReviewCount

  updateProduct(productId, {
    rating: Math.round(newRating * 10) / 10,
    reviews: newReviewCount,
  })

  showNotification("Review berhasil ditambahkan!", "success")
}

// Export functions for use in other files
window.FashionStore = {
  // Cart functions
  addToCart,
  removeFromCart,
  updateCartQuantity,
  clearCart,
  getCartTotal,

  // Product functions
  getProducts,
  getProduct,
  addProduct,
  updateProduct,
  removeProduct,

  // User functions
  getUsers,
  getUser,
  addUser,
  updateUser,
  removeUser,

  // Transaction functions
  getTransactions,
  getTransaction,
  addTransaction,
  updateTransaction,
  removeTransaction,

  // Utility functions
  formatDate,
  formatCurrency,
  showNotification,
  searchProducts,

  // Wishlist functions
  addToWishlist,
  removeFromWishlist,

  // Review functions
  addReview,
}

// Export new systems to global scope
window.AuthSystem = AuthSystem
window.WishlistSystem = WishlistSystem
window.ReviewSystem = ReviewSystem
window.PaymentSystem = PaymentSystem
window.EmailSystem = EmailSystem
window.toggleWishlist = toggleWishlist
window.showReviewModal = showReviewModal
window.setRating = setRating
window.submitReview = submitReview
window.markReviewHelpful = markReviewHelpful

// Implement getCurrentProductId function (example)
function getCurrentProductId() {
  // This is a placeholder - replace with your actual logic
  // to extract the product ID from the current page URL or context.
  // For example, if your URL is like: product.html?id=123
  const urlParams = new URLSearchParams(window.location.search)
  return Number.parseInt(urlParams.get("id"))
}

// Initialize app when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp)
} else {
  initializeApp()
}
