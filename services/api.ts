import { Assignment, DeliveryPartner, Location, LoginResponse, Order } from '../types';

const API_BASE_URL = 'https://test.api.marktcommerce.com/api/v1/deliveries';
const USE_MOCK = false;

const MOCK_PARTNERS: Record<string, DeliveryPartner> = {
  '9876543210': {
    id: 'partner_001',
    name: 'Rajesh Kumar',
    vehicleType: 'BIKE',
    rating: 4.8,
    status: 'ONLINE',
  },
  '9123456789': {
    id: 'partner_002',
    name: 'Priya Singh',
    vehicleType: 'SCOOTER',
    rating: 4.9,
    status: 'OFFLINE',
  },
  '8765432109': {
    id: 'partner_003',
    name: 'Amit Patel',
    vehicleType: 'CAR',
    rating: 4.7,
    status: 'OFFLINE',
  },
};

const MOCK_ORDERS: Order[] = [
  {
    orderId: 'ord_001',
    pickup: { lat: 28.7041, lng: 77.1025 },
    dropoff: { lat: 28.5244, lng: 77.1855 },
    distanceMeters: 15000,
    estimatedEarnings: 125,
  },
  {
    orderId: 'ord_002',
    pickup: { lat: 28.6139, lng: 77.209 },
    dropoff: { lat: 28.6245, lng: 77.2163 },
    distanceMeters: 8000,
    estimatedEarnings: 85,
  },
  {
    orderId: 'ord_003',
    pickup: { lat: 28.5355, lng: 77.391 },
    dropoff: { lat: 28.5244, lng: 77.1855 },
    distanceMeters: 20000,
    estimatedEarnings: 150,
  },
];

class ApiService {
  private sessionToken: string | null = null;

  setSessionToken(token: string) {
    this.sessionToken = token;
  }

  async sendOtp(phoneNumber: string): Promise<{ message: string; status: string }> {
    if (USE_MOCK) {
      return this.mockSendOtp(phoneNumber);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error('Failed to send OTP');
    }
  }

  private async mockSendOtp(phoneNumber: string): Promise<{ message: string; status: string }> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      message: '123456',
      status: 'success',
    };
  }

  async login(phone: string, otp: string): Promise<LoginResponse> {
    if (USE_MOCK) {
      return this.mockLogin(phone, otp);
    }

    console.log("Attempting login with phone:", phone, "and OTP:", otp);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, otp }),
      });

      const data = await response.json();
      this.sessionToken = data.sessionToken;
      return data;
    } catch (error) {
      throw new Error('Login failed');
    }
  }

  private async mockLogin(phone: string, otp: string): Promise<LoginResponse> {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (otp !== '123456') {
      throw new Error('Invalid OTP');
    }

    let partner = MOCK_PARTNERS[phone];
    if (!partner) {
      partner = {
        id: `partner_${phone}`,
        name: `Partner ${phone.slice(-4)}`,
        vehicleType: (['BIKE', 'SCOOTER', 'CAR'][Math.floor(Math.random() * 3)] as any),
        rating: 4.5 + Math.random(),
        status: 'OFFLINE',
      };
    }

    const sessionToken = `session_${phone}_${Date.now()}`;
    this.sessionToken = sessionToken;

    return {
      partner,
      sessionToken,
    };
  }

  async updatePartnerStatus(status: 'ONLINE' | 'OFFLINE'): Promise<void> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/delivery-partners/me/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.sessionToken}`,
        },
        body: JSON.stringify({ status }),
      });
    } catch (error) {
      throw new Error('Failed to update status');
    }
  }

  async reportLocation(location: Location): Promise<void> {
    if (USE_MOCK) {
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/partners/me/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.sessionToken}`,
        },
        body: JSON.stringify(location),
      });
    } catch (error) {
      console.error('Failed to report location:', error);
    }
  }

  async getAvailableOrders(): Promise<Order[]> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return MOCK_ORDERS;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/orders/available`, {
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });
      const data = await response.json();
      return data.orders;
    } catch (error) {
      throw new Error('Failed to fetch orders');
    }
  }

  async acceptOrder(orderId: string): Promise<Assignment> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const order = MOCK_ORDERS.find((o) => o.orderId === orderId);
      if (!order) throw new Error('Order not found');

      return {
        assignmentId: `as_${Date.now()}`,
        orderId,
        pickup: order.pickup,
        dropoff: order.dropoff,
        status: 'EN_ROUTE_TO_PICKUP',
      };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/delivery/orders/${orderId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });
      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error('Failed to accept order');
    }
  }

  async getActiveAssignment(): Promise<Assignment | null> {
    if (USE_MOCK) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/delivery/assignments/active`, {
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });
      const data = await response.json();
      return data || null;
    } catch (error) {
      return null;
    }
  }

  async updateAssignmentStatus(
    assignmentId: string,
    status: string
  ): Promise<void> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/delivery/assignments/${assignmentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.sessionToken}`,
        },
        body: JSON.stringify({ status }),
      });
    } catch (error) {
      throw new Error('Failed to update assignment status');
    }
  }

  async generateQRToken(orderId: string): Promise<string> {
    if (USE_MOCK) {
      return `QR_${orderId}_${Date.now()}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/delivery/orders/${orderId}/qr`, {
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });
      const data = await response.json();
      return data.token;
    } catch (error) {
      throw new Error('Failed to generate QR');
    }
  }

  async confirmDelivery(orderId: string): Promise<void> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/delivery/orders/${orderId}/qr/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });
    } catch (error) {
      throw new Error('Failed to confirm delivery');
    }
  }

  async getActiveAssignments(): Promise<any[]> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return [
        {
          assignmentId: 'as_001',
          orderId: 'ord_001',
          pickup: { lat: 28.7041, lng: 77.1025 },
          dropoff: { lat: 28.5244, lng: 77.1855 },
          distanceMeters: 15000,
          estimatedEarnings: 125,
          estimatedDuration: 25,
          status: 'in_transit',
          pickupAddress: 'Green Gourmet Market, West 4th St, Manhattan',
          deliveryAddress: 'Chelsea Gardens Apts, Bldg 4, Apt 12C',
          sellerName: 'Green Gourmet Market',
          buyerName: 'John Doe',
          qrToken: 'frpdha34390293'
        },
        {
          assignmentId: 'as_002',
          orderId: 'ord_002',
          pickup: { lat: 28.6139, lng: 77.209 },
          dropoff: { lat: 28.6245, lng: 77.2163 },
          distanceMeters: 8000,
          estimatedEarnings: 85,
          estimatedDuration: 12,
          status: 'picked_up',
          pickupAddress: 'Artisan Bakery & Co, Greenwich Ave',
          deliveryAddress: 'West Village Lofts, Floor 2, Door 201',
          sellerName: 'Artisan Bakery & Co',
          buyerName: 'Jane Smith',
          qrToken: 'frpdha34390294'
        },
      ];
    }

    try {
      const response = await fetch(`${API_BASE_URL}/delivery/assignments/active`, {
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });
      const data = await response.json();
      return data.assignments || [];
    } catch (error) {
      throw new Error('Failed to fetch assignments');
    }
  }

  async getAssignmentDetails(assignmentId: string): Promise<any> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const assignments = await this.getActiveAssignments();
      return assignments.find((a) => a.assignmentId === assignmentId) || null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/delivery/assignments/${assignmentId}`, {
        headers: { Authorization: `Bearer ${this.sessionToken}` },
      });
      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error('Failed to fetch assignment details');
    }
  }
}

const apiService = new ApiService();
export default apiService;
