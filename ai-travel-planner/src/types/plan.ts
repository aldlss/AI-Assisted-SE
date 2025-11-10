export type PlanRequest = {
  destination: string;
  days?: number;
  dateRange?: { start: string; end: string };
  budget?: number;
  partySize?: number;
  preferences?: string;
};

export type ItineraryItem = {
  id?: string;
  type: "sight" | "food" | "hotel" | "transport";
  name: string;
  description?: string;
  address?: string;
  lat?: number;
  lng?: number;
  start_time?: string;
  end_time?: string;
  estimated_cost?: number;
  transport_mode?: "drive" | "walk" | "transit";
};

export type DayPlan = {
  day_index: number;
  note?: string;
  items: ItineraryItem[];
};

export type PlanResponse = {
  tripId?: string;
  title?: string;
  destination: string;
  days: number;
  itinerary: DayPlan[];
  budget_total?: number;
};
