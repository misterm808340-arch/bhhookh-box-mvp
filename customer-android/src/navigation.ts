/** Navigation route names + params shared by all screens. */
export type RootStackParamList = {
  Home: undefined;
  Cart: undefined;
  Checkout: undefined;
  OrderSuccess: {
    orderId: string;
    total: number;
    itemCount: number;
  };
};
