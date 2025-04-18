
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
    queryKey: ['transactions', walletId],
    queryFn: async () => {
      if (!walletId) {
        // If no wallet ID is provided, fetch the user's wallet first
        if (!user?.id) throw new Error('User not authenticated');
        
        const { data: walletData, error: walletError } = await supabase
          .from('wallets')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (walletError) throw walletError;
        if (!walletData) throw new Error('Wallet not found');
        
        walletId = walletData.id;
      }
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      return data as Transaction[];
    },
    enabled: !!walletId || !!user,
  });
};
