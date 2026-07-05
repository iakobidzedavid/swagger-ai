'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
  type CartProduct,
  type CartItem,
  type Cart,
  toCart,
  addItem,
  removeItem,
  updateItemQuantity,
  clearItems,
  itemsForDomain,
  sanitizeLoadedItems,
} from '@/lib/cart'

export type { CartProduct, CartItem, Cart }

interface CartContextType {
  /** Raw cart across ALL storefronts ever added in this browser. Prefer `cartForDomain`. */
  cart: Cart
  /** True once the cart has been read back from localStorage. Callers that
   * decide "is the cart empty?" (e.g. checkout's empty-cart bounce screen)
   * MUST wait for this to be true first — otherwise the transient
   * pre-hydration empty state gets mistaken for a genuinely empty cart and
   * the user gets bounced back before their real items load. */
  isHydrated: boolean
  addToCart: (domain: string, product: CartProduct, variantId: string, unitPrice: number, quantity?: number) => void
  removeFromCart: (domain: string, productId: string, variantId: string) => void
  updateQuantity: (domain: string, productId: string, variantId: string, quantity: number) => void
  clearCart: (domain?: string) => void
  /** Cart scoped to a single storefront's domain — what /cart and /checkout should render/charge. */
  cartForDomain: (domain: string) => Cart
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_STORAGE_KEY = 'swagger-ai-cart'

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isHydrated, setIsHydrated] = useState(false)

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY)
      if (stored) {
        setItems(sanitizeLoadedItems(JSON.parse(stored)))
      }
    } catch (err) {
      console.error('Failed to load cart from storage:', err)
    }
    setIsHydrated(true)
  }, [])

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(toCart(items)))
      } catch (err) {
        console.error('Failed to save cart to storage:', err)
      }
    }
  }, [items, isHydrated])

  const addToCart = (domain: string, product: CartProduct, variantId: string, unitPrice: number, quantity: number = 1) => {
    setItems(prev => addItem(prev, domain, product, variantId, unitPrice, quantity))
  }

  const removeFromCart = (domain: string, productId: string, variantId: string) => {
    setItems(prev => removeItem(prev, domain, productId, variantId))
  }

  const updateQuantity = (domain: string, productId: string, variantId: string, quantity: number) => {
    setItems(prev => updateItemQuantity(prev, domain, productId, variantId, quantity))
  }

  const clearCart = (domain?: string) => {
    setItems(prev => clearItems(prev, domain))
  }

  const cartForDomain = (domain: string): Cart => toCart(itemsForDomain(items, domain))

  return (
    <CartContext.Provider
      value={{ cart: toCart(items), isHydrated, addToCart, removeFromCart, updateQuantity, clearCart, cartForDomain }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
