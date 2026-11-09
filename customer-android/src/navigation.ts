/** Navigation route names + params shared by all screens. */
export type RootStackParamList = {
  // ── Auth (unauthenticated / unverified) ──
  Login: undefined;
  Register: undefined;
  VerifyEmail: undefined;
  ForgotPassword: undefined;

  // ── Customer app ──
  Home: undefined;
  Cart: undefined;
  Checkout: {
    /** Address chosen on the Addresses screen (pick mode). */
    pickedAddress?: {
      id: string;
      label: string;
      receiverName: string;
      phone: string;
      line: string;
    };
  } | undefined;
  OrderSuccess: {
    orderId: string;
    total: number;
    itemCount: number;
  };
  /** Account dashboard: profile, orders, addresses, reorder, logout. */
  Profile: undefined;
  /** Live order list — tabs: Active orders | Order history. */
  MyOrders: {
    initialTab?: 'active' | 'history';
  } | undefined;
  /** Real-time tracking for one order (timeline + bill + driver map). */
  OrderTracking: {
    orderId: string;
  };
  /** Saved delivery addresses (add / edit / remove / pick). */
  Addresses: {
    /** When opened from checkout: pick an address and return. */
    pickMode?: boolean;
  } | undefined;
  /** One-tap re-order from delivered orders. */
  Reorder: undefined;
  /** Driver console (only reachable with a driver account). */
  DriverHome: undefined;
};
