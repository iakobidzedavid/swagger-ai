import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSearchParams } from 'next/navigation'
import OrderConfirmationPage, { OrderConfirmationContent } from '../page'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}))

// Mock fetch globally
global.fetch = jest.fn()

describe('OrderConfirmationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  it('renders loading state on initial load', () => {
    const mockSearchParams = new URLSearchParams('orderId=test-123')
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)

    render(<OrderConfirmationPage />)

    expect(screen.getByText(/loading order confirmation/i)).toBeInTheDocument()
  })

  it('renders order summary and tracking details when data loads', async () => {
    const mockOrderData = {
      id: 'order-123',
      customerEmail: 'customer@example.com',
      customerName: 'John Doe',
      totalAmount: 149.99,
      swaggerFee: 27.0,
      status: 'completed',
      createdAt: '7/3/2026',
      items: [
        {
          productName: 'Premium Hoodie',
          productSku: 'HOODIE-001',
          quantity: 2,
          totalPrice: 99.98,
        },
      ],
      trackingNumber: 'TRK123456789',
      trackingCarrier: 'FedEx',
      trackingUrl: 'https://tracking.fedex.com/TRK123456789',
      shippedAt: '7/4/2026',
    }

    const mockSearchParams = new URLSearchParams('orderId=order-123')
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, order: mockOrderData }),
    })

    render(<OrderConfirmationPage />)

    // Wait for order data to load
    await waitFor(() => {
      expect(screen.getByText(/thank you/i)).toBeInTheDocument()
    })

    // Verify order details are displayed
    expect(screen.getByText(/order-123/i)).toBeInTheDocument()
    expect(screen.getByText(/customer@example.com/i)).toBeInTheDocument()
    expect(screen.getByText(/premium hoodie/i)).toBeInTheDocument()
    expect(screen.getByText(/\$149\.99/)).toBeInTheDocument()

    // Verify tracking information is displayed
    expect(screen.getByText(/TRK123456789/)).toBeInTheDocument()
    expect(screen.getByText(/FedEx/)).toBeInTheDocument()
    expect(screen.getByText(/track shipment/i)).toBeInTheDocument()

    // Verify tracking link is present and points to carrier
    const trackingLink = screen.getByRole('link', { name: /track shipment/i })
    expect(trackingLink).toHaveAttribute('href', 'https://tracking.fedex.com/TRK123456789')
  })

  it('renders error state when order fetch fails', async () => {
    const mockSearchParams = new URLSearchParams('orderId=invalid-id')
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: 'Order not found' }),
    })

    render(<OrderConfirmationPage />)

    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/order not found/i)).toBeInTheDocument()
    })

    // Verify "Return Home" link is present
    const homeLink = screen.getByRole('link', { name: /return home/i })
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('renders error state when orderId is missing', async () => {
    const mockSearchParams = new URLSearchParams('')
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)

    render(<OrderConfirmationPage />)

    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/no order id provided/i)).toBeInTheDocument()
    })

    // Verify "Return Home" link is present
    const homeLink = screen.getByRole('link', { name: /return home/i })
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('copy button copies order ID to clipboard', async () => {
    const mockOrderData = {
      id: 'order-abc123',
      customerEmail: 'test@example.com',
      customerName: 'Test User',
      totalAmount: 99.99,
      swaggerFee: 18.0,
      status: 'processing',
      createdAt: '7/3/2026',
      items: [],
    }

    const mockSearchParams = new URLSearchParams('orderId=order-abc123')
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, order: mockOrderData }),
    })

    // Mock clipboard API
    const mockClipboard = {
      writeText: jest.fn().mockResolvedValue(undefined),
    }
    Object.assign(navigator, { clipboard: mockClipboard })

    render(<OrderConfirmationPage />)

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText(/thank you/i)).toBeInTheDocument()
    })

    // Click copy button
    const copyButtons = screen.getAllByRole('button', { name: /copy/i })
    await userEvent.click(copyButtons[0])

    // Verify clipboard API was called
    expect(mockClipboard.writeText).toHaveBeenCalledWith('order-abc123')
  })

  it('displays order status timeline with correct progression', async () => {
    const mockOrderData = {
      id: 'order-123',
      customerEmail: 'customer@example.com',
      customerName: 'John Doe',
      totalAmount: 149.99,
      swaggerFee: 27.0,
      status: 'completed',
      createdAt: '7/3/2026',
      items: [],
      trackingNumber: 'TRK123456789',
      trackingCarrier: 'FedEx',
      shippedAt: '7/4/2026',
      deliveredAt: '7/5/2026',
    }

    const mockSearchParams = new URLSearchParams('orderId=order-123')
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, order: mockOrderData }),
    })

    render(<OrderConfirmationPage />)

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText(/order status timeline/i)).toBeInTheDocument()
    })

    // Verify all timeline steps are visible
    expect(screen.getByText(/order placed/i)).toBeInTheDocument()
    expect(screen.getByText(/processing/i)).toBeInTheDocument()
    expect(screen.getByText(/shipped/i)).toBeInTheDocument()
    expect(screen.getByText(/delivered/i)).toBeInTheDocument()
  })

  it('renders all product items correctly', async () => {
    const mockOrderData = {
      id: 'order-123',
      customerEmail: 'customer@example.com',
      customerName: 'John Doe',
      totalAmount: 249.97,
      swaggerFee: 45.0,
      status: 'processing',
      createdAt: '7/3/2026',
      items: [
        {
          productName: 'Premium T-Shirt',
          productSku: 'TSHIRT-001',
          quantity: 2,
          totalPrice: 39.98,
        },
        {
          productName: 'Hoodie',
          productSku: 'HOODIE-001',
          quantity: 1,
          totalPrice: 49.99,
        },
        {
          productName: 'Coffee Mug',
          productSku: 'MUG-001',
          quantity: 3,
          totalPrice: 29.97,
        },
      ],
    }

    const mockSearchParams = new URLSearchParams('orderId=order-123')
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, order: mockOrderData }),
    })

    render(<OrderConfirmationPage />)

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText(/thank you/i)).toBeInTheDocument()
    })

    // Verify all items are displayed
    expect(screen.getByText(/premium t-shirt/i)).toBeInTheDocument()
    expect(screen.getByText(/hoodie/i)).toBeInTheDocument()
    expect(screen.getByText(/coffee mug/i)).toBeInTheDocument()

    // Verify quantities and prices
    expect(screen.getByText(/qty: 2/i)).toBeInTheDocument()
    expect(screen.getByText(/qty: 1/i)).toBeInTheDocument()
    expect(screen.getByText(/qty: 3/i)).toBeInTheDocument()

    expect(screen.getByText(/\$39\.98/)).toBeInTheDocument()
    expect(screen.getByText(/\$49\.99/)).toBeInTheDocument()
    expect(screen.getByText(/\$29\.97/)).toBeInTheDocument()
  })
})
