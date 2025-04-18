
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useConversionRate = () => {
  return useQuery({
    queryKey: ["conversionRate"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'currency_conversion')
        .single();
      
      if (error) {
        console.error("Error fetching conversion rate:", error);
        return { value: { naira_to_coin: 1000, min_deposit: 1000, min_withdrawal: 1000 } };
      }
      
      return data || { value: { naira_to_coin: 1000, min_deposit: 1000, min_withdrawal: 1000 } };
    }
  });
};
