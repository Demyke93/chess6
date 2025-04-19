
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  reference?: string;
  payout_details?: any;
}

export const useTransactions = (walletId?: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['transactions', walletId, user?.id],
    queryFn: async () => {
      try {
        let walletIdToUse = walletId;
        
        if (!walletIdToUse && user?.id) {
          // If no wallet ID is provided, fetch the user's wallet first
          const { data: walletData, error: walletError } = await supabase
            .from('wallets')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (walletError) {
            console.error('Error fetching wallet:', walletError);
            return []; // Return empty array on error
          }
          
          if (!walletData) {
            // Create wallet if it doesn't exist
            const { data: newWallet, error: createError } = await supabase
              .from('wallets')
              .insert({
                user_id: user.id,
                balance: 0
              })
              .select('id')
              .single();
              
            if (createError) {
              console.error('Error creating wallet:', createError);
              return []; // Return empty array on error
            }
            
            walletIdToUse = newWallet.id;
          } else {
            walletIdToUse = walletData.id;
          }
        }
        
        if (!walletIdToUse) {
          console.log('No wallet ID available for transactions');
          return []; // Return empty array if no wallet ID
        }
        
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('wallet_id', walletIdToUse)
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Error fetching transactions:', error);
          return []; // Return empty array on error
        }
        
        return data as Transaction[];
      } catch (error) {
        console.error('Error in transaction fetch:', error);
        return []; // Return empty array on error
      }
    },
    enabled: !!walletId || !!user?.id,
    staleTime: 30000, // 30 seconds
    retry: 3,
  });
};
