'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface CartProduct {
  id: string
  title: string
  sku: string
  image: string
  variants: Array<{ id: string; title: string; price: number }>
}

export interface CartItem {
  productId: string
  variantId: string
  quantity: number
  product: CartProduct
  unitPrice: number
}

export interface Cart {
  items: CartItem[]
  totalItems: number
  totalPrice: number
}

interface CartContextType {
  cart: Cart
  addToCart: (product: CartProduct, variantId: string, unitPrice: number, quantity?: number) => void
  removeFromCart: (productId: string, variantId: string) => void
  updateQuantity: (productId: string, variantId: string, quantity: number) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_STORAGE_KEY = 'swagger-ai-cart'

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>({
    items: [],
    totalItems: 0,
    totalPrice: 0,
  })

  const [isHydrated, setIsHydrated] = useState(false)

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setCart(parsed)
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
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
      } catch (err) {
        console.error('Failed to save cart to storage:', err)
      }
    }
  }, [cart, isHydrated])

  const calculateTotals = (items: CartItem[]) => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
    const totalPrice = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    return { totalItems, totalPrice }
  }

  const addToCart = (product: CartProduct, variantId: string, unitPrice: number, quantity: number = 1) => {
    setCart(prev => {
      const existingItem = prev.items.find(
        item => item.productId === product.id && item.variantId === variantId
      )

      let newItems: CartItem[]

      if (existingItem) {
        // Update quantity if item already in cart
        newItems = prev.items.map(item =>
          item.productId === product.id && item.variantId === variantId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      } else {
        // Add new item
        newItems = [
          ...prev.items,
          {
            productId: product.id,
            variantId,
            quantity,
            product,
            unitPrice,
          },
        ]
      }

      const { totalItems, totalPrice } = calculateTotals(newItems)

      return {
        items: newItems,
        totalItems,
        totalPrice,
      }
    })
  }

  const removeFromCart = (productId: string, variantId: string) => {
    setCart(prev => {
      const newItems = prev.items.filter(
        item => !(item.productId === productId && item.variantId === variantId)
      )

      const { totalItems, totalPrice } = calculateTotals(newItems)

      return {
        items: newItems,
        totalItems,
        totalPrice,
      }
    })
  }

  const updateQuantity = (productId: string, variantId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantId)
      return
    }

    setCart(prev => {
      const newItems = prev.items.map(item =>
        item.productId === productId && item.variantId === variantId
          ? { ...item, quantity }
          : item
      )

      const { totalItems, totalPrice } = calculateTotals(newItems)

      return {
        items: newItems,
        totalItems,
        totalPrice,
      }
    })
  }

  const clearCart = () => {
    setCart({
      items: [],
      totalItems: 0,
      totalPrice: 0,
    })
  }

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart }}>
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
