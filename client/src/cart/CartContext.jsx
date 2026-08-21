import React from 'react';

const CartContext = React.createContext(null);
const STORAGE_KEY = 'keno_cart';

// Cart items are shaped as: { itemId, name, sku, imageUrl, unitPrice, memberPrice, quantity }
// Persisted to localStorage only (no backend cart table) -- "Place order" sends the whole
// array to the existing multi-item POST /orders endpoint in one call, then the cart is cleared.
export function CartProvider({ children }) {
  const [items, setItems] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const toCartLine = (item, quantity) => ({
    itemId: item.id ?? item.itemId,
    name: item.name,
    sku: item.sku,
    imageUrl: item.imageUrl ?? item.image_url ?? null,
    unitPrice: Number(item.unitPrice ?? item.unit_price),
    memberPrice: Number(item.memberPrice ?? item.member_price),
    quantity,
  });

  const addItem = (item, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.itemId === (item.id ?? item.itemId));
      if (existing) {
        return prev.map((i) => (i.itemId === existing.itemId ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [...prev, toCartLine(item, quantity)];
    });
  };

  const updateQuantity = (itemId, quantity) => {
    setItems((prev) => (quantity <= 0
      ? prev.filter((i) => i.itemId !== itemId)
      : prev.map((i) => (i.itemId === itemId ? { ...i, quantity } : i))));
  };

  // Swaps one cart line for a different catalogue item (used by the substitution flow),
  // keeping the same quantity and position in the cart.
  const replaceItem = (oldItemId, newItem, quantity) => {
    setItems((prev) => prev.map((i) => (i.itemId === oldItemId ? toCartLine(newItem, quantity ?? i.quantity) : i)));
  };

  const removeItem = (itemId) => setItems((prev) => prev.filter((i) => i.itemId !== itemId));
  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalMemberPrice = items.reduce((sum, i) => sum + i.quantity * i.memberPrice, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const value = { items, addItem, updateQuantity, replaceItem, removeItem, clearCart, totalItems, totalMemberPrice, totalPrice };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
