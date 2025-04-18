
import { useQuery } from '@tanstack/react-query';

export const useBanks = () => {
  return useQuery({
    queryKey: ['banks'],
    queryFn: async () => {
      try {
        const response = await fetch('https://api.paystack.co/bank');
        const data = await response.json();
        return data.status ? data.data : [];
      } catch (error) {
        console.error('Error fetching banks:', error);
        return [];
      }
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours
  });
};
