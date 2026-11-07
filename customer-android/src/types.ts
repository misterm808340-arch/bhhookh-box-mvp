import type { ImageSourcePropType } from 'react-native';

export interface FoodItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: ImageSourcePropType;
  isVeg: boolean;
  popular: boolean;
  rating: number;
  prepTime: string;
}

export interface CartLine {
  item: FoodItem;
  quantity: number;
}

/** Exactly the item shape stored in Firestore order documents. */
export interface OrderItemPayload {
  name: string;
  price: number;
  quantity: number;
}

export type OrderStatus =
  | 'Pending'
  | 'Accepted'
  | 'Preparing'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Rejected';
