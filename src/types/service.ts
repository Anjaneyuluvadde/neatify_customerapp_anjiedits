export type ServiceType = "BATHROOM" | "KITCHEN" | "HOUSE" | string;

export interface Service {
  id: string;
  slug?: string;
  title: string;

  /**
   * Used for tab filtering and service identification
   */
  service_type: ServiceType;

  /**
   * Order in which this category should appear in tabs
   */
  category_order?: number;

  duration: string;
  price: string;

  /**
   * Main hero image
   */
  image: string;

  /**
   * Gallery images (Supabase text[])
   */
  gallery_images?: string[];

  /**
   * Full description from Supabase column
   */
  description?: string;

  /**
   * Sort order for displaying services
   */
  sort_order?: number;

  /**
   * Original price before discount
   */
  original_price?: number | null;

  /**
   * Discount percentage (e.g., 20 for 20% off)
   */
  discount_percent?: number | null;

  /**
   * Custom offer text from '%' column (e.g., "5%", "Special Offer")
   * This is the text that will be displayed in the discount badge
   */
  /**
   * Custom offer text from '%' column (e.g., "5%", "Special Offer")
   * This is the text that will be displayed in the discount badge
   */
  discount_label?: string | null;

  /**
   * Description of what the service includes
   */
  work_includes?: string | null;

  /**
   * Tax percentage to apply (e.g., 5 for 5% tax)
   */
  tax_percent?: number | null;
}
