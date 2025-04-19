
import { useQuery } from '@tanstack/react-query';

export const useBanks = () => {
  return useQuery({
    queryKey: ['banks'],
    queryFn: async () => {
      try {
        const response = await fetch('https://api.paystack.co/bank');
        if (!response.ok) {
          throw new Error(`Failed to fetch banks: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.status ? data.data : [];
      } catch (error) {
        console.error('Error fetching banks:', error);
        return [];
      }
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours (this replaces cacheTime in newer versions)
    retry: 2,
  });
};
