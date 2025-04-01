import { createSlice, createStore, combineSlices } from "../../store";

// ==========================================================
// Define slice interfaces
// ==========================================================

/**
 * User-related state and actions
 */
interface UserSlice {
  user: UserState | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => void;
  logout: () => void;
  updateProfile: (data: Partial<UserState>) => void;
}

/**
 * Shopping cart state and actions
 */
interface CartSlice {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  addItem: (product: Product, quantity: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
}

/**
 * UI state and actions
 */
interface UISlice {
  theme: "light" | "dark";
  sidebarOpen: boolean;
  notifications: Notification[];
  toggleTheme: () => void;
  toggleSidebar: () => void;
  addNotification: (notification: Notification) => void;
  dismissNotification: (id: string) => void;
}

// Combined store type
type AppState = UserSlice & CartSlice & UISlice;

// ==========================================================
// Type definitions for the data models
// ==========================================================

interface UserState {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
  autoClose?: boolean;
}

// ==========================================================
// Create individual slices
// ==========================================================

/**
 * Creates a slice for managing user state and authentication
 */
const createUserSlice = <T>() =>
  createSlice<T, UserSlice>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,

    login: (email: string, password: string) => {
      // Set loading state
      set({ isLoading: true, error: null } as any, false, "login_start");

      // Simulate API call
      setTimeout(() => {
        try {
          // Mock successful login
          if (email === "user@example.com" && password === "password") {
            const user = {
              id: "1",
              email: "user@example.com",
              name: "Test User",
            };
            set(
              { user, isAuthenticated: true, isLoading: false } as any,
              false,
              "login_success",
            );
          } else {
            // Mock failed login
            set(
              { error: "Invalid credentials", isLoading: false } as any,
              false,
              "login_error",
            );
          }
        } catch (error) {
          set(
            { error: "An error occurred", isLoading: false } as any,
            false,
            "login_error",
          );
        }
      }, 1000);
    },

    logout: () => {
      set({ user: null, isAuthenticated: false } as any, false, "logout");
    },

    updateProfile: (data) => {
      set(
        (state) => {
          if (!(state as any).user) return {} as any;

          return {
            user: { ...(state as any).user, ...data },
          } as any;
        },
        false,
        "update_profile",
      );
    },
  }));

/**
 * Creates a slice for managing shopping cart
 */
const createCartSlice = <T>() =>
  createSlice<T, CartSlice>((set, get) => ({
    items: [],
    totalItems: 0,
    totalPrice: 0,
    isOpen: false,

    addItem: (product, quantity) => {
      set(
        (state) => {
          const items = [...(state as any).items];
          const existingItemIndex = items.findIndex(
            (item) => item.product.id === product.id,
          );

          if (existingItemIndex >= 0) {
            // Update existing item quantity
            const existingItem = items[existingItemIndex];
            items[existingItemIndex] = {
              ...existingItem,
              quantity: existingItem.quantity + quantity,
            };
          } else {
            // Add new item
            items.push({ product, quantity });
          }

          // Calculate new totals
          const totalItems = items.reduce(
            (sum: number, item: CartItem) => sum + item.quantity,
            0,
          );
          const totalPrice = items.reduce(
            (sum: number, item: CartItem) =>
              sum + item.product.price * item.quantity,
            0,
          );

          return { items, totalItems, totalPrice } as any;
        },
        false,
        "add_to_cart",
      );
    },

    removeItem: (productId) => {
      set(
        (state) => {
          const items = (state as any).items.filter(
            (item: CartItem) => item.product.id !== productId,
          );

          // Calculate new totals
          const totalItems = items.reduce(
            (sum: number, item: CartItem) => sum + item.quantity,
            0,
          );
          const totalPrice = items.reduce(
            (sum: number, item: CartItem) =>
              sum + item.product.price * item.quantity,
            0,
          );

          return { items, totalItems, totalPrice } as any;
        },
        false,
        "remove_from_cart",
      );
    },

    updateQuantity: (productId, quantity) => {
      set(
        (state) => {
          const items = [...(state as any).items];
          const itemIndex = items.findIndex(
            (item) => item.product.id === productId,
          );

          if (itemIndex >= 0) {
            if (quantity <= 0) {
              // Remove item if quantity is zero or negative
              items.splice(itemIndex, 1);
            } else {
              // Update quantity
              items[itemIndex] = {
                ...items[itemIndex],
                quantity,
              };
            }

            // Calculate new totals
            const totalItems = items.reduce(
              (sum: number, item: CartItem) => sum + item.quantity,
              0,
            );
            const totalPrice = items.reduce(
              (sum: number, item: CartItem) =>
                sum + item.product.price * item.quantity,
              0,
            );

            return { items, totalItems, totalPrice } as any;
          }
          return {} as any;
        },
        false,
        "update_cart_quantity",
      );
    },

    clearCart: () => {
      set(
        { items: [], totalItems: 0, totalPrice: 0 } as any,
        false,
        "clear_cart",
      );
    },

    toggleCart: () => {
      set(
        (state) => ({ isOpen: !(state as any).isOpen }) as any,
        false,
        "toggle_cart",
      );
    },
  }));

/**
 * Creates a slice for managing UI state
 */
const createUISlice = <T>() =>
  createSlice<T, UISlice>((set) => ({
    theme: "light",
    sidebarOpen: false,
    notifications: [],

    toggleTheme: () => {
      set(
        (state) =>
          ({
            theme: (state as any).theme === "light" ? "dark" : "light",
          }) as any,
        false,
        "toggle_theme",
      );
    },

    toggleSidebar: () => {
      set(
        (state) =>
          ({
            sidebarOpen: !(state as any).sidebarOpen,
          }) as any,
        false,
        "toggle_sidebar",
      );
    },

    addNotification: (notification) => {
      set(
        (state) =>
          ({
            notifications: [
              ...(state as any).notifications,
              { ...notification, id: notification.id || Date.now().toString() },
            ],
          }) as any,
        false,
        "add_notification",
      );

      // Auto-dismiss notification if needed
      if (notification.autoClose) {
        setTimeout(() => {
          useStore.getState().dismissNotification(notification.id);
        }, 5000);
      }
    },

    dismissNotification: (id) => {
      set(
        (state) =>
          ({
            notifications: (state as any).notifications.filter(
              (n: Notification) => n.id !== id,
            ),
          }) as any,
        false,
        "dismiss_notification",
      );
    },
  }));

// ==========================================================
// Create the store with all slices
// ==========================================================

// Use the combineSlices helper to create a store with all slices
export const useStore = createStore<AppState>(
  combineSlices({
    user: createUserSlice<AppState>(),
    cart: createCartSlice<AppState>(),
    ui: createUISlice<AppState>(),
  }),
);

// ==========================================================
// Usage examples
// ==========================================================

// Example: Login process
function loginExample() {
  // Get the current store state
  const { isAuthenticated, isLoading, error } = useStore.getState();
  console.log("Auth status:", { isAuthenticated, isLoading, error });

  // Trigger login action
  useStore.getState().login("user@example.com", "password");
  console.log("Login initiated");

  // In a real app, you'd use useEffect or subscribe to handle state changes
  // This is a simulation for the example
  setTimeout(() => {
    const { user, isAuthenticated, isLoading, error } = useStore.getState();
    console.log("Auth result:", { user, isAuthenticated, isLoading, error });
  }, 1500);
}

// Example: Shopping cart operations
function cartExample() {
  // Create some example products
  const products = [
    { id: "1", name: "Product 1", price: 10, image: "product1.jpg" },
    { id: "2", name: "Product 2", price: 20, image: "product2.jpg" },
  ];

  // Add products to cart
  useStore.getState().addItem(products[0], 2);
  useStore.getState().addItem(products[1], 1);

  // Check cart state
  const { items, totalItems, totalPrice } = useStore.getState();
  console.log("Cart:", { items, totalItems, totalPrice });

  // Update quantity
  useStore.getState().updateQuantity("1", 3);

  // Show updated totals
  const updatedCart = useStore.getState();
  console.log("Updated cart:", {
    items: updatedCart.items,
    totalItems: updatedCart.totalItems,
    totalPrice: updatedCart.totalPrice,
  });
}

// Example: Theme toggling and notifications
function uiExample() {
  // Get current theme
  const { theme } = useStore.getState();
  console.log("Current theme:", theme);

  // Toggle theme
  useStore.getState().toggleTheme();
  console.log("New theme:", useStore.getState().theme);

  // Add a notification
  useStore.getState().addNotification({
    id: "notification-1",
    type: "success",
    message: "Theme updated successfully!",
    autoClose: true,
  });

  // Check notifications
  console.log("Notifications:", useStore.getState().notifications);
}
